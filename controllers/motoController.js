const Moto = require('../models/Moto');
const Cliente = require('../models/Cliente');
const OrdemServico = require('../models/OrdemServico');
const Revisao = require('../models/Revisao');
const { registrarAuditoria } = require('../utils/auditoria');

async function listar(req, res, next) {
  try {
    const { busca = '', pagina = 1 } = req.query;
    const limite = 20;
    const filtro = { ativo: true };

    if (busca) {
      filtro.$or = [{ placa: new RegExp(busca, 'i') }, { modelo: new RegExp(busca, 'i') }, { marca: new RegExp(busca, 'i') }];
    }

    const total = await Moto.countDocuments(filtro);
    const motos = await Moto.find(filtro)
      .populate('cliente', 'nome telefone')
      .sort({ createdAt: -1 })
      .skip((pagina - 1) * limite)
      .limit(limite);

    res.render('motos/listar', {
      titulo: 'Motos',
      motos,
      busca,
      paginaAtual: parseInt(pagina, 10),
      totalPaginas: Math.ceil(total / limite)
    });
  } catch (err) {
    next(err);
  }
}

async function formularioNovo(req, res, next) {
  try {
    const clientes = await Cliente.find({ ativo: true }).sort({ nome: 1 });
    res.render('motos/formulario', { titulo: 'Nova Moto', moto: {}, clientes, modo: 'criar' });
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const dados = req.body;
    const fotos = (req.files || []).map((f) => `/uploads/motos/${f.filename}`);

    const moto = await Moto.create({ ...dados, fotos, criadoPor: req.usuario._id });
    await registrarAuditoria(req, { modulo: 'motos', acao: 'criar', referenciaId: moto._id, descricao: `Moto ${moto.placa} cadastrada` });

    req.session.mensagemSucesso = 'Moto cadastrada com sucesso.';
    return res.redirect('/motos');
  } catch (err) {
    if (err.code === 11000) {
      req.session.mensagemErro = 'Já existe uma moto cadastrada com esta placa.';
      return res.redirect('/motos/novo');
    }
    return next(err);
  }
}

async function formularioEditar(req, res, next) {
  try {
    const [moto, clientes] = await Promise.all([
      Moto.findById(req.params.id),
      Cliente.find({ ativo: true }).sort({ nome: 1 })
    ]);
    if (!moto) {
      req.session.mensagemErro = 'Moto não encontrada.';
      return res.redirect('/motos');
    }
    return res.render('motos/formulario', { titulo: 'Editar Moto', moto, clientes, modo: 'editar' });
  } catch (err) {
    return next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const dados = req.body;
    const moto = await Moto.findById(req.params.id);
    if (!moto) {
      req.session.mensagemErro = 'Moto não encontrada.';
      return res.redirect('/motos');
    }

    if (req.files && req.files.length) {
      const novasFotos = req.files.map((f) => `/uploads/motos/${f.filename}`);
      moto.fotos = [...moto.fotos, ...novasFotos];
    }

    Object.assign(moto, dados);
    await moto.save();

    await registrarAuditoria(req, { modulo: 'motos', acao: 'editar', referenciaId: moto._id, descricao: `Moto ${moto.placa} atualizada` });

    req.session.mensagemSucesso = 'Moto atualizada com sucesso.';
    return res.redirect('/motos');
  } catch (err) {
    return next(err);
  }
}

async function remover(req, res, next) {
  try {
    const moto = await Moto.findByIdAndUpdate(req.params.id, { ativo: false }, { new: true });
    await registrarAuditoria(req, { modulo: 'motos', acao: 'excluir', referenciaId: moto._id, descricao: `Moto ${moto.placa} desativada` });
    req.session.mensagemSucesso = 'Moto removida com sucesso.';
    return res.redirect('/motos');
  } catch (err) {
    return next(err);
  }
}

async function visualizar(req, res, next) {
  try {
    const moto = await Moto.findById(req.params.id).populate('cliente');
    if (!moto) {
      req.session.mensagemErro = 'Moto não encontrada.';
      return res.redirect('/motos');
    }
    const [ordensServico, revisoes] = await Promise.all([
      OrdemServico.find({ moto: moto._id }).sort({ createdAt: -1 }),
      Revisao.find({ moto: moto._id }).sort({ dataRealizada: -1 })
    ]);
    return res.render('motos/visualizar', { titulo: `${moto.marca} ${moto.modelo}`, moto, ordensServico, revisoes });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listar, formularioNovo, criar, formularioEditar, atualizar, remover, visualizar };
