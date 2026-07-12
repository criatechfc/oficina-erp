const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config/config');
const User = require('../models/User');
const LogAcesso = require('../models/LogAcesso');
const { ehEmailValido, ehSenhaForte } = require('../utils/validacao');
const { enviarEmailRecuperacaoSenha } = require('../services/emailService');

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 15;

function gerarToken(usuario) {
  return jwt.sign({ id: usuario._id, perfil: usuario.perfil }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn
  });
}

function definirCookieToken(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000
  });
}

async function registrarLog(req, dados) {
  try {
    await LogAcesso.create({
      ...dados,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
  } catch (err) {
    console.error('[LogAcesso] Falha ao registrar:', err.message);
  }
}

function paginaLogin(req, res) {
  res.render('auth/login', { titulo: 'Entrar' });
}

async function autenticar(req, res) {
  const { email, senha } = req.body;

  if (!ehEmailValido(email) || !senha) {
    req.session.mensagemErro = 'Informe um e-mail válido e a senha.';
    return res.redirect('/login');
  }

  const usuario = await User.findOne({ email: email.toLowerCase().trim() }).select('+senha');

  if (!usuario) {
    await registrarLog(req, { emailTentativa: email, acao: 'login_falha', detalhes: 'Usuário não encontrado' });
    req.session.mensagemErro = 'E-mail ou senha inválidos.';
    return res.redirect('/login');
  }

  if (usuario.estaBloqueado()) {
    await registrarLog(req, { usuario: usuario._id, acao: 'conta_bloqueada' });
    req.session.mensagemErro = `Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em alguns minutos.`;
    return res.redirect('/login');
  }

  if (!usuario.ativo) {
    req.session.mensagemErro = 'Sua conta está desativada. Contate o administrador.';
    return res.redirect('/login');
  }

  const senhaCorreta = await usuario.compararSenha(senha);

  if (!senhaCorreta) {
    usuario.tentativasLogin += 1;
    if (usuario.tentativasLogin >= MAX_TENTATIVAS) {
      usuario.bloqueadoAte = new Date(Date.now() + BLOQUEIO_MINUTOS * 60 * 1000);
      usuario.tentativasLogin = 0;
      await registrarLog(req, { usuario: usuario._id, acao: 'conta_bloqueada' });
    }
    await usuario.save();
    await registrarLog(req, { usuario: usuario._id, acao: 'login_falha', detalhes: 'Senha incorreta' });
    req.session.mensagemErro = 'E-mail ou senha inválidos.';
    return res.redirect('/login');
  }

  usuario.tentativasLogin = 0;
  usuario.bloqueadoAte = null;
  usuario.ultimoLogin = new Date();
  await usuario.save();

  const token = gerarToken(usuario);
  definirCookieToken(res, token);

  await registrarLog(req, { usuario: usuario._id, acao: 'login_sucesso' });

  return res.redirect('/dashboard');
}

async function sair(req, res) {
  if (req.usuario) {
    await registrarLog(req, { usuario: req.usuario._id, acao: 'logout' });
  }
  res.clearCookie('token');
  return res.redirect('/login');
}

function paginaEsqueciSenha(req, res) {
  res.render('auth/esqueci-senha', { titulo: 'Recuperar senha' });
}

async function solicitarRecuperacao(req, res) {
  const { email } = req.body;

  if (ehEmailValido(email)) {
    const usuario = await User.findOne({ email: email.toLowerCase().trim() });
    if (usuario) {
      const token = usuario.gerarTokenReset();
      await usuario.save();
      const linkReset = `${config.appUrl}/redefinir-senha/${token}`;

      // Não usar await aqui: o envio de e-mail depende de um servidor SMTP
      // externo que pode estar lento, indisponível, ou ter a porta bloqueada
      // pelo provedor de hospedagem. Se a resposta HTTP esperasse por isso,
      // a tela ficava "carregando" até o SMTP travar/der timeout. O envio
      // roda em segundo plano e qualquer erro só vai para o log.
      enviarEmailRecuperacaoSenha(usuario.email, usuario.nome, linkReset)
        .then((enviado) => {
          if (!enviado) {
            console.log(`[Recuperação de senha] SMTP não configurado. Link para ${usuario.email}: ${linkReset}`);
          }
        })
        .catch((err) => {
          console.error('[Recuperação de senha] Falha ao enviar e-mail:', err.message);
        });
    }
  }

  // Resposta genérica sempre, para não revelar quais e-mails existem no sistema.
  req.session.mensagemSucesso = 'Se o e-mail existir em nossa base, um link de recuperação foi enviado.';
  return res.redirect('/login');
}
async function paginaRedefinirSenha(req, res) {
  const { token } = req.params;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const usuario = await User.findOne({
    resetSenhaToken: tokenHash,
    resetSenhaExpira: { $gt: Date.now() }
  });

  if (!usuario) {
    req.session.mensagemErro = 'Link de recuperação inválido ou expirado.';
    return res.redirect('/login');
  }

  return res.render('auth/redefinir-senha', { titulo: 'Redefinir senha', token });
}

async function redefinirSenha(req, res) {
  const { token } = req.params;
  const { senha, confirmarSenha } = req.body;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const usuario = await User.findOne({
    resetSenhaToken: tokenHash,
    resetSenhaExpira: { $gt: Date.now() }
  }).select('+resetSenhaToken +resetSenhaExpira');

  if (!usuario) {
    req.session.mensagemErro = 'Link de recuperação inválido ou expirado.';
    return res.redirect('/login');
  }

  if (senha !== confirmarSenha || !ehSenhaForte(senha)) {
    req.session.mensagemErro = 'A senha deve ter ao menos 8 caracteres, com maiúscula, minúscula e número, e as senhas devem coincidir.';
    return res.redirect(`/redefinir-senha/${token}`);
  }

  usuario.senha = senha;
  usuario.resetSenhaToken = undefined;
  usuario.resetSenhaExpira = undefined;
  await usuario.save();

  await registrarLog(req, { usuario: usuario._id, acao: 'senha_recuperada' });

  req.session.mensagemSucesso = 'Senha redefinida com sucesso. Faça login.';
  return res.redirect('/login');
}

module.exports = {
  paginaLogin,
  autenticar,
  sair,
  paginaEsqueciSenha,
  solicitarRecuperacao,
  paginaRedefinirSenha,
  redefinirSenha
};
