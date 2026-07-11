const Caixa = require('../models/Caixa');
const MovimentacaoCaixa = require('../models/MovimentacaoCaixa');
const { registrarAuditoria } = require('../utils/auditoria');

async function calcularSaldo(caixaId, valorAbertura) {
  const movimentacoes = await MovimentacaoCaixa.find({ caixa: caixaId });
  const entradas = movimentacoes.filter((m) => ['entrada', 'reforco'].includes(m.tipo)).reduce((s, m) => s + m.valor, 0);
  const saidas = movimentacoes.filter((m) => ['saida', 'sangria'].includes(m.tipo)).reduce((s, m) => s + m.valor, 0);
  return { saldo: valorAbertura + entradas - saidas, entradas, saidas, movimentacoes };
}

async function pagina(req, res, next) {
  try {
    const caixaAberto = await Caixa.findOne({ status: 'aberto' }).populate('abertoPor', 'nome');
    let resumo = null;
    if (caixaAberto) {
      resumo = await calcularSaldo(caixaAberto._id, caixaAberto.valorAbertura);
      resumo.movimentacoes = await MovimentacaoCaixa.find({ caixa: caixaAberto._id })
        .populate('usuario', 'nome')
        .sort({ createdAt: -1 });
    }
    const historico = await Caixa.find({ status: 'fechado' })
      .sort({ fechamentoData: -1 })
      .limit(15)
      .populate('abertoPor', 'nome')
      .populate('fechadoPor', 'nome');

    res.render('caixa/index', { titulo: 'Caixa', caixaAberto, resumo, historico });
  } catch (err) {
    next(err);
  }
}

async function abrir(req, res, next) {
  try {
    const caixaExistente = await Caixa.findOne({ status: 'aberto' });
    if (caixaExistente) {
      req.session.mensagemErro = 'Já existe um caixa aberto.';
      return res.redirect('/caixa');
    }

    const { valorAbertura, observacoes } = req.body;
    const caixa = await Caixa.create({
      valorAbertura: parseFloat(valorAbertura) || 0,
      observacoes,
      abertoPor: req.usuario._id
    });

    await registrarAuditoria(req, { modulo: 'caixa', acao: 'criar', referenciaId: caixa._id, descricao: 'Caixa aberto' });

    req.session.mensagemSucesso = 'Caixa aberto com sucesso.';
    return res.redirect('/caixa');
  } catch (err) {
    return next(err);
  }
}

async function registrarMovimentacao(req, res, next) {
  try {
    const caixaAberto = await Caixa.findOne({ status: 'aberto' });
    if (!caixaAberto) {
      req.session.mensagemErro = 'Não há caixa aberto.';
      return res.redirect('/caixa');
    }

    const { tipo, valor, formaPagamento, descricao } = req.body;

    await MovimentacaoCaixa.create({
      caixa: caixaAberto._id,
      tipo,
      valor: parseFloat(valor),
      formaPagamento,
      descricao,
      usuario: req.usuario._id
    });

    await registrarAuditoria(req, { modulo: 'caixa', acao: 'criar', referenciaId: caixaAberto._id, descricao: `Movimentação ${tipo} de R$ ${valor}` });

    req.session.mensagemSucesso = 'Movimentação registrada com sucesso.';
    return res.redirect('/caixa');
  } catch (err) {
    return next(err);
  }
}

async function fechar(req, res, next) {
  try {
    const caixaAberto = await Caixa.findOne({ status: 'aberto' });
    if (!caixaAberto) {
      req.session.mensagemErro = 'Não há caixa aberto.';
      return res.redirect('/caixa');
    }

    const { valorFechamentoInformado, observacoes } = req.body;
    const { saldo } = await calcularSaldo(caixaAberto._id, caixaAberto.valorAbertura);

    caixaAberto.status = 'fechado';
    caixaAberto.fechamentoData = new Date();
    caixaAberto.valorFechamentoCalculado = saldo;
    caixaAberto.valorFechamentoInformado = parseFloat(valorFechamentoInformado) || 0;
    caixaAberto.diferenca = caixaAberto.valorFechamentoInformado - saldo;
    caixaAberto.fechadoPor = req.usuario._id;
    if (observacoes) caixaAberto.observacoes = `${caixaAberto.observacoes || ''}\n${observacoes}`.trim();

    await caixaAberto.save();

    await registrarAuditoria(req, { modulo: 'caixa', acao: 'editar', referenciaId: caixaAberto._id, descricao: 'Caixa fechado' });

    req.session.mensagemSucesso = 'Caixa fechado com sucesso.';
    return res.redirect('/caixa');
  } catch (err) {
    return next(err);
  }
}

module.exports = { pagina, abrir, registrarMovimentacao, fechar };
