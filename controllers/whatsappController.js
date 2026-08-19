const baileysService = require('../services/whatsappBaileysService');

async function verStatus(req, res, next) {
  try {
    const status = baileysService.obterStatus(req.oficina._id);
    return res.render('whatsapp/status', { titulo: 'WhatsApp', ...status });
  } catch (err) {
    return next(err);
  }
}

async function statusJson(req, res, next) {
  try {
    const status = baileysService.obterStatus(req.oficina._id);
    return res.json(status);
  } catch (err) {
    return next(err);
  }
}

async function conectar(req, res, next) {
  try {
    await baileysService.conectar(req.oficina._id);
    return res.json({ sucesso: true });
  } catch (err) {
    return next(err);
  }
}

async function desconectar(req, res, next) {
  try {
    await baileysService.desconectar(req.oficina._id);
    req.session.mensagemSucesso = 'WhatsApp desconectado.';
    return res.redirect('/whatsapp');
  } catch (err) {
    return next(err);
  }
}

module.exports = { verStatus, statusJson, conectar, desconectar };
