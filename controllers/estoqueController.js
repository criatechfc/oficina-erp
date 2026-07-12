const Peca = require('../models/Peca');
const Fornecedor = require('../models/Fornecedor');
const MovimentacaoEstoque = require('../models/MovimentacaoEstoque');
const { registrarAuditoria } = require('../utils/auditoria');

async function listar(req, res, next) {
  try {
    const { busca = '', apenasEstoqueBaixo = '', pagina = 1 } = req.query;
    const limite = 20;
    const filtro = { ativo: true };

    if (busca) {
      filtro.$or = [{ nome: new RegExp(busca, 'i') }, { codigo: new RegExp(busca, 'i') }, { codigoBarras: new RegExp(busca, 'i') }];
    }

    let pecas = await Peca.find(filtro).populate('fornecedor', 'empresa').sort({ nome: 1 });

    if (apenasEstoqueBaixo === '1') {
      pecas = pecas.filter((p) => p.quantidade <= p.estoqueMinimo);
    }

    const total = pecas.length;
    const inicio = (pagina - 1) * limite;
    const pecasPaginadas = pecas.slice(inicio, inicio + limite);

    res.render('estoque/listar', {
      titulo: 'Estoque',
      pecas: pecasPaginadas,
      busca,
      apenasEstoqueBaixo,
      paginaAtual: parseInt(pagina, 10),
      totalPaginas: Math.ceil(total / limite)
    });
  } catch (err) {
    next(err);
  }
}

async function formularioNovo(req, res, next) {
  try {
    const fornecedores = await Fornecedor.find({ ativo: true }).sort({ empresa: 1 });
    res.render('estoque/formulario', { titulo: 'Nova Peça', peca: {}, fornecedores, modo: 'criar' });
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const dados = req.body;
    const fotos = (req.files || []).map((f) => `/uploads/pecas/${f.filename}`);

    const peca = await Peca.create({
      ...dados,
      fornecedor: dados.fornecedor || undefined,
      quantidade: parseInt(dados.quantidade, 10) || 0,
      estoqueMinimo: parseInt(dados.estoqueMinimo, 10) || 0,
      precoCusto: parseFloat(dados.precoCusto) || 0,
      precoVenda: parseFloat(dados.precoVenda) || 0,
      fotos,
      criadoPor: req.usuario._id
    });

    if (peca.quantidade > 0) {
      await MovimentacaoEstoque.create({
        peca: peca._id,
        tipo: 'entrada',
        quantidade: peca.quantidade,
        quantidadeAnterior: 0,
        quantidadeNova: peca.quantidade,
        motivo: 'Cadastro inicial',
        usuario: req.usuario._id
      });
    }

    await registrarAuditoria(req, { modulo: 'estoque', acao: 'criar', referenciaId: peca._id, descricao: `Peça ${peca.nome} cadastrada` });

    req.session.mensagemSucesso = 'Peça cadastrada com sucesso.';
    return res.redirect('/estoque');
  } catch (err) {
    if (err.code === 11000) {
      req.session.mensagemErro = 'Já existe uma peça com este código.';
      return res.redirect('/estoque/novo');
    }
    return next(err);
  }
}

async function formularioEditar(req, res, next) {
  try {
    const [peca, fornecedores] = await Promise.all([
      Peca.findById(req.params.id),
      Fornecedor.find({ ativo: true }).sort({ empresa: 1 })
    ]);
    if (!peca) {
      req.session.mensagemErro = 'Peça não encontrada.';
      return res.redirect('/estoque');
    }
    return res.render('estoque/formulario', { titulo: 'Editar Peça', peca, fornecedores, modo: 'editar' });
  } catch (err) {
    return next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const dados = req.body;
    const peca = await Peca.findById(req.params.id);
    if (!peca) {
      req.session.mensagemErro = 'Peça não encontrada.';
      return res.redirect('/estoque');
    }

    if (req.files && req.files.length) {
      const novasFotos = req.files.map((f) => `/uploads/pecas/${f.filename}`);
      peca.fotos = [...peca.fotos, ...novasFotos];
    }

    ['codigo', 'codigoBarras', 'nome', 'categoria', 'marca', 'descricao', 'localizacao'].forEach((campo) => {
      if (dados[campo] !== undefined) peca[campo] = dados[campo];
    });
    if (dados.fornecedor !== undefined) peca.fornecedor = dados.fornecedor || null;
    peca.estoqueMinimo = parseInt(dados.estoqueMinimo, 10) || 0;
    peca.precoCusto = parseFloat(dados.precoCusto) || 0;
    peca.precoVenda = parseFloat(dados.precoVenda) || 0;

    await peca.save();

    await registrarAuditoria(req, { modulo: 'estoque', acao: 'editar', referenciaId: peca._id, descricao: `Peça ${peca.nome} atualizada` });

    req.session.mensagemSucesso = 'Peça atualizada com sucesso.';
    return res.redirect('/estoque');
  } catch (err) {
    return next(err);
  }
}

async function remover(req, res, next) {
  try {
    const peca = await Peca.findByIdAndUpdate(req.params.id, { ativo: false }, { new: true });
    await registrarAuditoria(req, { modulo: 'estoque', acao: 'excluir', referenciaId: peca._id, descricao: `Peça ${peca.nome} desativada` });
    req.session.mensagemSucesso = 'Peça removida com sucesso.';
    return res.redirect('/estoque');
  } catch (err) {
    return next(err);
  }
}

async function movimentar(req, res, next) {
  try {
    const { tipo, quantidade, motivo } = req.body;
    const peca = await Peca.findById(req.params.id);
    if (!peca) {
      req.session.mensagemErro = 'Peça não encontrada.';
      return res.redirect('/estoque');
    }

    const qtd = parseInt(quantidade, 10);
    if (!qtd || qtd <= 0) {
      req.session.mensagemErro = 'Quantidade inválida.';
      return res.redirect(`/estoque/${peca._id}/editar`);
    }

    const quantidadeAnterior = peca.quantidade;

    if (tipo === 'entrada') {
      peca.quantidade += qtd;
    } else if (tipo === 'saida') {
      peca.quantidade = Math.max(peca.quantidade - qtd, 0);
    } else if (tipo === 'ajuste_inventario') {
      peca.quantidade = qtd;
    }

    await peca.save();

    await MovimentacaoEstoque.create({
      peca: peca._id,
      tipo,
      quantidade: qtd,
      quantidadeAnterior,
      quantidadeNova: peca.quantidade,
      motivo: motivo || 'Movimentação manual',
      usuario: req.usuario._id
    });

    await registrarAuditoria(req, { modulo: 'estoque', acao: 'editar', referenciaId: peca._id, descricao: `Movimentação de estoque: ${tipo} (${qtd})` });

    req.session.mensagemSucesso = 'Movimentação registrada com sucesso.';
    return res.redirect(`/estoque/${peca._id}/editar`);
  } catch (err) {
    return next(err);
  }
}

async function historico(req, res, next) {
  try {
    const peca = await Peca.findById(req.params.id);
    const movimentacoes = await MovimentacaoEstoque.find({ peca: req.params.id })
      .populate('usuario', 'nome')
      .sort({ createdAt: -1 })
      .limit(100);
    res.render('estoque/historico', { titulo: `Histórico - ${peca.nome}`, peca, movimentacoes });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, formularioNovo, criar, formularioEditar, atualizar, remover, movimentar, historico };
