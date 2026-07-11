const mongoose = require('mongoose');

const logAcessoSchema = new mongoose.Schema(
  {
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    emailTentativa: { type: String },
    acao: {
      type: String,
      enum: [
        'login_sucesso',
        'login_falha',
        'logout',
        'senha_alterada',
        'senha_recuperada',
        'conta_bloqueada',
        'acesso_negado'
      ],
      required: true
    },
    ip: { type: String },
    userAgent: { type: String },
    detalhes: { type: String }
  },
  { timestamps: true }
);

logAcessoSchema.index({ createdAt: -1 });

module.exports = mongoose.model('LogAcesso', logAcessoSchema);
