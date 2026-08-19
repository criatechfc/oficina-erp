const mongoose = require('mongoose');
const tenantPlugin = require('../utils/tenantPlugin');

// Observação: dados de identidade da oficina (nome, logo, nicho, endereço)
// agora moram no model Oficina. Este model guarda apenas preferências extras
// (tema, backup) por oficina.
const configuracaoSchema = new mongoose.Schema(
  {
    chave: { type: String, required: true, default: 'geral' },
    nomeOficina: { type: String, default: 'Minha Oficina' },
    logo: { type: String, default: null },
    telefone: { type: String, trim: true },
    whatsapp: { type: String, trim: true },
    email: { type: String, trim: true },
    endereco: { type: String, trim: true },
    tema: { type: String, enum: ['claro', 'escuro'], default: 'claro' },
    ultimoBackup: { type: Date }
  },
  { timestamps: true }
);

configuracaoSchema.index({ oficina: 1, chave: 1 }, { unique: true });

configuracaoSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Configuracao', configuracaoSchema);
