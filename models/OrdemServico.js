const mongoose = require('mongoose');
const crypto = require('crypto');
const tenantPlugin = require('../utils/tenantPlugin');

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

// Itens padrão verificados na entrada do veículo. "avaria" cobre qualquer
// coisa que já vinha danificada/faltando ANTES do atendimento — registrar
// isso na entrada protege a oficina de disputa tipo "esse risco não tinha
// antes de eu deixar aqui".
const itemChecklistSchema = new mongoose.Schema(
  {
    item: { type: String, required: true, trim: true },
    situacao: { type: String, enum: ['ok', 'avaria'], default: 'ok' },
    observacao: { type: String, trim: true }
  },
  { _id: false }
);

const checklistEntradaSchema = new mongoose.Schema(
  {
    itens: [itemChecklistSchema],
    fotos: [{ type: String }],
    observacoesGerais: { type: String, trim: true },
    preenchidoEm: { type: Date }
  },
  { _id: false }
);

const ordemServicoSchema = new mongoose.Schema(
  {
    numero: { type: Number, required: true },
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
    checklistEntrada: checklistEntradaSchema,
    dataEntrega: { type: Date },
    quilometragemEntrada: { type: Number },
    criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Link público (portal do cliente): usado tanto para o cliente
    // acompanhar o status em tempo real quanto para aprovar/recusar o
    // orçamento pelo celular, sem precisar de login. O token é aleatório
    // (não sequencial, não adivinhável) e único globalmente — quem tem o
    // link só enxerga ESTA ordem de serviço, nunca dados de outra oficina.
    tokenPublico: { type: String, unique: true, index: true },
    aprovacaoStatus: { type: String, enum: ['pendente', 'aprovado', 'recusado'], default: 'pendente' },
    aprovacaoData: { type: Date },
    aprovacaoObservacao: { type: String, trim: true }
  },
  { timestamps: true }
);

ordemServicoSchema.pre('validate', function gerarTokenPublico(next) {
  if (!this.tokenPublico) {
    this.tokenPublico = crypto.randomBytes(20).toString('hex');
  }
  next();
});

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
ordemServicoSchema.index({ oficina: 1, numero: 1 }, { unique: true });

ordemServicoSchema.statics.STATUS_OS = STATUS_OS;

ordemServicoSchema.plugin(tenantPlugin);

module.exports = mongoose.model('OrdemServico', ordemServicoSchema);
