const jwt = require('jsonwebtoken');
const config = require('../config/config');
const User = require('../models/User');

/**
 * Exige que o usuário esteja autenticado (via cookie httpOnly contendo JWT).
 * Popula req.usuario com os dados atuais do banco (garante que perfil/ativo estejam frescos).
 */
async function exigirAutenticacao(req, res, next) {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return redirecionarNaoAutenticado(req, res);
    }

    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      res.clearCookie('token');
      return redirecionarNaoAutenticado(req, res);
    }

    const usuario = await User.findById(payload.id);

    if (!usuario || !usuario.ativo) {
      res.clearCookie('token');
      return redirecionarNaoAutenticado(req, res);
    }

    req.usuario = usuario;
    res.locals.usuarioLogado = usuario;
    return next();
  } catch (err) {
    return next(err);
  }
}

function redirecionarNaoAutenticado(req, res) {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ sucesso: false, mensagem: 'Não autenticado.' });
  }
  return res.redirect('/login');
}

/**
 * Restringe a rota a determinados perfis.
 * Uso: exigirPerfil('administrador', 'gerente')
 */
function exigirPerfil(...perfisPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return redirecionarNaoAutenticado(req, res);
    }
    if (!perfisPermitidos.includes(req.usuario.perfil)) {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({ sucesso: false, mensagem: 'Acesso negado.' });
      }
      return res.status(403).render('erro', {
        titulo: 'Acesso negado',
        mensagem: 'Você não tem permissão para acessar esta área.',
        codigo: 403
      });
    }
    return next();
  };
}

/**
 * Se já estiver logado, redireciona para o dashboard (usado na tela de login).
 */
function redirecionarSeAutenticado(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return next();
  try {
    jwt.verify(token, config.jwtSecret);
    return res.redirect('/dashboard');
  } catch (err) {
    return next();
  }
}

module.exports = { exigirAutenticacao, exigirPerfil, redirecionarSeAutenticado };
