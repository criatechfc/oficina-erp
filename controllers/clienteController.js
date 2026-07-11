const Cliente = require('../models/Cliente');
const Moto = require('../models/Moto');
const OrdemServico = require('../models/OrdemServico');
const { ehCpfValido } = require('../utils/validacao');
const { registrarAuditoria } = require('../utils/auditoria');

async function listar(req, res, next) {
  try {
    const { busca = '', pagina = 1 } = req.query;
    const limite = 20;
    const filtro = { ativo: true };

    if (busca) {
      filtro.$or = [
        { nome: new RegExp(busca, 'i') },
        { cpf: new RegExp(busca, 'i') },
        { telefone: new RegExp(busca, 'i') },
        { email: new RegExp(busca, 'i') }
      ];
    }

    const total = await Cliente.countDocuments(filtro);
    const clientes = await Cliente.find(filtro)
      .sort({ nome: 1 })
      .skip((pagina - 1) * limite)
      .limit(limite);

    res.render('clientes/listar', {
      titulo: 'Clientes',
      clientes,
      busca,
      paginaAtual: parseInt(pagina, 10),
      totalPaginas: Math.ceil(total / limite)
    });
  } catch (err) {
    next(err);
  }
}

function formularioNovo(req, res) {
  res.render('clientes/formulario', { titulo: 'Novo Cliente', cliente: {}, modo: 'criar' });
}

async function criar(req, res, next) {
  try {
    const dados = req.body;

    if (dados.cpf && !ehCpfValido(dados.cpf)) {
      req.session.mensagemErro = 'CPF inválido.';
      return res.redirect('/clientes/novo');
    }

    const cliente = await Cliente.create({ ...dados, criadoPor: req.usuario._id });
    await registrarAuditoria(req, { modulo: 'clientes', acao: 'criar', referenciaId: cliente._id, descricao: `Cliente ${cliente.nome} criado` });

    req.session.mensagemSucesso = 'Cliente cadastrado com sucesso.';
    return res.redirect('/clientes');
  } catch (err) {
    if (err.code === 11000) {
      req.session.mensagemErro = 'Já existe um cliente com este CPF.';
      return res.redirect('/clientes/novo');
    }
    return next(err);
  }
}

async function formularioEditar(req, res, next) {
  try {
    const cliente = await Cliente.findById(req.params.id);
    if (!cliente) {
      req.session.mensagemErro = 'Cliente não encontrado.';
      return res.redirect('/clientes');
    }
    return res.render('clientes/formulario', { titulo: 'Editar Cliente', cliente, modo: 'editar' });
  } catch (err) {
    return next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const dados = req.body;

    if (dados.cpf && !ehCpfValido(dados.cpf)) {
      req.session.mensagemErro = 'CPF inválido.';
      return res.redirect(`/clientes/${req.params.id}/editar`);
    }

    const cliente = await Cliente.findByIdAndUpdate(req.params.id, dados, { new: true, runValidators: true });
    await registrarAuditoria(req, { modulo: 'clientes', acao: 'editar', referenciaId: cliente._id, descricao: `Cliente ${cliente.nome} atualizado` });

    req.session.mensagemSucesso = 'Cliente atualizado com sucesso.';
    return res.redirect('/clientes');
  } catch (err) {
    return next(err);
  }
}

async function remover(req, res, next) {
  try {
    const cliente = await Cliente.findByIdAndUpdate(req.params.id, { ativo: false }, { new: true });
    await registrarAuditoria(req, { modulo: 'clientes', acao: 'excluir', referenciaId: cliente._id, descricao: `Cliente ${cliente.nome} desativado` });
    req.session.mensagemSucesso = 'Cliente removido com sucesso.';
    return res.redirect('/clientes');
  } catch (err) {
    return next(err);
  }
}

async function visualizar(req, res, next) {
  try {
    const cliente = await Cliente.findById(req.params.id);
    if (!cliente) {
      req.session.mensagemErro = 'Cliente não encontrado.';
      return res.redirect('/clientes');
    }
    const [motos, ordensServico] = await Promise.all([
      Moto.find({ cliente: cliente._id, ativo: true }),
      OrdemServico.find({ cliente: cliente._id }).sort({ createdAt: -1 }).populate('moto', 'marca modelo placa')
    ]);
    return res.render('clientes/visualizar', { titulo: cliente.nome, cliente, motos, ordensServico });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listar, formularioNovo, criar, formularioEditar, atualizar, remover, visualizar };
