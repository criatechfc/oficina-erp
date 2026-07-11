const mongoose = require('mongoose');

const ITENS_REVISAO = [
  'troca_oleo',
  'filtro',
  'pastilhas',
  'relacao',
  'velas',
  'pneus',
  'freios',
  'suspensao',
  'correia',
  'corrente'
];

const revisaoSchema = new mongoose.Schema(
  {
    moto: { type: mongoose.Schema.Types.ObjectId, ref: 'Moto', required: true },
    ordemServico: { type: mongoose.Schema.Types.ObjectId, ref: 'OrdemServico' },
    item: { type: String, enum: ITENS_REVISAO, required: true },
    quilometragemRealizada: { type: Number, required: true },
    dataRealizada: { type: Date, required: true, default: Date.now },
    intervaloKm: { type: Number, required: true }, // a cada quantos km repetir
    proximaQuilometragem: { type: Number, required: true },
    proximaData: { type: Date },
    observacoes: { type: String, trim: true },
    concluida: { type: Boolean, default: false },
    criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

revisaoSchema.index({ moto: 1, item: 1 });
revisaoSchema.statics.ITENS_REVISAO = ITENS_REVISAO;

module.exports = mongoose.model('Revisao', revisaoSchema);
