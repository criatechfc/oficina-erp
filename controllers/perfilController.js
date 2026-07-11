const User = require('../models/User');
const { ehSenhaForte } = require('../utils/validacao');
const { registrarAuditoria } = require('../utils/auditoria');
const LogAcesso = require('../models/LogAcesso');

function pagina(req, res) {
  res.render('perfil/index', { titulo: 'Meu Perfil' });
}

async function atualizarDados(req, res, next) {
  try {
    const { nome, telefone } = req.body;
    const usuario = await User.findById(req.usuario._id);
    usuario.nome = nome;
    usuario.telefone = telefone;

    if (req.file) {
      usuario.foto = `/uploads/perfil/${req.file.filename}`;
    }

    await usuario.save();
    await registrarAuditoria(req, { modulo: 'perfil', acao: 'editar', referenciaId: usuario._id, descricao: 'Dados de perfil atualizados' });

    req.session.mensagemSucesso = 'Perfil atualizado com sucesso.';
    return res.redirect('/perfil');
  } catch (err) {
    return next(err);
  }
}

async function alterarSenha(req, res, next) {
  try {
    const { senhaAtual, novaSenha, confirmarSenha } = req.body;
    const usuario = await User.findById(req.usuario._id).select('+senha');

    const senhaCorreta = await usuario.compararSenha(senhaAtual);
    if (!senhaCorreta) {
      req.session.mensagemErro = 'Senha atual incorreta.';
      return res.redirect('/perfil');
    }

    if (novaSenha !== confirmarSenha || !ehSenhaForte(novaSenha)) {
      req.session.mensagemErro = 'A nova senha deve ter ao menos 8 caracteres, com maiúscula, minúscula e número, e as senhas devem coincidir.';
      return res.redirect('/perfil');
    }

    usuario.senha = novaSenha;
    await usuario.save();

    await LogAcesso.create({ usuario: usuario._id, acao: 'senha_alterada', ip: req.ip, userAgent: req.headers['user-agent'] });

    req.session.mensagemSucesso = 'Senha alterada com sucesso.';
    return res.redirect('/perfil');
  } catch (err) {
    return next(err);
  }
}

module.exports = { pagina, atualizarDados, alterarSenha };
