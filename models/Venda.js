const mongoose = require('mongoose');

const itemVendaSchema = new mongoose.Schema(
  {
    tipo: { type: String, enum: ['peca', 'servico'], required: true },
    peca: { type: mongoose.Schema.Types.ObjectId, ref: 'Peca' },
    descricao: { type: String, required: true, trim: true },
    quantidade: { type: Number, required: true, min: 1, default: 1 },
    precoUnitario: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const vendaSchema = new mongoose.Schema(
  {
    numero: { type: Number, required: true, unique: true },
    cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' },
    itens: [itemVendaSchema],
    subtotal: { type: Number, default: 0 },
    desconto: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    formaPagamento: {
      type: String,
      enum: ['dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'boleto', 'transferencia']
    },
    status: { type: String, enum: ['orcamento', 'confirmada', 'convertida_os', 'cancelada'], default: 'orcamento' },
    ordemServicoGerada: { type: mongoose.Schema.Types.ObjectId, ref: 'OrdemServico' },
    observacoes: { type: String, trim: true },
    vendedor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

vendaSchema.pre('validate', function calcularTotais(next) {
  this.subtotal = this.itens.reduce((soma, i) => soma + i.quantidade * i.precoUnitario, 0);
  this.total = Math.max(this.subtotal - (this.desconto || 0), 0);
  next();
});

vendaSchema.index({ status: 1 });

module.exports = mongoose.model('Venda', vendaSchema);
