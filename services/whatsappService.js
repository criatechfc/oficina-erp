const config = require('../config/config');
const Notificacao = require('../models/Notificacao');
const { getOficinaId } = require('../utils/tenantContext');
const baileysService = require('./whatsappBaileysService');

/**
 * Camada de envio de WhatsApp.
 *
 * Duas formas de enviar de verdade (nenhuma delas obrigatória — sem
 * nenhuma configurada, a notificação fica só registrada como "pendente"
 * pra envio manual via o link wa.me que aparece na tela da OS):
 *
 * 1) WhatsApp conectado via Baileys (ver whatsappBaileysService.js) —
 *    tentado primeiro, se a oficina atual tiver conectado (tela
 *    "WhatsApp" no menu). Sem custo por mensagem, mas é uma via NÃO
 *    OFICIAL, com risco real de o número ser banido pela Meta.
 *
 * 2) Provedor pago via HTTP (Twilio, Z-API, Meta Cloud API — configurado
 *    em WHATSAPP_API_URL/WHATSAPP_API_TOKEN no .env) — usado como
 *    alternativa/fallback se o Baileys não estiver conectado.
 */
async function enfileirarNotificacao({ tipo, cliente, ordemServico, destinatarioNome, destinatarioTelefone, mensagem }) {
  const notificacao = await Notificacao.create({
    tipo,
    cliente: cliente?._id || cliente,
    ordemServico: ordemServico?._id || ordemServico,
    destinatarioNome,
    destinatarioTelefone,
    mensagem,
    status: 'pendente'
  });

  const oficinaId = getOficinaId();

  if (oficinaId && baileysService.estaConectado(oficinaId)) {
    try {
      await baileysService.enviarMensagem(oficinaId, destinatarioTelefone, mensagem);
      notificacao.status = 'enviada';
      notificacao.enviadaEm = new Date();
      notificacao.canal = 'whatsapp';
    } catch (err) {
      notificacao.status = 'falhou';
      notificacao.erro = `Baileys: ${err.message}`;
    }
    await notificacao.save();
    return notificacao;
  }

  if (config.whatsapp.apiUrl && config.whatsapp.apiToken) {
    try {
      await enviarViaProvedor(notificacao);
      notificacao.status = 'enviada';
      notificacao.enviadaEm = new Date();
    } catch (err) {
      notificacao.status = 'falhou';
      notificacao.erro = err.message;
    }
    await notificacao.save();
  }

  return notificacao;
}

async function enviarViaProvedor(notificacao) {
  const resposta = await fetch(config.whatsapp.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.whatsapp.apiToken}`
    },
    body: JSON.stringify({
      to: notificacao.destinatarioTelefone,
      message: notificacao.mensagem
    })
  });

  if (!resposta.ok) {
    throw new Error(`Provedor WhatsApp retornou status ${resposta.status}`);
  }
}

function montarMensagemMotoPronta(cliente, moto) {
  return `Olá ${cliente.nome}! Sua moto ${moto.marca} ${moto.modelo} (placa ${moto.placa}) já está pronta para retirada. Agradecemos a confiança!`;
}

function montarMensagemOrcamento(cliente, os) {
  return `Olá ${cliente.nome}! O orçamento da OS Nº ${os.numero} está disponível. Total: R$ ${os.total.toFixed(2)}. Aguardamos sua aprovação.`;
}

function montarMensagemLinkAprovacao(cliente, os, link) {
  return `Olá ${cliente.nome}! O orçamento da OS Nº ${os.numero} está pronto. Total: R$ ${os.total.toFixed(2)}. Aprove ou acompanhe pelo link: ${link}`;
}

function montarMensagemLinkAcompanhamento(cliente, os, link) {
  return `Olá ${cliente.nome}! Acompanhe em tempo real o andamento da OS Nº ${os.numero} pelo link: ${link}`;
}

function montarMensagemProximaRevisao(cliente, moto, revisao) {
  return `Olá ${cliente.nome}! A moto ${moto.marca} ${moto.modelo} (placa ${moto.placa}) está próxima da revisão de ${revisao.item.replace('_', ' ')} aos ${revisao.proximaQuilometragem} km.`;
}

function montarMensagemConfirmacaoServico(cliente, os) {
  return `Olá ${cliente.nome}! Confirmamos o início do serviço da OS Nº ${os.numero} referente à sua moto.`;
}

module.exports = {
  enfileirarNotificacao,
  montarMensagemMotoPronta,
  montarMensagemOrcamento,
  montarMensagemLinkAprovacao,
  montarMensagemLinkAcompanhamento,
  montarMensagemProximaRevisao,
  montarMensagemConfirmacaoServico
};
