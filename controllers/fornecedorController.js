const Fornecedor = require('../models/Fornecedor');
const { registrarAuditoria } = require('../utils/auditoria');

async function listar(req, res, next) {
  try {
    const { busca = '', pagina = 1 } = req.query;
    const limite = 20;
    const filtro = { ativo: true };
    if (busca) {
      filtro.$or = [{ empresa: new RegExp(busca, 'i') }, { cnpj: new RegExp(busca, 'i') }];
    }
    const total = await Fornecedor.countDocuments(filtro);
    const fornecedores = await Fornecedor.find(filtro)
      .sort({ empresa: 1 })
      .skip((pagina - 1) * limite)
      .limit(limite);

    res.render('fornecedores/listar', {
      titulo: 'Fornecedores',
      fornecedores,
      busca,
      paginaAtual: parseInt(pagina, 10),
      totalPaginas: Math.ceil(total / limite)
    });
  } catch (err) {
    next(err);
  }
}

function formularioNovo(req, res) {
  res.render('fornecedores/formulario', { titulo: 'Novo Fornecedor', fornecedor: {}, modo: 'criar' });
}

async function criar(req, res, next) {
  try {
    const fornecedor = await Fornecedor.create({ ...req.body, criadoPor: req.usuario._id });
    await registrarAuditoria(req, { modulo: 'fornecedores', acao: 'criar', referenciaId: fornecedor._id, descricao: `Fornecedor ${fornecedor.empresa} criado` });
    req.session.mensagemSucesso = 'Fornecedor cadastrado com sucesso.';
    return res.redirect('/fornecedores');
  } catch (err) {
    if (err.code === 11000) {
      req.session.mensagemErro = 'Já existe um fornecedor com este CNPJ.';
      return res.redirect('/fornecedores/novo');
    }
    return next(err);
  }
}

async function formularioEditar(req, res, next) {
  try {
    const fornecedor = await Fornecedor.findById(req.params.id);
    if (!fornecedor) {
      req.session.mensagemErro = 'Fornecedor não encontrado.';
      return res.redirect('/fornecedores');
    }
    return res.render('fornecedores/formulario', { titulo: 'Editar Fornecedor', fornecedor, modo: 'editar' });
  } catch (err) {
    return next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const fornecedor = await Fornecedor.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    await registrarAuditoria(req, { modulo: 'fornecedores', acao: 'editar', referenciaId: fornecedor._id, descricao: `Fornecedor ${fornecedor.empresa} atualizado` });
    req.session.mensagemSucesso = 'Fornecedor atualizado com sucesso.';
    return res.redirect('/fornecedores');
  } catch (err) {
    return next(err);
  }
}

async function remover(req, res, next) {
  try {
    const fornecedor = await Fornecedor.findByIdAndUpdate(req.params.id, { ativo: false }, { new: true });
    await registrarAuditoria(req, { modulo: 'fornecedores', acao: 'excluir', referenciaId: fornecedor._id, descricao: `Fornecedor ${fornecedor.empresa} desativado` });
    req.session.mensagemSucesso = 'Fornecedor removido com sucesso.';
    return res.redirect('/fornecedores');
  } catch (err) {
    return next(err);
  }
}

module.exports = { listar, formularioNovo, criar, formularioEditar, atualizar, remover };
