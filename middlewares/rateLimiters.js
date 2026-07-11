const rateLimit = require('express-rate-limit');

/**
 * Limite rígido para tentativas de login (proteção contra força bruta).
 */
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { sucesso: false, mensagem: 'Muitas tentativas de login. Tente novamente em alguns minutos.' }
});

/**
 * Limite para recuperação de senha.
 */
const limiteRecuperacaoSenha = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { sucesso: false, mensagem: 'Muitas solicitações. Tente novamente mais tarde.' }
});

/**
 * Limite geral para toda a aplicação.
 */
const limiteGeral = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { limiteLogin, limiteRecuperacaoSenha, limiteGeral };
