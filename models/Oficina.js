const mongoose = require('mongoose');

const NICHOS = ['carro', 'moto', 'ambos'];
const PLANOS = ['gratis', 'basico', 'pro'];

const oficinaSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true, maxlength: 150 },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    nicho: { type: String, enum: NICHOS, required: true, default: 'ambos' },
    cnpj: { type: String, trim: true },
    telefone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    endereco: {
      logradouro: { type: String, trim: true },
      numero: { type: String, trim: true },
      bairro: { type: String, trim: true },
      cidade: { type: String, trim: true },
      estado: { type: String, trim: true, maxlength: 2, uppercase: true },
      cep: { type: String, trim: true }
    },
    logo: { type: String, default: null },
    corPrimaria: { type: String, default: '#1d4ed8' },
    plano: { type: String, enum: PLANOS, default: 'gratis' },
    ativo: { type: Boolean, default: true },
    trialExpiraEm: { type: Date, default: null }
  },
  { timestamps: true }
);

oficinaSchema.statics.NICHOS = NICHOS;
oficinaSchema.statics.PLANOS = PLANOS;

// Helpers de nicho, usados nas views para trocar rótulos "moto"/"carro"/"veículo"
// e decidir quais campos de formulário mostrar.
oficinaSchema.methods.aceitaMoto = function aceitaMoto() {
  return this.nicho === 'moto' || this.nicho === 'ambos';
};
oficinaSchema.methods.aceitaCarro = function aceitaCarro() {
  return this.nicho === 'carro' || this.nicho === 'ambos';
};

oficinaSchema.pre('validate', function gerarSlug(next) {
  if (!this.slug && this.nome) {
    this.slug = this.nome
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
      .concat('-', Math.random().toString(36).slice(2, 7));
  }
  next();
});

module.exports = mongoose.model('Oficina', oficinaSchema);
