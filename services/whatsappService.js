const config = require('../config/config');
const Notificacao = require('../models/Notificacao');

/**
 * Camada de envio de WhatsApp.
 *
 * IMPORTANTE: o envio real de mensagens WhatsApp exige uma conta em um provedor
 * (ex.: Twilio WhatsApp API, Z-API, Meta Cloud API) com credenciais próprias.
 * Nenhum sistema pode enviar mensagens reais sem essas credenciais — não é uma
 * limitação deste código, é uma exigência do WhatsApp/Meta para qualquer integração.
 *
 * Esta camada já está pronta: toda notificação é registrada no banco (fila) e,
 * se WHATSAPP_API_URL e WHATSAPP_API_TOKEN estiverem configurados no .env,
 * a mensagem é enviada via HTTP para o provedor configurado. Sem essas variáveis,
 * a notificação fica registrada como "pendente" para envio manual ou posterior
 * ativação do provedor.
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
  montarMensagemProximaRevisao,
  montarMensagemConfirmacaoServico
};
