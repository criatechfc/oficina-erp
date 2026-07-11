const Conta = require('../models/Conta');
const Fornecedor = require('../models/Fornecedor');
const Cliente = require('../models/Cliente');
const { v4: uuidv4 } = require('uuid');
const { registrarAuditoria } = require('../utils/auditoria');

async function marcarVencidas() {
  await Conta.updateMany(
    { status: 'pendente', vencimento: { $lt: new Date() } },
    { status: 'vencido' }
  );
}

async function pagina(req, res, next) {
  try {
    await marcarVencidas();
    const { tipo = 'pagar', status = '' } = req.query;
    const filtro = { tipo };
    if (status) filtro.status = status;

    const contas = await Conta.find(filtro)
      .populate('fornecedor', 'empresa')
      .populate('cliente', 'nome')
      .sort({ vencimento: 1 });

    const [totalPendentePagar, totalPendenteReceber] = await Promise.all([
      Conta.aggregate([{ $match: { tipo: 'pagar', status: { $in: ['pendente', 'vencido'] } } }, { $group: { _id: null, total: { $sum: '$valor' } } }]),
      Conta.aggregate([{ $match: { tipo: 'receber', status: { $in: ['pendente', 'vencido'] } } }, { $group: { _id: null, total: { $sum: '$valor' } } }])
    ]);

    res.render('financeiro/index', {
      titulo: 'Financeiro',
      contas,
      tipo,
      status,
      totalPendentePagar: totalPendentePagar[0]?.total || 0,
      totalPendenteReceber: totalPendenteReceber[0]?.total || 0
    });
  } catch (err) {
    next(err);
  }
}

async function formularioNovo(req, res, next) {
  try {
    const { tipo = 'pagar' } = req.query;
    const [fornecedores, clientes] = await Promise.all([
      Fornecedor.find({ ativo: true }).sort({ empresa: 1 }),
      Cliente.find({ ativo: true }).sort({ nome: 1 })
    ]);
    res.render('financeiro/formulario', { titulo: 'Nova Conta', conta: { tipo }, fornecedores, clientes });
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const { tipo, descricao, categoria, valor, vencimento, totalParcelas, fornecedor, cliente, observacoes } = req.body;
    const numParcelas = parseInt(totalParcelas, 10) || 1;
    const valorTotal = parseFloat(valor);
    const valorParcela = +(valorTotal / numParcelas).toFixed(2);
    const grupoParcelamento = numParcelas > 1 ? uuidv4() : undefined;

    const contasCriadas = [];
    for (let i = 0; i < numParcelas; i += 1) {
      const dataVencimento = new Date(vencimento);
      dataVencimento.setMonth(dataVencimento.getMonth() + i);

      // eslint-disable-next-line no-await-in-loop
      const conta = await Conta.create({
        tipo,
        descricao: numParcelas > 1 ? `${descricao} (${i + 1}/${numParcelas})` : descricao,
        categoria,
        valor: valorParcela,
        vencimento: dataVencimento,
        totalParcelas: numParcelas,
        parcelaAtual: i + 1,
        grupoParcelamento,
        fornecedor: fornecedor || undefined,
        cliente: cliente || undefined,
        observacoes,
        criadoPor: req.usuario._id
      });
      contasCriadas.push(conta);
    }

    await registrarAuditoria(req, { modulo: 'financeiro', acao: 'criar', descricao: `${numParcelas} conta(s) ${tipo} criada(s): ${descricao}` });

    req.session.mensagemSucesso = 'Conta cadastrada com sucesso.';
    return res.redirect(`/financeiro?tipo=${tipo}`);
  } catch (err) {
    return next(err);
  }
}

async function marcarPaga(req, res, next) {
  try {
    const conta = await Conta.findById(req.params.id);
    if (!conta) {
      req.session.mensagemErro = 'Conta não encontrada.';
      return res.redirect('/financeiro');
    }
    conta.status = 'pago';
    conta.valorPago = conta.valor;
    conta.dataPagamento = new Date();
    await conta.save();

    await registrarAuditoria(req, { modulo: 'financeiro', acao: 'editar', referenciaId: conta._id, descricao: `Conta "${conta.descricao}" marcada como paga` });

    req.session.mensagemSucesso = 'Conta marcada como paga.';
    return res.redirect(`/financeiro?tipo=${conta.tipo}`);
  } catch (err) {
    return next(err);
  }
}

async function cancelar(req, res, next) {
  try {
    const conta = await Conta.findByIdAndUpdate(req.params.id, { status: 'cancelado' }, { new: true });
    await registrarAuditoria(req, { modulo: 'financeiro', acao: 'excluir', referenciaId: conta._id, descricao: `Conta "${conta.descricao}" cancelada` });
    req.session.mensagemSucesso = 'Conta cancelada.';
    return res.redirect(`/financeiro?tipo=${conta.tipo}`);
  } catch (err) {
    return next(err);
  }
}

module.exports = { pagina, formularioNovo, criar, marcarPaga, cancelar };
