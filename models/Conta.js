const mongoose = require('mongoose');

const contaSchema = new mongoose.Schema(
  {
    tipo: { type: String, enum: ['pagar', 'receber'], required: true },
    descricao: { type: String, required: true, trim: true },
    categoria: { type: String, trim: true, required: true },
    valor: { type: Number, required: true, min: 0.01 },
    valorPago: { type: Number, default: 0 },
    vencimento: { type: Date, required: true },
    dataPagamento: { type: Date },
    status: { type: String, enum: ['pendente', 'pago', 'vencido', 'cancelado'], default: 'pendente' },
    parcelaAtual: { type: Number, default: 1 },
    totalParcelas: { type: Number, default: 1 },
    grupoParcelamento: { type: String },
    fornecedor: { type: mongoose.Schema.Types.ObjectId, ref: 'Fornecedor' },
    cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' },
    ordemServico: { type: mongoose.Schema.Types.ObjectId, ref: 'OrdemServico' },
    observacoes: { type: String, trim: true },
    criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

contaSchema.index({ tipo: 1, status: 1, vencimento: 1 });

module.exports = mongoose.model('Conta', contaSchema);
