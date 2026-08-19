const mongoose = require('mongoose');
const tenantPlugin = require('../utils/tenantPlugin');

const auditoriaSchema = new mongoose.Schema(
  {
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    modulo: { type: String, required: true },
    acao: { type: String, required: true }, // criar, editar, excluir, etc
    referenciaId: { type: mongoose.Schema.Types.ObjectId },
    descricao: { type: String },
    ip: { type: String }
  },
  { timestamps: true }
);

auditoriaSchema.index({ createdAt: -1 });
auditoriaSchema.index({ modulo: 1 });

auditoriaSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Auditoria', auditoriaSchema);
