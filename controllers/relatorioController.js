const Cliente = require('../models/Cliente');
const Moto = require('../models/Moto');
const Peca = require('../models/Peca');
const OrdemServico = require('../models/OrdemServico');
const Conta = require('../models/Conta');
const MovimentacaoCaixa = require('../models/MovimentacaoCaixa');
const Caixa = require('../models/Caixa');
const User = require('../models/User');
const { exportarExcel } = require('../services/excelService');

function pagina(req, res) {
  res.render('relatorios/index', { titulo: 'Relatórios' });
}

async function relatorioClientes(req, res, next) {
  try {
    const clientes = await Cliente.find({ ativo: true }).sort({ nome: 1 });
    if (req.query.exportar === 'excel') {
      return exportarExcel(
        res,
        'relatorio-clientes',
        'Clientes',
        [
          { header: 'Nome', key: 'nome', width: 30 },
          { header: 'CPF', key: 'cpf', width: 18 },
          { header: 'Telefone', key: 'telefone', width: 18 },
          { header: 'Email', key: 'email', width: 28 },
          { header: 'Cidade', key: 'cidade', width: 20 }
        ],
        clientes.map((c) => ({ nome: c.nome, cpf: c.cpf, telefone: c.telefone, email: c.email, cidade: c.cidade }))
      );
    }
    return res.render('relatorios/clientes', { titulo: 'Relatório de Clientes', clientes });
  } catch (err) {
    return next(err);
  }
}

async function relatorioMotos(req, res, next) {
  try {
    const motos = await Moto.find({ ativo: true }).populate('cliente', 'nome').sort({ marca: 1 });
    if (req.query.exportar === 'excel') {
      return exportarExcel(
        res,
        'relatorio-motos',
        'Motos',
        [
          { header: 'Placa', key: 'placa', width: 14 },
          { header: 'Marca', key: 'marca', width: 18 },
          { header: 'Modelo', key: 'modelo', width: 20 },
          { header: 'Cliente', key: 'cliente', width: 28 },
          { header: 'KM', key: 'km', width: 12 }
        ],
        motos.map((m) => ({ placa: m.placa, marca: m.marca, modelo: m.modelo, cliente: m.cliente?.nome, km: m.quilometragem }))
      );
    }
    return res.render('relatorios/motos', { titulo: 'Relatório de Motos', motos });
  } catch (err) {
    return next(err);
  }
}

async function relatorioEstoque(req, res, next) {
  try {
    const pecas = await Peca.find({ ativo: true }).sort({ nome: 1 });
    if (req.query.exportar === 'excel') {
      return exportarExcel(
        res,
        'relatorio-estoque',
        'Estoque',
        [
          { header: 'Código', key: 'codigo', width: 14 },
          { header: 'Nome', key: 'nome', width: 30 },
          { header: 'Quantidade', key: 'quantidade', width: 14 },
          { header: 'Estoque Mínimo', key: 'estoqueMinimo', width: 16 },
          { header: 'Preço Custo', key: 'precoCusto', width: 14 },
          { header: 'Preço Venda', key: 'precoVenda', width: 14 }
        ],
        pecas.map((p) => ({ codigo: p.codigo, nome: p.nome, quantidade: p.quantidade, estoqueMinimo: p.estoqueMinimo, precoCusto: p.precoCusto, precoVenda: p.precoVenda }))
      );
    }
    return res.render('relatorios/estoque', { titulo: 'Relatório de Estoque', pecas });
  } catch (err) {
    return next(err);
  }
}

async function relatorioFinanceiro(req, res, next) {
  try {
    const contas = await Conta.find().populate('fornecedor', 'empresa').populate('cliente', 'nome').sort({ vencimento: -1 }).limit(500);
    if (req.query.exportar === 'excel') {
      return exportarExcel(
        res,
        'relatorio-financeiro',
        'Financeiro',
        [
          { header: 'Tipo', key: 'tipo', width: 12 },
          { header: 'Descrição', key: 'descricao', width: 30 },
          { header: 'Categoria', key: 'categoria', width: 18 },
          { header: 'Valor', key: 'valor', width: 14 },
          { header: 'Vencimento', key: 'vencimento', width: 14 },
          { header: 'Status', key: 'status', width: 12 }
        ],
        contas.map((c) => ({ tipo: c.tipo, descricao: c.descricao, categoria: c.categoria, valor: c.valor, vencimento: c.vencimento?.toLocaleDateString('pt-BR'), status: c.status }))
      );
    }
    return res.render('relatorios/financeiro', { titulo: 'Relatório Financeiro', contas });
  } catch (err) {
    return next(err);
  }
}

async function relatorioServicos(req, res, next) {
  try {
    const ordens = await OrdemServico.find({ status: { $in: ['finalizada', 'entregue'] } })
      .populate('cliente', 'nome')
      .populate('moto', 'placa modelo')
      .populate('mecanico', 'nome')
      .sort({ updatedAt: -1 })
      .limit(500);
    if (req.query.exportar === 'excel') {
      return exportarExcel(
        res,
        'relatorio-servicos',
        'Serviços',
        [
          { header: 'Nº OS', key: 'numero', width: 10 },
          { header: 'Cliente', key: 'cliente', width: 26 },
          { header: 'Moto', key: 'moto', width: 20 },
          { header: 'Mecânico', key: 'mecanico', width: 20 },
          { header: 'Total', key: 'total', width: 14 }
        ],
        ordens.map((o) => ({ numero: o.numero, cliente: o.cliente?.nome, moto: `${o.moto?.modelo} (${o.moto?.placa})`, mecanico: o.mecanico?.nome, total: o.total }))
      );
    }
    return res.render('relatorios/servicos', { titulo: 'Relatório de Serviços', ordens });
  } catch (err) {
    return next(err);
  }
}

async function relatorioMecanicos(req, res, next) {
  try {
    const resultado = await OrdemServico.aggregate([
      { $match: { status: { $in: ['finalizada', 'entregue'] }, mecanico: { $ne: null } } },
      { $group: { _id: '$mecanico', totalServicos: { $sum: 1 }, valorGerado: { $sum: '$total' } } },
      { $sort: { valorGerado: -1 } }
    ]);
    const mecanicos = await User.populate(resultado, { path: '_id', select: 'nome' });
    return res.render('relatorios/mecanicos', { titulo: 'Relatório de Mecânicos', mecanicos });
  } catch (err) {
    return next(err);
  }
}

async function relatorioLucro(req, res, next) {
  try {
    const ordens = await OrdemServico.find({ status: { $in: ['finalizada', 'entregue'] } });
    let custoTotal = 0;
    let receitaTotal = 0;

    for (const os of ordens) {
      receitaTotal += os.total;
      for (const item of os.pecasUtilizadas) {
        // eslint-disable-next-line no-await-in-loop
        const peca = await Peca.findById(item.peca).select('precoCusto');
        if (peca) custoTotal += peca.precoCusto * item.quantidade;
      }
    }

    const lucroBruto = receitaTotal - custoTotal;
    return res.render('relatorios/lucro', { titulo: 'Relatório de Lucro', receitaTotal, custoTotal, lucroBruto });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  pagina,
  relatorioClientes,
  relatorioMotos,
  relatorioEstoque,
  relatorioFinanceiro,
  relatorioServicos,
  relatorioMecanicos,
  relatorioLucro
};
