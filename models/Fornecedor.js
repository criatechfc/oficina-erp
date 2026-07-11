const mongoose = require('mongoose');

const fornecedorSchema = new mongoose.Schema(
  {
    empresa: { type: String, required: true, trim: true },
    contato: { type: String, trim: true },
    telefone: { type: String, trim: true },
    whatsapp: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    cnpj: { type: String, trim: true, unique: true, sparse: true },
    endereco: { type: String, trim: true },
    produtosFornecidos: { type: String, trim: true },
    ativo: { type: Boolean, default: true },
    criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

fornecedorSchema.index({ empresa: 'text', cnpj: 'text' });

module.exports = mongoose.model('Fornecedor', fornecedorSchema);
