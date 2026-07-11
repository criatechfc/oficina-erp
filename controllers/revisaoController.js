const Revisao = require('../models/Revisao');
const Moto = require('../models/Moto');
const { registrarAuditoria } = require('../utils/auditoria');
const { enfileirarNotificacao, montarMensagemProximaRevisao } = require('../services/whatsappService');

async function listar(req, res, next) {
  try {
    const proximasRevisoes = await Revisao.find({ concluida: false })
      .populate({ path: 'moto', populate: { path: 'cliente', select: 'nome telefone whatsapp' } })
      .sort({ proximaData: 1 });

    res.render('os/revisoes', { titulo: 'Revisões de Motos', revisoes: proximasRevisoes, itensRevisao: Revisao.ITENS_REVISAO });
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const { moto, item, quilometragemRealizada, intervaloKm, observacoes, ordemServico } = req.body;

    const motoDoc = await Moto.findById(moto).populate('cliente');
    if (!motoDoc) {
      req.session.mensagemErro = 'Moto não encontrada.';
      return res.redirect('back');
    }

    const proximaQuilometragem = parseInt(quilometragemRealizada, 10) + parseInt(intervaloKm, 10);

    const revisao = await Revisao.create({
      moto,
      ordemServico: ordemServico || undefined,
      item,
      quilometragemRealizada: parseInt(quilometragemRealizada, 10),
      intervaloKm: parseInt(intervaloKm, 10),
      proximaQuilometragem,
      observacoes,
      criadoPor: req.usuario._id
    });

    if (motoDoc.cliente?.whatsapp) {
      await enfileirarNotificacao({
        tipo: 'proxima_revisao',
        cliente: motoDoc.cliente,
        destinatarioNome: motoDoc.cliente.nome,
        destinatarioTelefone: motoDoc.cliente.whatsapp,
        mensagem: montarMensagemProximaRevisao(motoDoc.cliente, motoDoc, revisao)
      });
    }

    await registrarAuditoria(req, { modulo: 'revisoes', acao: 'criar', referenciaId: revisao._id, descricao: `Revisão de ${item} registrada` });

    req.session.mensagemSucesso = 'Revisão registrada com sucesso.';
    return res.redirect(`/motos/${moto}`);
  } catch (err) {
    return next(err);
  }
}

async function concluir(req, res, next) {
  try {
    const revisao = await Revisao.findByIdAndUpdate(req.params.id, { concluida: true }, { new: true });
    await registrarAuditoria(req, { modulo: 'revisoes', acao: 'editar', referenciaId: revisao._id, descricao: 'Revisão marcada como concluída' });
    req.session.mensagemSucesso = 'Revisão marcada como concluída.';
    return res.redirect('/revisoes');
  } catch (err) {
    return next(err);
  }
}

module.exports = { listar, criar, concluir };
