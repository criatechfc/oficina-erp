const mongoose = require('mongoose');

const configuracaoSchema = new mongoose.Schema(
  {
    chave: { type: String, required: true, unique: true, default: 'geral' },
    nomeOficina: { type: String, default: 'Minha Oficina de Motos' },
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

module.exports = mongoose.model('Configuracao', configuracaoSchema);
