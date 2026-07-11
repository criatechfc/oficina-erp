const mongoose = require('mongoose');

const STATUS_OS = [
  'recebida',
  'em_analise',
  'aguardando_aprovacao',
  'em_manutencao',
  'finalizada',
  'entregue',
  'cancelada'
];

const pecaUtilizadaSchema = new mongoose.Schema(
  {
    peca: { type: mongoose.Schema.Types.ObjectId, ref: 'Peca', required: true },
    nome: { type: String, required: true },
    quantidade: { type: Number, required: true, min: 1 },
    precoUnitario: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const servicoRealizadoSchema = new mongoose.Schema(
  {
    descricao: { type: String, required: true, trim: true },
    valor: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const historicoStatusSchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUS_OS, required: true },
    data: { type: Date, default: Date.now },
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    observacao: { type: String }
  },
  { _id: false }
);

const ordemServicoSchema = new mongoose.Schema(
  {
    numero: { type: Number, required: true, unique: true },
    cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
    moto: { type: mongoose.Schema.Types.ObjectId, ref: 'Moto', required: true },
    problemaInformado: { type: String, required: true, trim: true },
    diagnostico: { type: String, trim: true },
    pecasUtilizadas: [pecaUtilizadaSchema],
    servicosRealizados: [servicoRealizadoSchema],
    mecanico: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    valorPecas: { type: Number, default: 0 },
    valorMaoDeObra: { type: Number, default: 0 },
    desconto: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    status: { type: String, enum: STATUS_OS, default: 'recebida' },
    historicoStatus: [historicoStatusSchema],
    dataEntrega: { type: Date },
    quilometragemEntrada: { type: Number },
    criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

ordemServicoSchema.pre('validate', function calcularTotal(next) {
  this.valorPecas = this.pecasUtilizadas.reduce(
    (soma, p) => soma + p.quantidade * p.precoUnitario,
    0
  );
  this.valorMaoDeObra = this.servicosRealizados.reduce((soma, s) => soma + s.valor, 0);
  const bruto = this.valorPecas + this.valorMaoDeObra;
  this.total = Math.max(bruto - (this.desconto || 0), 0);
  next();
});

ordemServicoSchema.index({ status: 1 });
ordemServicoSchema.index({ cliente: 1 });
ordemServicoSchema.index({ moto: 1 });

ordemServicoSchema.statics.STATUS_OS = STATUS_OS;

module.exports = mongoose.model('OrdemServico', ordemServicoSchema);
