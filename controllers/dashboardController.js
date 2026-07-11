const Cliente = require('../models/Cliente');
const Moto = require('../models/Moto');
const Peca = require('../models/Peca');
const OrdemServico = require('../models/OrdemServico');
const Conta = require('../models/Conta');
const Caixa = require('../models/Caixa');
const MovimentacaoCaixa = require('../models/MovimentacaoCaixa');

function inicioDoDia(data = new Date()) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function faturamentoPorPeriodo(dataInicio) {
  const resultado = await OrdemServico.aggregate([
    { $match: { status: { $in: ['finalizada', 'entregue'] }, updatedAt: { $gte: dataInicio } } },
    { $group: { _id: null, total: { $sum: '$total' } } }
  ]);
  return resultado[0]?.total || 0;
}

async function paginaDashboard(req, res, next) {
  try {
    const hoje = inicioDoDia();
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(inicioSemana.getDate() - 7);
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const inicioAno = new Date(hoje.getFullYear(), 0, 1);

    const [
      motosEmManutencao,
      totalClientes,
      totalPecas,
      pecasEstoqueBaixoDocs,
      servicosEmAndamento,
      contasPagarPendentes,
      contasReceberPendentes,
      caixaAberto,
      ultimasOs
    ] = await Promise.all([
      OrdemServico.countDocuments({ status: { $in: ['recebida', 'em_analise', 'aguardando_aprovacao', 'em_manutencao'] } }),
      Cliente.countDocuments({ ativo: true }),
      Peca.countDocuments({ ativo: true }),
      Peca.find({ ativo: true }).select('nome quantidade estoqueMinimo'),
      OrdemServico.countDocuments({ status: { $in: ['em_analise', 'em_manutencao'] } }),
      Conta.aggregate([
        { $match: { tipo: 'pagar', status: { $in: ['pendente', 'vencido'] } } },
        { $group: { _id: null, total: { $sum: '$valor' } } }
      ]),
      Conta.aggregate([
        { $match: { tipo: 'receber', status: { $in: ['pendente', 'vencido'] } } },
        { $group: { _id: null, total: { $sum: '$valor' } } }
      ]),
      Caixa.findOne({ status: 'aberto' }),
      OrdemServico.find().sort({ createdAt: -1 }).limit(8).populate('cliente', 'nome').populate('moto', 'marca modelo placa')
    ]);

    const estoqueBaixo = pecasEstoqueBaixoDocs.filter((p) => p.quantidade <= p.estoqueMinimo);

    let valorEmCaixa = 0;
    if (caixaAberto) {
      const movimentacoes = await MovimentacaoCaixa.find({ caixa: caixaAberto._id });
      const entradas = movimentacoes
        .filter((m) => ['entrada', 'reforco'].includes(m.tipo))
        .reduce((soma, m) => soma + m.valor, 0);
      const saidas = movimentacoes
        .filter((m) => ['saida', 'sangria'].includes(m.tipo))
        .reduce((soma, m) => soma + m.valor, 0);
      valorEmCaixa = caixaAberto.valorAbertura + entradas - saidas;
    }

    const [faturamentoDiario, faturamentoSemanal, faturamentoMensal, faturamentoAnual] = await Promise.all([
      faturamentoPorPeriodo(hoje),
      faturamentoPorPeriodo(inicioSemana),
      faturamentoPorPeriodo(inicioMes),
      faturamentoPorPeriodo(inicioAno)
    ]);

    // Faturamento dos últimos 7 dias para o gráfico
    const graficoDias = [];
    for (let i = 6; i >= 0; i -= 1) {
      const diaInicio = new Date(hoje);
      diaInicio.setDate(diaInicio.getDate() - i);
      const diaFim = new Date(diaInicio);
      diaFim.setDate(diaFim.getDate() + 1);
      // eslint-disable-next-line no-await-in-loop
      const resultado = await OrdemServico.aggregate([
        {
          $match: {
            status: { $in: ['finalizada', 'entregue'] },
            updatedAt: { $gte: diaInicio, $lt: diaFim }
          }
        },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]);
      graficoDias.push({
        label: diaInicio.toLocaleDateString('pt-BR', { weekday: 'short' }),
        valor: resultado[0]?.total || 0
      });
    }

    res.render('dashboard/index', {
      titulo: 'Dashboard',
      indicadores: {
        motosEmManutencao,
        totalClientes,
        totalPecas,
        valorEmCaixa,
        contasAPagar: contasPagarPendentes[0]?.total || 0,
        contasAReceber: contasReceberPendentes[0]?.total || 0,
        servicosEmAndamento,
        faturamentoDiario,
        faturamentoSemanal,
        faturamentoMensal,
        faturamentoAnual
      },
      estoqueBaixo,
      ultimasOs,
      caixaAberto: !!caixaAberto,
      graficoDias
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { paginaDashboard };
