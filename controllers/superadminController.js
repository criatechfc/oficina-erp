const config = require('../config/config');
const Oficina = require('../models/Oficina');
const User = require('../models/User');
const { executarSemIsolamento } = require('../utils/tenantContext');
const { ehEmailValido, ehSenhaForte } = require('../utils/validacao');

function paginaLogin(req, res) {
  res.render('superadmin/login', { titulo: 'Acesso restrito' });
}

function autenticar(req, res) {
  const { chave } = req.body;
  if (chave && chave === config.adminSecret) {
    req.session.superAdmin = true;
    return res.redirect(`/${config.adminPath}`);
  }
  req.session.mensagemErro = 'Chave incorreta.';
  return res.redirect(`/${config.adminPath}/login`);
}

function sair(req, res) {
  req.session.superAdmin = false;
  return res.redirect(`/${config.adminPath}/login`);
}

/**
 * Lista todas as oficinas cadastradas, com contagem de usuários de cada
 * uma. Roda fora do isolamento por tenant de propósito: este é o único
 * lugar do sistema que enxerga todas as oficinas ao mesmo tempo.
 */
async function paginaDashboard(req, res, next) {
  try {
    await executarSemIsolamento(async () => {
      const oficinas = await Oficina.find().sort({ createdAt: -1 });
      const contagens = await User.aggregate([
        { $group: { _id: '$oficina', total: { $sum: 1 } } }
      ]);
      const mapaContagem = new Map(contagens.map((c) => [String(c._id), c.total]));

      const oficinasComContagem = oficinas.map((of) => ({
        ...of.toObject(),
        totalUsuarios: mapaContagem.get(String(of._id)) || 0
      }));

      res.render('superadmin/dashboard', {
        titulo: 'Painel do dono · Oficinas',
        oficinas: oficinasComContagem
      });
    });
  } catch (err) {
    next(err);
  }
}

function paginaNovaOficina(req, res) {
  res.render('superadmin/nova-oficina', {
    titulo: 'Nova oficina',
    nichos: Oficina.NICHOS,
    valores: {}
  });
}

async function criarOficina(req, res, next) {
  const { nomeOficina, nicho, nomeAdmin, email, senha, confirmarSenha } = req.body;
  const valores = { nomeOficina, nicho, nomeAdmin, email };

  function erro(mensagem) {
    return res.status(400).render('superadmin/nova-oficina', {
      titulo: 'Nova oficina',
      nichos: Oficina.NICHOS,
      valores,
      mensagemErro: mensagem
    });
  }

  if (!nomeOficina || nomeOficina.trim().length < 2) return erro('Informe o nome da oficina.');
  if (!Oficina.NICHOS.includes(nicho)) return erro('Selecione o nicho (carro, moto ou ambos).');
  if (!nomeAdmin || nomeAdmin.trim().length < 2) return erro('Informe o nome do administrador da oficina.');
  if (!ehEmailValido(email)) return erro('Informe um e-mail válido.');
  if (senha !== confirmarSenha || !ehSenhaForte(senha)) {
    return erro('A senha deve ter ao menos 8 caracteres, com maiúscula, minúscula e número, e as senhas devem coincidir.');
  }

  try {
    await executarSemIsolamento(async () => {
      const emailExistente = await User.findOne({ email: email.toLowerCase().trim() });
      if (emailExistente) {
        throw Object.assign(new Error('E-mail já em uso.'), { tratada: true, mensagem: 'Já existe uma conta com este e-mail.' });
      }

      const oficina = await Oficina.create({
        nome: nomeOficina.trim(),
        nicho,
        email: email.toLowerCase().trim()
      });

      await User.create({
        nome: nomeAdmin.trim(),
        email: email.toLowerCase().trim(),
        senha,
        perfil: 'administrador',
        oficina: oficina._id
      });
    });

    req.session.mensagemSucesso = 'Oficina criada com sucesso.';
    return res.redirect(`/${config.adminPath}`);
  } catch (err) {
    if (err.tratada) return erro(err.mensagem);
    return next(err);
  }
}

/**
 * Detalhe de uma oficina: dados dela + lista de usuários, pra permitir
 * ativar/desativar, trocar e-mail/senha de qualquer usuário, sem precisar
 * logar como aquela oficina.
 */
async function paginaOficina(req, res, next) {
  try {
    await executarSemIsolamento(async () => {
      const oficina = await Oficina.findById(req.params.id);
      if (!oficina) {
        req.session.mensagemErro = 'Oficina não encontrada.';
        return res.redirect(`/${config.adminPath}`);
      }
      const usuarios = await User.find({ oficina: oficina._id }).sort({ createdAt: 1 });
      return res.render('superadmin/oficina', { titulo: oficina.nome, oficina, usuarios });
    });
  } catch (err) {
    next(err);
  }
}

async function alternarStatusOficina(req, res, next) {
  try {
    await executarSemIsolamento(async () => {
      const oficina = await Oficina.findById(req.params.id);
      if (!oficina) {
        req.session.mensagemErro = 'Oficina não encontrada.';
        return res.redirect(`/${config.adminPath}`);
      }
      oficina.ativo = !oficina.ativo;
      await oficina.save();
      req.session.mensagemSucesso = `Oficina ${oficina.ativo ? 'ativada' : 'desativada'} com sucesso.`;
      return res.redirect(`/${config.adminPath}`);
    });
  } catch (err) {
    next(err);
  }
}

async function atualizarOficina(req, res, next) {
  try {
    const { nome, nicho, plano } = req.body;
    await executarSemIsolamento(async () => {
      const oficina = await Oficina.findById(req.params.id);
      if (!oficina) {
        req.session.mensagemErro = 'Oficina não encontrada.';
        return res.redirect(`/${config.adminPath}`);
      }
      if (nome) oficina.nome = nome;
      if (Oficina.NICHOS.includes(nicho)) oficina.nicho = nicho;
      if (Oficina.PLANOS.includes(plano)) oficina.plano = plano;
      await oficina.save();
      req.session.mensagemSucesso = 'Oficina atualizada com sucesso.';
      return res.redirect(`/${config.adminPath}/oficinas/${oficina._id}`);
    });
  } catch (err) {
    next(err);
  }
}

async function trocarEmailUsuario(req, res, next) {
  try {
    const { email } = req.body;
    if (!ehEmailValido(email)) {
      req.session.mensagemErro = 'E-mail inválido.';
      return res.redirect(`/${config.adminPath}/oficinas/${req.params.id}`);
    }
    await executarSemIsolamento(async () => {
      const emailExistente = await User.findOne({ email: email.toLowerCase().trim(), _id: { $ne: req.params.usuarioId } });
      if (emailExistente) {
        req.session.mensagemErro = 'Já existe outro usuário com este e-mail.';
        return res.redirect(`/${config.adminPath}/oficinas/${req.params.id}`);
      }
      const usuario = await User.findById(req.params.usuarioId);
      if (!usuario) {
        req.session.mensagemErro = 'Usuário não encontrado.';
        return res.redirect(`/${config.adminPath}/oficinas/${req.params.id}`);
      }
      usuario.email = email.toLowerCase().trim();
      await usuario.save();
      req.session.mensagemSucesso = `E-mail de ${usuario.nome} atualizado.`;
      return res.redirect(`/${config.adminPath}/oficinas/${req.params.id}`);
    });
  } catch (err) {
    next(err);
  }
}

async function trocarSenhaUsuario(req, res, next) {
  try {
    const { novaSenha } = req.body;
    if (!ehSenhaForte(novaSenha)) {
      req.session.mensagemErro = 'Senha fraca (mín. 8 caracteres, com maiúscula, minúscula e número).';
      return res.redirect(`/${config.adminPath}/oficinas/${req.params.id}`);
    }
    await executarSemIsolamento(async () => {
      const usuario = await User.findById(req.params.usuarioId);
      if (!usuario) {
        req.session.mensagemErro = 'Usuário não encontrado.';
        return res.redirect(`/${config.adminPath}/oficinas/${req.params.id}`);
      }
      usuario.senha = novaSenha;
      usuario.tentativasLogin = 0;
      usuario.bloqueadoAte = null;
      await usuario.save();
      req.session.mensagemSucesso = `Senha de ${usuario.nome} redefinida.`;
      return res.redirect(`/${config.adminPath}/oficinas/${req.params.id}`);
    });
  } catch (err) {
    next(err);
  }
}

async function alternarStatusUsuario(req, res, next) {
  try {
    await executarSemIsolamento(async () => {
      const usuario = await User.findById(req.params.usuarioId);
      if (!usuario) {
        req.session.mensagemErro = 'Usuário não encontrado.';
        return res.redirect(`/${config.adminPath}/oficinas/${req.params.id}`);
      }
      usuario.ativo = !usuario.ativo;
      await usuario.save();
      req.session.mensagemSucesso = `Usuário ${usuario.ativo ? 'ativado' : 'desativado'}.`;
      return res.redirect(`/${config.adminPath}/oficinas/${req.params.id}`);
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  paginaLogin,
  autenticar,
  sair,
  paginaDashboard,
  paginaNovaOficina,
  criarOficina,
  paginaOficina,
  alternarStatusOficina,
  atualizarOficina,
  trocarEmailUsuario,
  trocarSenhaUsuario,
  alternarStatusUsuario
};
