const OrdemServico = require('../models/OrdemServico');
const Cliente = require('../models/Cliente');
const Moto = require('../models/Moto');
const Peca = require('../models/Peca');
const User = require('../models/User');
const MovimentacaoEstoque = require('../models/MovimentacaoEstoque');
const Contador = require('../models/Contador');
const Configuracao = require('../models/Configuracao');
const config = require('../config/config');
const { gerarPdfOrdemServico } = require('../services/pdfService');
const { registrarAuditoria } = require('../utils/auditoria');
const {
  enfileirarNotificacao,
  montarMensagemMotoPronta,
  montarMensagemConfirmacaoServico,
  montarMensagemLinkAprovacao
} = require('../services/whatsappService');

async function listar(req, res, next) {
  try {
    const { status = '', busca = '', pagina = 1 } = req.query;
    const limite = 20;
    const filtro = {};
    if (status) filtro.status = status;

    let query = OrdemServico.find(filtro)
      .populate('cliente', 'nome telefone')
      .populate('moto', 'marca modelo placa')
      .populate('mecanico', 'nome')
      .sort({ createdAt: -1 });

    if (busca) {
      const clientesEncontrados = await Cliente.find({ nome: new RegExp(busca, 'i') }).select('_id');
      const motosEncontradas = await Moto.find({ placa: new RegExp(busca, 'i') }).select('_id');
      filtro.$or = [
        { cliente: { $in: clientesEncontrados.map((c) => c._id) } },
        { moto: { $in: motosEncontradas.map((m) => m._id) } }
      ];
      query = OrdemServico.find(filtro)
        .populate('cliente', 'nome telefone')
        .populate('moto', 'marca modelo placa')
        .populate('mecanico', 'nome')
        .sort({ createdAt: -1 });
    }

    const total = await OrdemServico.countDocuments(filtro);
    const ordens = await query.skip((pagina - 1) * limite).limit(limite);

    res.render('os/listar', {
      titulo: 'Ordens de Serviço',
      ordens,
      status,
      busca,
      statusLista: OrdemServico.STATUS_OS,
      paginaAtual: parseInt(pagina, 10),
      totalPaginas: Math.ceil(total / limite)
    });
  } catch (err) {
    next(err);
  }
}

async function formularioNovo(req, res, next) {
  try {
    const { clienteId } = req.query;
    const [clientes, mecanicos, pecas] = await Promise.all([
      Cliente.find({ ativo: true }).sort({ nome: 1 }),
      User.find({ perfil: 'mecanico', ativo: true }).sort({ nome: 1 }),
      Peca.find({ ativo: true }).sort({ nome: 1 })
    ]);
    let motos = [];
    if (clienteId) {
      motos = await Moto.find({ cliente: clienteId, ativo: true });
    }
    res.render('os/formulario', { titulo: 'Nova Ordem de Serviço', os: {}, clientes, mecanicos, pecas, motos, clienteSelecionado: clienteId || '', modo: 'criar' });
  } catch (err) {
    next(err);
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

/**
 * Busca LOCAL (no banco da própria oficina, não em API externa) de um
 * veículo já cadastrado pela placa. Usado no formulário de nova OS: o
 * mecânico/atendente digita a placa e, se o veículo já foi atendido
 * antes por essa oficina, o sistema já preenche cliente e veículo
 * automaticamente — sem precisar navegar pelos dois selects manualmente.
 *
 * A busca já é restrita à oficina do usuário logado (tenantPlugin), então
 * nunca encontra veículo de outra oficina.
 */
async function buscarPorPlacaLocal(req, res, next) {
  try {
    const placaLimpa = (req.params.placa || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!placaLimpa) {
      return res.status(400).json({ sucesso: false, mensagem: 'Informe uma placa.' });
    }

    const moto = await Moto.findOne({ placa: placaLimpa, ativo: true }).populate('cliente', 'nome');

    if (!moto || !moto.cliente) {
      return res.status(404).json({
        sucesso: false,
        mensagem: 'Nenhum veículo cadastrado com essa placa. Cadastre o cliente e o veículo primeiro, ou selecione manualmente abaixo.'
      });
    }

    return res.json({
      sucesso: true,
      veiculo: {
        _id: moto._id,
        placa: moto.placa,
        marca: moto.marca,
        modelo: moto.modelo,
        cliente: { _id: moto.cliente._id, nome: moto.cliente.nome }
      }
    });
  } catch (err) {
    return next(err);
  }
}

function normalizarItens(campo) {
  if (!campo) return [];
  return Array.isArray(campo) ? campo : [campo];
}

async function criar(req, res, next) {
  try {
    const { cliente, moto, problemaInformado, diagnostico, mecanico, desconto, quilometragemEntrada } = req.body;

    const pecaIds = normalizarItens(req.body.pecaId);
    const pecaQtds = normalizarItens(req.body.pecaQuantidade);
    const servicoDescricoes = normalizarItens(req.body.servicoDescricao);
    const servicoValores = normalizarItens(req.body.servicoValor);

    const checklistItens = normalizarItens(req.body.checklistItem);
    const checklistObservacoes = normalizarItens(req.body.checklistObservacao);

    // A situação (OK/Avaria) de cada item vem em campos com nome indexado
    // por linha (checklistSituacao_0, checklistSituacao_1...) e NÃO como
    // array posicional — porque radio buttons com o mesmo "name" formam
    // um único grupo no HTML, então cada linha do checklist precisa de um
    // nome próprio para não "roubar" a marcação das outras linhas.
    const itensChecklist = checklistItens.map((nomeItem, i) => ({
      item: nomeItem,
      situacao: req.body[`checklistSituacao_${i}`] === 'avaria' ? 'avaria' : 'ok',
      observacao: checklistObservacoes[i] || ''
    }));

    const fotosChecklist = (req.files || []).map((f) => `/uploads/checklist/${f.filename}`);
    const temChecklist = itensChecklist.length > 0 || fotosChecklist.length > 0 || req.body.checklistObservacoesGerais;

    const pecasUtilizadas = [];
    for (let i = 0; i < pecaIds.length; i += 1) {
      if (!pecaIds[i]) continue;
      // eslint-disable-next-line no-await-in-loop
      const pecaDoc = await Peca.findById(pecaIds[i]);
      if (!pecaDoc) continue;
      const quantidade = parseInt(pecaQtds[i], 10) || 1;
      pecasUtilizadas.push({ peca: pecaDoc._id, nome: pecaDoc.nome, quantidade, precoUnitario: pecaDoc.precoVenda });
    }

    const servicosRealizados = [];
    for (let i = 0; i < servicoDescricoes.length; i += 1) {
      if (!servicoDescricoes[i]) continue;
      servicosRealizados.push({ descricao: servicoDescricoes[i], valor: parseFloat(servicoValores[i]) || 0 });
    }

    const numero = await Contador.proximoValor(req.oficina._id, 'ordemServico');

    const os = await OrdemServico.create({
      numero,
      cliente,
      moto,
      problemaInformado,
      diagnostico,
      mecanico: mecanico || undefined,
      pecasUtilizadas,
      servicosRealizados,
      desconto: parseFloat(desconto) || 0,
      quilometragemEntrada: parseInt(quilometragemEntrada, 10) || undefined,
      criadoPor: req.usuario._id,
      historicoStatus: [{ status: 'recebida', usuario: req.usuario._id }],
      checklistEntrada: temChecklist
        ? {
            itens: itensChecklist,
            fotos: fotosChecklist,
            observacoesGerais: req.body.checklistObservacoesGerais || '',
            preenchidoEm: new Date()
          }
        : undefined
    });

    // Dá baixa no estoque das peças utilizadas
    for (const item of pecasUtilizadas) {
      // eslint-disable-next-line no-await-in-loop
      const pecaDoc = await Peca.findById(item.peca);
      if (!pecaDoc) continue;
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
        motivo: `Utilizada na OS Nº ${os.numero}`,
        ordemServico: os._id,
        usuario: req.usuario._id
      });
    }

    await registrarAuditoria(req, { modulo: 'ordensServico', acao: 'criar', referenciaId: os._id, descricao: `OS Nº ${os.numero} criada` });

    req.session.mensagemSucesso = `Ordem de Serviço Nº ${os.numero} criada com sucesso.`;
    return res.redirect(`/ordens-servico/${os._id}`);
  } catch (err) {
    return next(err);
  }
}

async function visualizar(req, res, next) {
  try {
    const os = await OrdemServico.findById(req.params.id)
      .populate('cliente')
      .populate('moto')
      .populate('mecanico', 'nome')
      .populate('historicoStatus.usuario', 'nome');
    if (!os) {
      req.session.mensagemErro = 'Ordem de Serviço não encontrada.';
      return res.redirect('/ordens-servico');
    }
    const linkPublico = `${config.appUrl}/acompanhar/${os.tokenPublico}`;
    return res.render('os/visualizar', { titulo: `OS Nº ${os.numero}`, os, statusLista: OrdemServico.STATUS_OS, linkPublico });
  } catch (err) {
    return next(err);
  }
}

async function atualizarStatus(req, res, next) {
  try {
    const { status, observacao } = req.body;
    const os = await OrdemServico.findById(req.params.id).populate('cliente').populate('moto');
    if (!os) {
      req.session.mensagemErro = 'Ordem de Serviço não encontrada.';
      return res.redirect('/ordens-servico');
    }

    if (!OrdemServico.STATUS_OS.includes(status)) {
      req.session.mensagemErro = 'Status inválido.';
      return res.redirect(`/ordens-servico/${os._id}`);
    }

    os.status = status;
    os.historicoStatus.push({ status, usuario: req.usuario._id, observacao });
    if (status === 'entregue') os.dataEntrega = new Date();
    // Reabre a aprovação: útil quando o mecânico ajusta o orçamento e manda
    // de novo — o cliente precisa aprovar a versão atualizada, não a antiga.
    if (status === 'aguardando_aprovacao') {
      os.aprovacaoStatus = 'pendente';
      os.aprovacaoData = undefined;
      os.aprovacaoObservacao = undefined;
    }
    await os.save();

    await registrarAuditoria(req, { modulo: 'ordensServico', acao: 'editar', referenciaId: os._id, descricao: `Status alterado para ${status}` });

    if (status === 'finalizada' && os.cliente?.whatsapp) {
      await enfileirarNotificacao({
        tipo: 'moto_pronta',
        cliente: os.cliente,
        ordemServico: os,
        destinatarioNome: os.cliente.nome,
        destinatarioTelefone: os.cliente.whatsapp,
        mensagem: montarMensagemMotoPronta(os.cliente, os.moto)
      });
    }

    if (status === 'aguardando_aprovacao' && os.cliente?.whatsapp) {
      const linkPublico = `${config.appUrl}/acompanhar/${os.tokenPublico}`;
      await enfileirarNotificacao({
        tipo: 'aprovacao_orcamento',
        cliente: os.cliente,
        ordemServico: os,
        destinatarioNome: os.cliente.nome,
        destinatarioTelefone: os.cliente.whatsapp,
        mensagem: montarMensagemLinkAprovacao(os.cliente, os, linkPublico)
      });
    }

    if (status === 'em_manutencao' && os.cliente?.whatsapp) {
      await enfileirarNotificacao({
        tipo: 'confirmacao_servico',
        cliente: os.cliente,
        ordemServico: os,
        destinatarioNome: os.cliente.nome,
        destinatarioTelefone: os.cliente.whatsapp,
        mensagem: montarMensagemConfirmacaoServico(os.cliente, os)
      });
    }

    req.session.mensagemSucesso = 'Status atualizado com sucesso.';
    return res.redirect(`/ordens-servico/${os._id}`);
  } catch (err) {
    return next(err);
  }
}

async function gerarPdf(req, res, next) {
  try {
    const os = await OrdemServico.findById(req.params.id).populate('cliente').populate('moto');
    if (!os) {
      req.session.mensagemErro = 'Ordem de Serviço não encontrada.';
      return res.redirect('/ordens-servico');
    }
    const configuracao = await Configuracao.findOne({ chave: 'geral' });
    return gerarPdfOrdemServico(os, configuracao, res);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listar,
  formularioNovo,
  buscarMotosPorCliente,
  buscarPorPlacaLocal,
  criar,
  visualizar,
  atualizarStatus,
  gerarPdf
};
