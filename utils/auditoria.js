const Auditoria = require('../models/Auditoria');

async function registrarAuditoria(req, { modulo, acao, referenciaId, descricao }) {
  try {
    await Auditoria.create({
      usuario: req.usuario?._id,
      modulo,
      acao,
      referenciaId,
      descricao,
      ip: req.ip
    });
  } catch (err) {
    console.error('[Auditoria] Falha ao registrar:', err.message);
  }
}

module.exports = { registrarAuditoria };
