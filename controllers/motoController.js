const Moto = require('../models/Moto');
const Cliente = require('../models/Cliente');
const OrdemServico = require('../models/OrdemServico');
const Revisao = require('../models/Revisao');
const { registrarAuditoria } = require('../utils/auditoria');
const { buscarDadosPorPlaca, estaConfigurado } = require('../services/placaService');

function rotuloVeiculo(oficina, plural = false) {
  const nicho = oficina?.nicho || 'ambos';
  if (nicho === 'carro') return plural ? 'Carros' : 'Carro';
  if (nicho === 'moto') return plural ? 'Motos' : 'Moto';
  return plural ? 'Veículos' : 'Veículo';
}

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
      titulo: rotuloVeiculo(req.oficina, true),
      rotuloVeiculo: rotuloVeiculo(req.oficina),
      rotuloVeiculoPlural: rotuloVeiculo(req.oficina, true),
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
    res.render('motos/formulario', { titulo: `Novo(a) ${rotuloVeiculo(req.oficina)}`, rotuloVeiculo: rotuloVeiculo(req.oficina), moto: {}, clientes, modo: 'criar' });
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const dados = req.body;
    const fotos = (req.files || []).map((f) => `/uploads/motos/${f.filename}`);

    // Se a oficina atende só um nicho, o tipo do veículo é sempre esse
    // (evita depender de o formulário mandar o campo certo).
    if (req.oficina.nicho !== 'ambos') {
      dados.tipo = req.oficina.nicho;
    }

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
    return res.render('motos/formulario', { titulo: `Editar ${rotuloVeiculo(req.oficina)}`, rotuloVeiculo: rotuloVeiculo(req.oficina), moto, clientes, modo: 'editar' });
  } catch (err) {
    return next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const dados = req.body;
    if (req.oficina.nicho !== 'ambos') {
      dados.tipo = req.oficina.nicho;
    }
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

/**
 * Busca marca/modelo/ano/cor a partir da placa, via provedor terceirizado
 * configurado (ver services/placaService.js). Se não houver provedor
 * configurado no .env, avisa isso explicitamente em vez de simplesmente
 * falhar sem explicação — quem está cadastrando entende que precisa
 * continuar preenchendo manualmente.
 */
async function buscarPorPlaca(req, res, next) {
  try {
    if (!estaConfigurado()) {
      return res.status(200).json({
        sucesso: false,
        naoConfigurado: true,
        mensagem: 'Busca por placa não configurada nesta oficina. Preencha manualmente.'
      });
    }

    const dados = await buscarDadosPorPlaca(req.params.placa);
    if (!dados || !dados.encontrado) {
      return res.status(404).json({ sucesso: false, mensagem: 'Nenhum dado encontrado para esta placa.' });
    }

    return res.json({ sucesso: true, veiculo: dados });
  } catch (err) {
    // A integração falhou (provedor fora do ar, token inválido etc). Um
    // e-mail de alerta já foi disparado dentro de placaService.js — aqui
    // só devolvemos uma resposta amigável pro atendente continuar
    // trabalhando manualmente, em vez de quebrar a tela com erro 500.
    return res.status(200).json({
      sucesso: false,
      mensagem: 'A busca por placa está indisponível no momento. Preencha manualmente.'
    });
  }
}

module.exports = { listar, formularioNovo, criar, formularioEditar, atualizar, remover, visualizar, buscarPorPlaca };
