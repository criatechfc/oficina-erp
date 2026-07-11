const mongoose = require('mongoose');

const pecaSchema = new mongoose.Schema(
  {
    codigo: { type: String, required: true, trim: true, unique: true },
    codigoBarras: { type: String, trim: true },
    nome: { type: String, required: true, trim: true },
    categoria: { type: String, trim: true },
    fornecedor: { type: mongoose.Schema.Types.ObjectId, ref: 'Fornecedor' },
    marca: { type: String, trim: true },
    descricao: { type: String, trim: true },
    quantidade: { type: Number, required: true, default: 0, min: 0 },
    estoqueMinimo: { type: Number, required: true, default: 0, min: 0 },
    precoCusto: { type: Number, required: true, default: 0, min: 0 },
    precoVenda: { type: Number, required: true, default: 0, min: 0 },
    localizacao: { type: String, trim: true },
    fotos: [{ type: String }],
    ativo: { type: Boolean, default: true },
    criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

pecaSchema.index({ nome: 'text', codigo: 'text', codigoBarras: 'text' });
pecaSchema.virtual('estoqueBaixo').get(function estoqueBaixo() {
  return this.quantidade <= this.estoqueMinimo;
});
pecaSchema.set('toJSON', { virtuals: true });
pecaSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Peca', pecaSchema);
