const Configuracao = require('../models/Configuracao');
const { construirLinkWhatsApp } = require('../utils/whatsappLink');
const {
  montarMensagemMotoPronta,
  montarMensagemOrcamento,
  montarMensagemProximaRevisao,
  montarMensagemConfirmacaoServico
} = require('../services/whatsappService');

let configCache = null;
let configCacheExpira = 0;

async function obterConfiguracao() {
  const agora = Date.now();
  if (configCache && agora < configCacheExpira) return configCache;
  let config = await Configuracao.findOne({ chave: 'geral' });
  if (!config) {
    config = await Configuracao.create({ chave: 'geral' });
  }
  configCache = config;
  configCacheExpira = agora + 60 * 1000; // 1 minuto de cache
  return config;
}

function invalidarCacheConfiguracao() {
  configCache = null;
}

async function injetarLocals(req, res, next) {
  try {
    res.locals.csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : null;
    res.locals.rotaAtual = req.originalUrl;
    res.locals.configuracao = await obterConfiguracao();
    res.locals.mensagemSucesso = req.session?.mensagemSucesso || null;
    res.locals.mensagemErro = req.session?.mensagemErro || null;
    res.locals.construirLinkWhatsApp = construirLinkWhatsApp;
    res.locals.montarMensagemMotoPronta = montarMensagemMotoPronta;
    res.locals.montarMensagemOrcamento = montarMensagemOrcamento;
    res.locals.montarMensagemProximaRevisao = montarMensagemProximaRevisao;
    res.locals.montarMensagemConfirmacaoServico = montarMensagemConfirmacaoServico;
    if (req.session) {
      delete req.session.mensagemSucesso;
      delete req.session.mensagemErro;
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { injetarLocals, obterConfiguracao, invalidarCacheConfiguracao };
