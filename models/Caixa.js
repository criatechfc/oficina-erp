const mongoose = require('mongoose');

const caixaSchema = new mongoose.Schema(
  {
    aberturaData: { type: Date, required: true, default: Date.now },
    fechamentoData: { type: Date },
    valorAbertura: { type: Number, required: true, default: 0 },
    valorFechamentoInformado: { type: Number },
    valorFechamentoCalculado: { type: Number },
    diferenca: { type: Number },
    status: { type: String, enum: ['aberto', 'fechado'], default: 'aberto' },
    abertoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fechadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    observacoes: { type: String, trim: true }
  },
  { timestamps: true }
);

caixaSchema.index({ status: 1 });
caixaSchema.index({ aberturaData: -1 });

module.exports = mongoose.model('Caixa', caixaSchema);
