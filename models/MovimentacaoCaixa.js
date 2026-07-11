const mongoose = require('mongoose');

const movimentacaoCaixaSchema = new mongoose.Schema(
  {
    caixa: { type: mongoose.Schema.Types.ObjectId, ref: 'Caixa', required: true },
    tipo: {
      type: String,
      enum: ['entrada', 'saida', 'sangria', 'reforco'],
      required: true
    },
    valor: { type: Number, required: true, min: 0.01 },
    formaPagamento: {
      type: String,
      enum: ['dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'boleto', 'transferencia'],
      required: true
    },
    descricao: { type: String, required: true, trim: true },
    venda: { type: mongoose.Schema.Types.ObjectId, ref: 'Venda' },
    ordemServico: { type: mongoose.Schema.Types.ObjectId, ref: 'OrdemServico' },
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

movimentacaoCaixaSchema.index({ caixa: 1, createdAt: -1 });

module.exports = mongoose.model('MovimentacaoCaixa', movimentacaoCaixaSchema);
