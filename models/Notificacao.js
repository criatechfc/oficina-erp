const mongoose = require('mongoose');
const tenantPlugin = require('../utils/tenantPlugin');

const notificacaoSchema = new mongoose.Schema(
  {
    tipo: {
      type: String,
      enum: ['moto_pronta', 'orcamento', 'aprovacao_orcamento', 'proxima_revisao', 'confirmacao_servico'],
      required: true
    },
    canal: { type: String, enum: ['whatsapp'], default: 'whatsapp' },
    destinatarioNome: { type: String, required: true },
    destinatarioTelefone: { type: String, required: true },
    mensagem: { type: String, required: true },
    cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' },
    ordemServico: { type: mongoose.Schema.Types.ObjectId, ref: 'OrdemServico' },
    status: { type: String, enum: ['pendente', 'enviada', 'falhou'], default: 'pendente' },
    erro: { type: String },
    enviadaEm: { type: Date }
  },
  { timestamps: true }
);

notificacaoSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Notificacao', notificacaoSchema);
