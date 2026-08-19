const Configuracao = require('../models/Configuracao');
const { construirLinkWhatsApp } = require('../utils/whatsappLink');
const {
  montarMensagemMotoPronta,
  montarMensagemOrcamento,
  montarMensagemLinkAprovacao,
  montarMensagemLinkAcompanhamento,
  montarMensagemProximaRevisao,
  montarMensagemConfirmacaoServico
} = require('../services/whatsappService');

// Configuracao agora é por oficina, então o cache precisa ser por oficina
// também (um Map em vez de uma única variável) — senão a configuração de
// uma oficina "vazaria" em cache para outra.
const configCache = new Map(); // oficinaId -> { config, expiraEm }
const TTL_CACHE_MS = 60 * 1000;

async function obterConfiguracao(oficinaId) {
  if (!oficinaId) return null;
  const chave = String(oficinaId);
  const agora = Date.now();
  const entrada = configCache.get(chave);
  if (entrada && agora < entrada.expiraEm) return entrada.config;

  let config = await Configuracao.findOne({ chave: 'geral' });
  if (!config) {
    config = await Configuracao.create({ chave: 'geral' });
  }
  configCache.set(chave, { config, expiraEm: agora + TTL_CACHE_MS });
  return config;
}

function invalidarCacheConfiguracao(oficinaId) {
  if (oficinaId) {
    configCache.delete(String(oficinaId));
  } else {
    configCache.clear();
  }
}

/**
 * Roda em toda requisição (pública ou não) e cuida só do que não depende de
 * oficina: csrf token, mensagens flash, helpers de views.
 */
function injetarLocals(req, res, next) {
  res.locals.csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : null;
  res.locals.rotaAtual = req.originalUrl;
  res.locals.configuracao = null;
  res.locals.mensagemSucesso = req.session?.mensagemSucesso || null;
  res.locals.mensagemErro = req.session?.mensagemErro || null;
  res.locals.construirLinkWhatsApp = construirLinkWhatsApp;
  res.locals.montarMensagemMotoPronta = montarMensagemMotoPronta;
  res.locals.montarMensagemOrcamento = montarMensagemOrcamento;
  res.locals.montarMensagemLinkAprovacao = montarMensagemLinkAprovacao;
  res.locals.montarMensagemLinkAcompanhamento = montarMensagemLinkAcompanhamento;
  res.locals.montarMensagemProximaRevisao = montarMensagemProximaRevisao;
  res.locals.montarMensagemConfirmacaoServico = montarMensagemConfirmacaoServico;
  if (req.session) {
    delete req.session.mensagemSucesso;
    delete req.session.mensagemErro;
  }
  next();
}

/**
 * Roda só nas rotas autenticadas (depois de exigirAutenticacao, quando já
 * sabemos a oficina do usuário) e carrega a configuração daquela oficina.
 */
async function injetarConfiguracaoOficina(req, res, next) {
  try {
    if (req.oficina) {
      const config = await obterConfiguracao(req.oficina._id);
      res.locals.configuracao = config;
      // nomeOficina/logo em Configuracao são só personalizações extras;
      // o nome "oficial" e o nicho vêm do próprio model Oficina.
      res.locals.configuracao = {
        ...(config ? config.toObject() : {}),
        nomeOficina: (config && config.nomeOficina) || req.oficina.nome,
        logo: (config && config.logo) || req.oficina.logo
      };
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { injetarLocals, injetarConfiguracaoOficina, obterConfiguracao, invalidarCacheConfiguracao };
