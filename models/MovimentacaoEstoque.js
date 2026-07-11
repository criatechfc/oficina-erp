const mongoose = require('mongoose');

const movimentacaoEstoqueSchema = new mongoose.Schema(
  {
    peca: { type: mongoose.Schema.Types.ObjectId, ref: 'Peca', required: true },
    tipo: { type: String, enum: ['entrada', 'saida', 'ajuste_inventario'], required: true },
    quantidade: { type: Number, required: true },
    quantidadeAnterior: { type: Number, required: true },
    quantidadeNova: { type: Number, required: true },
    motivo: { type: String, trim: true },
    ordemServico: { type: mongoose.Schema.Types.ObjectId, ref: 'OrdemServico' },
    venda: { type: mongoose.Schema.Types.ObjectId, ref: 'Venda' },
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

movimentacaoEstoqueSchema.index({ peca: 1, createdAt: -1 });

module.exports = mongoose.model('MovimentacaoEstoque', movimentacaoEstoqueSchema);
