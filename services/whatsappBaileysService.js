const {
  default: makeWASocket,
  DisconnectReason,
  BufferJSON,
  initAuthCreds,
  makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const WhatsappSessao = require('../models/WhatsappSessao');
const logger = require('../utils/logger');

/**
 * Conexão de WhatsApp via Baileys (biblioteca NÃO OFICIAL — engenharia
 * reversa do protocolo do WhatsApp Web multi-device). Escolhida em vez do
 * whatsapp-web.js porque não precisa de navegador/Chromium rodando (muito
 * mais leve, viável em hospedagens com pouca RAM tipo Render).
 *
 * RISCO REAL, sempre visível pra quem conectar: como não é a API oficial
 * da Meta, o WhatsApp pode banir o número a qualquer momento, sem aviso
 * prévio e sem direito a recurso. Não use o número pessoal do dono — use
 * um número dedicado só pra isso, que a oficina possa perder sem drama.
 *
 * Cada oficina tem sua própria conexão (Map em memória, chaveado pelo id
 * da oficina) — a sessão persistida no Mongo é o que permite reconectar
 * sozinho depois de um restart do servidor, sem precisar ler o QR de novo
 * (ver models/WhatsappSessao.js).
 */

const conexoes = new Map(); // oficinaId (string) -> { sock, status, qrDataUrl, numero }

// Baileys loga MUITO detalhe por padrão (todo pacote de rede). Silenciado
// de propósito — os eventos que interessam (conectou, caiu, QR novo) já
// são logados explicitamente abaixo, via utils/logger.js (formato JSON).
const LOGGER_BAILEYS = pino({ level: 'silent' });

function obterEstado(oficinaId) {
  const chave = String(oficinaId);
  if (!conexoes.has(chave)) {
    conexoes.set(chave, { sock: null, status: 'desconectado', qrDataUrl: null, numero: null });
  }
  return conexoes.get(chave);
}

/**
 * Reimplementação do `useMultiFileAuthState` do próprio Baileys, só que
 * lendo/gravando no MongoDB em vez de arquivos em disco (ver
 * models/WhatsappSessao.js para o porquê). Usa os mesmos helpers de
 * serialização do Baileys (`BufferJSON`) para lidar corretamente com os
 * `Buffer`s que as chaves de criptografia contêm.
 */
async function useMongoAuthState(oficinaId) {
  let doc = await WhatsappSessao.findOne({ oficina: oficinaId });
  if (!doc) {
    doc = await WhatsappSessao.create({ oficina: oficinaId });
  }

  const ler = (chave) => {
    const bruto = doc.arquivos.get(chave);
    if (!bruto) return null;
    return JSON.parse(bruto, BufferJSON.reviver);
  };

  const creds = ler('creds') || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (tipo, ids) => {
          const dados = {};
          for (const id of ids) {
            dados[id] = ler(`${tipo}-${id}`);
          }
          return dados;
        },
        set: async (dados) => {
          for (const categoria of Object.keys(dados)) {
            for (const id of Object.keys(dados[categoria])) {
              const valor = dados[categoria][id];
              const chave = `${categoria}-${id}`;
              if (valor) {
                doc.arquivos.set(chave, JSON.stringify(valor, BufferJSON.replacer));
              } else {
                doc.arquivos.delete(chave);
              }
            }
          }
          await doc.save();
        }
      }
    },
    saveCreds: async () => {
      doc.arquivos.set('creds', JSON.stringify(creds, BufferJSON.replacer));
      await doc.save();
    }
  };
}

/**
 * Abre (ou reaproveita) a conexão do WhatsApp para uma oficina. Se não
 * houver sessão salva, o evento `connection.update` vai emitir um QR code
 * novo a cada ~20-60s até alguém escanear (ver obterStatus).
 */
async function conectar(oficinaId) {
  const chave = String(oficinaId);
  const estado = obterEstado(oficinaId);

  if (estado.sock && (estado.status === 'conectado' || estado.status === 'aguardando_qr')) {
    // Já conectado, ou já no meio de uma tentativa de conexão (esperando
    // alguém escanear o QR) — reaproveita, não abre uma segunda conexão
    // por cima. Sem essa checagem, clicar "Conectar" duas vezes (ou
    // reabrir a aba enquanto o QR ainda está na tela) criava dois sockets
    // Baileys concorrentes pra mesma oficina, disputando a mesma sessão.
    return estado;
  }

  const { state, saveCreds } = await useMongoAuthState(oficinaId);

  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, LOGGER_BAILEYS)
    },
    logger: LOGGER_BAILEYS,
    printQRInTerminal: false
  });

  estado.sock = sock;
  estado.status = 'aguardando_qr';
  estado.qrDataUrl = null;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        estado.qrDataUrl = await QRCode.toDataURL(qr);
        estado.status = 'aguardando_qr';
        logger.info('whatsappBaileys', 'qr_gerado', { oficinaId: chave });
      } catch (err) {
        logger.erro('whatsappBaileys', 'falha_gerar_qr_imagem', { oficinaId: chave, erro: err.message });
      }
    }

    if (connection === 'open') {
      estado.status = 'conectado';
      estado.qrDataUrl = null;
      estado.numero = sock.user?.id ? sock.user.id.split(':')[0] : null;
      await WhatsappSessao.updateOne(
        { oficina: oficinaId },
        { status: 'conectado', numeroConectado: estado.numero, atualizadoEm: new Date() }
      );
      logger.info('whatsappBaileys', 'conectado', { oficinaId: chave, numero: estado.numero });
    }

    if (connection === 'close') {
      const motivo = lastDisconnect?.error?.output?.statusCode;
      const foiLogout = motivo === DisconnectReason.loggedOut;
      estado.status = 'desconectado';

      logger.aviso('whatsappBaileys', 'conexao_fechada', { oficinaId: chave, motivo, foiLogout });

      if (foiLogout) {
        // Logout explícito (desconectado pelo próprio celular, ou dados
        // inválidos): apaga a sessão salva. Da próxima vez, precisa ler
        // o QR code de novo.
        await WhatsappSessao.deleteOne({ oficina: oficinaId });
        estado.sock = null;
      } else {
        // Queda transitória (rede, servidor reiniciou etc): tenta
        // reconectar sozinho depois de alguns segundos, reaproveitando a
        // sessão salva (não precisa ler QR de novo).
        setTimeout(() => {
          conectar(oficinaId).catch((err) => {
            logger.erro('whatsappBaileys', 'falha_reconectar', { oficinaId: chave, erro: err.message });
          });
        }, 5000);
      }
    }
  });

  return estado;
}

function obterStatus(oficinaId) {
  const estado = obterEstado(oficinaId);
  return { status: estado.status, qrDataUrl: estado.qrDataUrl, numero: estado.numero };
}

async function desconectar(oficinaId) {
  const estado = obterEstado(oficinaId);
  if (estado.sock) {
    try {
      await estado.sock.logout();
    } catch (err) {
      logger.aviso('whatsappBaileys', 'erro_ao_desconectar', { oficinaId: String(oficinaId), erro: err.message });
    }
  }
  await WhatsappSessao.deleteOne({ oficina: oficinaId });
  conexoes.delete(String(oficinaId));
}

/**
 * Envia uma mensagem de texto pelo WhatsApp conectado da oficina.
 * @throws se essa oficina não tiver o WhatsApp conectado no momento.
 */
async function enviarMensagem(oficinaId, telefone, mensagem) {
  const estado = obterEstado(oficinaId);
  if (!estado.sock || estado.status !== 'conectado') {
    throw new Error('WhatsApp (Baileys) não está conectado para esta oficina.');
  }

  const somenteDigitos = (telefone || '').replace(/\D/g, '');
  const comCodigoPais = somenteDigitos.startsWith('55') ? somenteDigitos : `55${somenteDigitos}`;
  const jid = `${comCodigoPais}@s.whatsapp.net`;

  await estado.sock.sendMessage(jid, { text: mensagem });
}

function estaConectado(oficinaId) {
  return obterEstado(oficinaId).status === 'conectado';
}

/**
 * Reconecta automaticamente todas as oficinas que já tinham uma sessão
 * salva, ao subir o servidor — assim uma oficina que já escaneou o QR
 * antes continua funcionando depois de um deploy/restart, sem precisar de
 * ninguém abrir a tela pra "acordar" a conexão.
 */
async function reconectarSessoesSalvas() {
  const sessoes = await WhatsappSessao.find({}).select('oficina');
  for (const sessao of sessoes) {
    // eslint-disable-next-line no-await-in-loop
    await conectar(sessao.oficina).catch((err) => {
      logger.erro('whatsappBaileys', 'falha_reconectar_na_subida', { oficinaId: String(sessao.oficina), erro: err.message });
    });
  }
  if (sessoes.length) {
    logger.info('whatsappBaileys', 'reconexao_inicial_disparada', { totalSessoes: sessoes.length });
  }
}

module.exports = { conectar, desconectar, obterStatus, enviarMensagem, estaConectado, reconectarSessoesSalvas };
