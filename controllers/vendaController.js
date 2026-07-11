const Venda = require('../models/Venda');
const Cliente = require('../models/Cliente');
const Peca = require('../models/Peca');
const Moto = require('../models/Moto');
const OrdemServico = require('../models/OrdemServico');
const Contador = require('../models/Contador');
const MovimentacaoEstoque = require('../models/MovimentacaoEstoque');
const MovimentacaoCaixa = require('../models/MovimentacaoCaixa');
const Caixa = require('../models/Caixa');
const { registrarAuditoria } = require('../utils/auditoria');

async function listar(req, res, next) {
  try {
    const { status = '', pagina = 1 } = req.query;
    const limite = 20;
    const filtro = {};
    if (status) filtro.status = status;

    const total = await Venda.countDocuments(filtro);
    const vendas = await Venda.find(filtro)
      .populate('cliente', 'nome')
      .populate('vendedor', 'nome')
      .sort({ createdAt: -1 })
      .skip((pagina - 1) * limite)
      .limit(limite);

    res.render('vendas/listar', { titulo: 'Vendas', vendas, status, paginaAtual: parseInt(pagina, 10), totalPaginas: Math.ceil(total / limite) });
  } catch (err) {
    next(err);
  }
}

async function formularioNovo(req, res, next) {
  try {
    const [clientes, pecas] = await Promise.all([
      Cliente.find({ ativo: true }).sort({ nome: 1 }),
      Peca.find({ ativo: true }).sort({ nome: 1 })
    ]);
    res.render('vendas/formulario', { titulo: 'Nova Venda / Orçamento', clientes, pecas });
  } catch (err) {
    next(err);
  }
}

function normalizar(campo) {
  if (!campo) return [];
  return Array.isArray(campo) ? campo : [campo];
}

async function criar(req, res, next) {
  try {
    const { cliente, desconto, formaPagamento, observacoes, finalizarComoVenda } = req.body;

    const tipos = normalizar(req.body.itemTipo);
    const descricoes = normalizar(req.body.itemDescricao);
    const quantidades = normalizar(req.body.itemQuantidade);
    const precos = normalizar(req.body.itemPreco);
    const pecaIds = normalizar(req.body.itemPecaId);

    const itens = tipos.map((tipo, i) => ({
      tipo,
      peca: pecaIds[i] || undefined,
      descricao: descricoes[i],
      quantidade: parseInt(quantidades[i], 10) || 1,
      precoUnitario: parseFloat(precos[i]) || 0
    })).filter((i) => i.descricao);

    const numero = await Contador.proximoValor('venda');

    const venda = await Venda.create({
      numero,
      cliente: cliente || undefined,
      itens,
      desconto: parseFloat(desconto) || 0,
      formaPagamento: formaPagamento || undefined,
      status: finalizarComoVenda === '1' ? 'confirmada' : 'orcamento',
      observacoes,
      vendedor: req.usuario._id
    });

    if (venda.status === 'confirmada') {
      await efetivarVenda(venda, req.usuario);
    }

    await registrarAuditoria(req, { modulo: 'vendas', acao: 'criar', referenciaId: venda._id, descricao: `Venda/Orçamento Nº ${venda.numero} criado` });

    req.session.mensagemSucesso = `${venda.status === 'confirmada' ? 'Venda' : 'Orçamento'} Nº ${venda.numero} criado com sucesso.`;
    return res.redirect(`/vendas/${venda._id}`);
  } catch (err) {
    return next(err);
  }
}

async function efetivarVenda(venda, usuario) {
  // Baixa estoque das peças vendidas
  for (const item of venda.itens) {
    if (item.tipo === 'peca' && item.peca) {
      // eslint-disable-next-line no-await-in-loop
      const pecaDoc = await Peca.findById(item.peca);
      if (pecaDoc) {
        const quantidadeAnterior = pecaDoc.quantidade;
        pecaDoc.quantidade = Math.max(pecaDoc.quantidade - item.quantidade, 0);
        // eslint-disable-next-line no-await-in-loop
        await pecaDoc.save();
        // eslint-disable-next-line no-await-in-loop
        await MovimentacaoEstoque.create({
          peca: pecaDoc._id,
          tipo: 'saida',
          quantidade: item.quantidade,
          quantidadeAnterior,
          quantidadeNova: pecaDoc.quantidade,
          motivo: `Venda Nº ${venda.numero}`,
          venda: venda._id,
          usuario: usuario._id
        });
      }
    }
  }

  // Lança entrada no caixa aberto, se houver
  const caixaAberto = await Caixa.findOne({ status: 'aberto' });
  if (caixaAberto && venda.total > 0) {
    await MovimentacaoCaixa.create({
      caixa: caixaAberto._id,
      tipo: 'entrada',
      valor: venda.total,
      formaPagamento: venda.formaPagamento || 'dinheiro',
      descricao: `Venda Nº ${venda.numero}`,
      venda: venda._id,
      usuario: usuario._id
    });
  }
}

async function visualizar(req, res, next) {
  try {
    const venda = await Venda.findById(req.params.id).populate('cliente').populate('vendedor', 'nome');
    if (!venda) {
      req.session.mensagemErro = 'Venda não encontrada.';
      return res.redirect('/vendas');
    }
    res.render('vendas/visualizar', { titulo: `Venda Nº ${venda.numero}`, venda });
  } catch (err) {
    next(err);
  }
}

async function confirmar(req, res, next) {
  try {
    const venda = await Venda.findById(req.params.id);
    if (!venda || venda.status !== 'orcamento') {
      req.session.mensagemErro = 'Este orçamento não pode ser confirmado.';
      return res.redirect('/vendas');
    }
    venda.status = 'confirmada';
    if (req.body.formaPagamento) venda.formaPagamento = req.body.formaPagamento;
    await venda.save();
    await efetivarVenda(venda, req.usuario);

    await registrarAuditoria(req, { modulo: 'vendas', acao: 'editar', referenciaId: venda._id, descricao: `Orçamento Nº ${venda.numero} confirmado como venda` });

    req.session.mensagemSucesso = 'Orçamento confirmado como venda.';
    return res.redirect(`/vendas/${venda._id}`);
  } catch (err) {
    return next(err);
  }
}

async function converterEmOS(req, res, next) {
  try {
    const venda = await Venda.findById(req.params.id).populate('cliente');
    const { motoId } = req.body;

    if (!venda || !motoId) {
      req.session.mensagemErro = 'Selecione a moto para converter em Ordem de Serviço.';
      return res.redirect(`/vendas/${req.params.id}`);
    }

    const numero = await Contador.proximoValor('ordemServico');

    const pecasUtilizadas = venda.itens
      .filter((i) => i.tipo === 'peca')
      .map((i) => ({ peca: i.peca, nome: i.descricao, quantidade: i.quantidade, precoUnitario: i.precoUnitario }));

    const servicosRealizados = venda.itens
      .filter((i) => i.tipo === 'servico')
      .map((i) => ({ descricao: i.descricao, valor: i.precoUnitario * i.quantidade }));

    const os = await OrdemServico.create({
      numero,
      cliente: venda.cliente._id,
      moto: motoId,
      problemaInformado: `Convertido do orçamento Nº ${venda.numero}`,
      pecasUtilizadas,
      servicosRealizados,
      desconto: venda.desconto,
      criadoPor: req.usuario._id,
      historicoStatus: [{ status: 'recebida', usuario: req.usuario._id }]
    });

    venda.status = 'convertida_os';
    venda.ordemServicoGerada = os._id;
    await venda.save();

    await registrarAuditoria(req, { modulo: 'vendas', acao: 'editar', referenciaId: venda._id, descricao: `Convertido em OS Nº ${os.numero}` });

    req.session.mensagemSucesso = `Convertido em Ordem de Serviço Nº ${os.numero}.`;
    return res.redirect(`/ordens-servico/${os._id}`);
  } catch (err) {
    return next(err);
  }
}

async function buscarMotosPorCliente(req, res, next) {
  try {
    const motos = await Moto.find({ cliente: req.params.clienteId, ativo: true }).select('marca modelo placa');
    res.json({ sucesso: true, motos });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, formularioNovo, criar, visualizar, confirmar, converterEmOS, buscarMotosPorCliente };
