const mongoose = require('mongoose');

const clienteSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true, maxlength: 150 },
    cpf: { type: String, trim: true, unique: true, sparse: true },
    rg: { type: String, trim: true },
    telefone: { type: String, trim: true },
    whatsapp: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    endereco: { type: String, trim: true },
    cidade: { type: String, trim: true },
    estado: { type: String, trim: true, maxlength: 2, uppercase: true },
    cep: { type: String, trim: true },
    observacoes: { type: String, trim: true },
    ativo: { type: Boolean, default: true },
    criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

clienteSchema.index({ nome: 'text', cpf: 'text', telefone: 'text' });

module.exports = mongoose.model('Cliente', clienteSchema);
