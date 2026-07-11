const User = require('../models/User');
const { ehEmailValido, ehSenhaForte } = require('../utils/validacao');
const { registrarAuditoria } = require('../utils/auditoria');

async function listar(req, res, next) {
  try {
    const usuarios = await User.find().sort({ nome: 1 });
    res.render('usuarios/listar', { titulo: 'Usuários', usuarios, perfis: User.PERFIS });
  } catch (err) {
    next(err);
  }
}

function formularioNovo(req, res) {
  res.render('usuarios/formulario', { titulo: 'Novo Usuário', usuarioForm: {}, perfis: User.PERFIS, modo: 'criar' });
}

async function criar(req, res, next) {
  try {
    const { nome, email, senha, perfil, telefone } = req.body;

    if (!ehEmailValido(email) || !ehSenhaForte(senha)) {
      req.session.mensagemErro = 'E-mail inválido ou senha fraca (mín. 8 caracteres, maiúscula, minúscula e número).';
      return res.redirect('/usuarios/novo');
    }

    const usuario = await User.create({ nome, email: email.toLowerCase(), senha, perfil, telefone });
    await registrarAuditoria(req, { modulo: 'usuarios', acao: 'criar', referenciaId: usuario._id, descricao: `Usuário ${usuario.nome} (${usuario.perfil}) criado` });

    req.session.mensagemSucesso = 'Usuário criado com sucesso.';
    return res.redirect('/usuarios');
  } catch (err) {
    if (err.code === 11000) {
      req.session.mensagemErro = 'Já existe um usuário com este e-mail.';
      return res.redirect('/usuarios/novo');
    }
    return next(err);
  }
}

async function formularioEditar(req, res, next) {
  try {
    const usuarioForm = await User.findById(req.params.id);
    if (!usuarioForm) {
      req.session.mensagemErro = 'Usuário não encontrado.';
      return res.redirect('/usuarios');
    }
    res.render('usuarios/formulario', { titulo: 'Editar Usuário', usuarioForm, perfis: User.PERFIS, modo: 'editar' });
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const { nome, perfil, telefone, ativo } = req.body;
    const usuario = await User.findById(req.params.id);
    if (!usuario) {
      req.session.mensagemErro = 'Usuário não encontrado.';
      return res.redirect('/usuarios');
    }

    usuario.nome = nome;
    usuario.perfil = perfil;
    usuario.telefone = telefone;
    usuario.ativo = ativo === 'on' || ativo === 'true';

    await usuario.save();
    await registrarAuditoria(req, { modulo: 'usuarios', acao: 'editar', referenciaId: usuario._id, descricao: `Usuário ${usuario.nome} atualizado` });

    req.session.mensagemSucesso = 'Usuário atualizado com sucesso.';
    return res.redirect('/usuarios');
  } catch (err) {
    return next(err);
  }
}

async function redefinirSenha(req, res, next) {
  try {
    const { novaSenha } = req.body;
    if (!ehSenhaForte(novaSenha)) {
      req.session.mensagemErro = 'Senha fraca. Use ao menos 8 caracteres, com maiúscula, minúscula e número.';
      return res.redirect(`/usuarios/${req.params.id}/editar`);
    }
    const usuario = await User.findById(req.params.id);
    usuario.senha = novaSenha;
    await usuario.save();

    await registrarAuditoria(req, { modulo: 'usuarios', acao: 'editar', referenciaId: usuario._id, descricao: `Senha de ${usuario.nome} redefinida por administrador` });

    req.session.mensagemSucesso = 'Senha redefinida com sucesso.';
    return res.redirect('/usuarios');
  } catch (err) {
    return next(err);
  }
}

module.exports = { listar, formularioNovo, criar, formularioEditar, atualizar, redefinirSenha };
