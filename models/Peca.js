const mongoose = require('mongoose');
const tenantPlugin = require('../utils/tenantPlugin');

const pecaSchema = new mongoose.Schema(
  {
    codigo: { type: String, required: true, trim: true },
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
pecaSchema.index({ oficina: 1, codigo: 1 }, { unique: true });
// Código de barras é opcional, mas quando preenchido não pode repetir dentro
// da MESMA oficina (índice parcial: só entra na regra quando o campo existe
// e é string, então várias peças sem código de barras não conflitam entre si).
pecaSchema.index(
  { oficina: 1, codigoBarras: 1 },
  { unique: true, partialFilterExpression: { codigoBarras: { $type: 'string', $ne: '' } } }
);
pecaSchema.virtual('estoqueBaixo').get(function estoqueBaixo() {
  return this.quantidade <= this.estoqueMinimo;
});
pecaSchema.set('toJSON', { virtuals: true });
pecaSchema.set('toObject', { virtuals: true });

pecaSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Peca', pecaSchema);
