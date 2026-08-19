const config = require('../config/config');
const { enviarEmailAlertaIntegracao } = require('./emailService');
const { podeEnviarAlerta } = require('../utils/alertaThrottle');
const { fetchComRetry } = require('../utils/fetchComRetry');
const logger = require('../utils/logger');
const CachePlaca = require('../models/CachePlaca');

/**
 * Busca de veículo por placa — dois provedores possíveis, escolhidos por
 * PLACA_API_PROVEDOR no .env:
 *
 * 1) 'apibrasil' (padrão, recomendado para produção)
 *    Provedor pago por consulta (ver app.apibrasil.io). Endpoint e
 *    autenticação confirmados direto na tela "Detalhes" da API contratada
 *    (Marketplace > sua API > Detalhes > exemplo cURL):
 *      POST https://gateway.apibrasil.io/api/v2/vehicles/dados
 *      Authorization: Bearer <PLACA_API_BEARER_TOKEN>
 *    PLACA_API_DEVICE_TOKEN é OPCIONAL — só é enviado no header se você
 *    configurar (algumas variações de API dessa plataforma exigem,
 *    outras não; confira sempre na tela de Detalhes da SUA API).
 *    PLACA_API_HOMOLOG=true tenta rodar em modo sandbox sem cobrar, se o
 *    provedor suportar isso nessa rota.
 *
 * 2) 'sinesp-local' (só para TESTE, não recomendado para produção)
 *    Aponta para uma instância local da consultaplaca-api
 *    (github.com/yagoluiz/consultaplaca-api) — via NÃO OFICIAL, sem
 *    garantia nenhuma de disponibilidade.
 *
 * Em ambos os casos, essa integração é OPCIONAL: se não estiver
 * configurada, o cadastro de veículo continua manual, como sempre foi.
 *
 * Boas práticas de produção implementadas aqui:
 *   - CACHE: resultado de cada placa fica salvo por alguns dias (ver
 *     models/CachePlaca.js), economizando requisições e melhorando a
 *     latência em placas repetidas (cliente que volta, veículo já
 *     cadastrado antes por outra oficina etc).
 *   - RETRY COM BACKOFF: falhas transitórias (timeout, erro de rede,
 *     5xx, 429) são tentadas de novo automaticamente antes de desistir
 *     (ver utils/fetchComRetry.js). Erros 4xx não são repetidos.
 *   - LOGS ESTRUTURADOS: todo evento relevante (acerto de cache, chamada
 *     à API, falha, retry) é logado em JSON (ver utils/logger.js), fácil
 *     de filtrar/monitorar em produção.
 *   - ALERTA POR E-MAIL: se a chamada falhar mesmo após as tentativas, um
 *     e-mail é enviado para ALERTA_EMAIL_DESTINO (no máximo 1 a cada 30
 *     minutos — ver utils/alertaThrottle.js).
 *   - ROTAÇÃO DE CREDENCIAIS: ver utils/verificacaoCredenciais.js (roda
 *     separadamente, checado no início do servidor).
 */

const URL_APIBRASIL_DEVICE = 'https://gateway.apibrasil.io/api/v2/vehicles/dados';
const CHAVE_ALERTA = 'busca-placa';
const NOME_SERVICO = 'placaService';

function estaConfigurado() {
  if (config.placaApi.provedor === 'sinesp-local') {
    return Boolean(config.placaApi.urlLocal);
  }
  // Confirmado na tela oficial de Detalhes da API contratada: só o Bearer
  // Token já é suficiente para autenticar. DeviceToken fica opcional (só
  // é enviado se você configurar, para as variações que exigem).
  return Boolean(config.placaApi.bearerToken);
}

function normalizarResposta(corpo) {
  // Aceita variações comuns entre famílias/provedores: dados dentro de
  // "response", "data", "response.veiculo", ou direto na raiz do JSON.
  const dados =
    corpo?.response?.veiculo || corpo?.response || corpo?.data?.veiculo || corpo?.data || corpo || {};

  const marcaModelo = dados.marca_modelo || dados.MARCA_MODELO || dados.modelo || '';
  let marca = dados.marca || dados.MARCA || '';
  let modelo = dados.modelo || dados.MODELO || '';

  if (!marca && !modelo && marcaModelo) {
    const partes = marcaModelo.split('/');
    marca = (partes[0] || '').trim();
    modelo = (partes.slice(1).join('/') || '').trim();
  }

  const anoBruto = dados.ano || dados.ano_modelo || dados.anoModelo || '';
  const ano = parseInt(String(anoBruto).slice(0, 4), 10) || undefined;

  const combustivelBruto = (dados.combustivel || dados.fuel || '').toLowerCase();
  let combustivel;
  if (combustivelBruto.includes('flex')) combustivel = 'flex';
  else if (combustivelBruto.includes('gasolina')) combustivel = 'gasolina';
  else if (combustivelBruto.includes('etanol') || combustivelBruto.includes('alcool')) combustivel = 'etanol';
  else if (combustivelBruto.includes('diesel')) combustivel = 'diesel';
  else if (combustivelBruto.includes('eletrico')) combustivel = 'eletrico';
  else if (combustivelBruto.includes('hibrido')) combustivel = 'hibrido';

  return {
    marca,
    modelo,
    ano,
    cor: dados.cor || dados.COR || dados.color || '',
    combustivel,
    chassi: dados.chassi || dados.CHASSI || '',
    encontrado: Boolean(marca || modelo)
  };
}

async function dispararAlerta(mensagemErro) {
  logger.erro(NOME_SERVICO, 'falha_busca_placa', { mensagem: mensagemErro });

  if (!config.alertas.emailDestino) return;
  if (!podeEnviarAlerta(CHAVE_ALERTA)) return;

  try {
    await enviarEmailAlertaIntegracao({
      destinatarioEmail: config.alertas.emailDestino,
      nomeIntegracao: 'Busca de veículo por placa',
      detalhesErro: mensagemErro
    });
  } catch (err) {
    logger.erro(NOME_SERVICO, 'falha_enviar_email_alerta', { erro: err.message });
  }
}

async function buscarViaApiBrasil(placaLimpa) {
  // Endpoint confirmado direto na tela "Detalhes" da API contratada
  // (app.apibrasil.io > Marketplace > Placa FIPE (Com Chassi) > Detalhes):
  //   POST https://gateway.apibrasil.io/api/v2/vehicles/dados
  //   Authorization: Bearer SEU_TOKEN
  // Sem DeviceToken no exemplo oficial — mas incluímos o header só SE
  // PLACA_API_DEVICE_TOKEN estiver configurado, porque outras APIs
  // "device-based" da mesma plataforma (ex.: "API Placa Dados" clássica)
  // usam essa mesma URL só que exigindo DeviceToken. Assim o código
  // funciona para as duas variações sem precisar saber qual é qual.
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${config.placaApi.bearerToken}`
  };
  if (config.placaApi.deviceToken) {
    headers.DeviceToken = config.placaApi.deviceToken;
  }

  const corpoRequisicao = { placa: placaLimpa };
  // "credit" é o modo de operação mostrado na tela de Detalhes desta API
  // específica — aceita homolog para testar em sandbox sem cobrar, se o
  // provedor suportar isso nesta rota.
  if (config.placaApi.homolog) {
    corpoRequisicao.homolog = true;
  }

  const resposta = await fetchComRetry(
    URL_APIBRASIL_DEVICE,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(corpoRequisicao)
    },
    { servico: NOME_SERVICO }
  );

  if (!resposta.ok) {
    throw new Error(`APIBrasil retornou status ${resposta.status}`);
  }

  return resposta.json();
}

async function buscarViaSinespLocal(placaLimpa) {
  const url = `${config.placaApi.urlLocal.replace(/\/$/, '')}/api/v1/plates/${placaLimpa}`;
  const resposta = await fetchComRetry(
    url,
    { method: 'GET', headers: { Accept: 'application/json' } },
    { servico: NOME_SERVICO }
  );

  if (!resposta.ok) {
    throw new Error(`consultaplaca-api local retornou status ${resposta.status}`);
  }

  return resposta.json();
}

async function buscarNoCache(placaLimpa) {
  try {
    const registro = await CachePlaca.findOne({ placa: placaLimpa });
    return registro ? registro.dados : null;
  } catch (err) {
    logger.aviso(NOME_SERVICO, 'falha_ler_cache', { placa: placaLimpa, erro: err.message });
    return null;
  }
}

async function salvarNoCache(placaLimpa, dados) {
  try {
    const expiraEm = new Date(Date.now() + config.placaApi.cacheDias * 24 * 60 * 60 * 1000);
    await CachePlaca.findOneAndUpdate(
      { placa: placaLimpa },
      { placa: placaLimpa, dados, expiraEm },
      { upsert: true }
    );
  } catch (err) {
    logger.aviso(NOME_SERVICO, 'falha_salvar_cache', { placa: placaLimpa, erro: err.message });
  }
}

/**
 * @param {string} placa
 * @returns {Promise<object|null>} dados normalizados do veículo, ou null se
 *   a integração não estiver configurada.
 * @throws se a integração estiver configurada mas a chamada falhar (o
 *   controller decide como tratar; um alerta por e-mail já é disparado
 *   internamente antes de relançar o erro).
 */
async function buscarDadosPorPlaca(placa) {
  if (!estaConfigurado()) return null;

  const placaLimpa = (placa || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (!placaLimpa) return null;

  const doCache = await buscarNoCache(placaLimpa);
  if (doCache) {
    logger.info(NOME_SERVICO, 'cache_hit', { placa: placaLimpa });
    return doCache;
  }
  logger.info(NOME_SERVICO, 'cache_miss', { placa: placaLimpa });

  try {
    const corpo =
      config.placaApi.provedor === 'sinesp-local'
        ? await buscarViaSinespLocal(placaLimpa)
        : await buscarViaApiBrasil(placaLimpa);

    const dados = normalizarResposta(corpo);

    if (dados.encontrado) {
      await salvarNoCache(placaLimpa, dados);
    }

    logger.info(NOME_SERVICO, 'busca_concluida', {
      placa: placaLimpa,
      provedor: config.placaApi.provedor,
      encontrado: dados.encontrado
    });

    return dados;
  } catch (err) {
    await dispararAlerta(
      `Provedor: ${config.placaApi.provedor}. Erro: ${err.message}. Placa consultada: ${placaLimpa}.`
    );
    throw err;
  }
}

module.exports = { buscarDadosPorPlaca, estaConfigurado };
