const mongoose = require('mongoose');

// LogAcesso registra tentativas de login ANTES de sabermos com certeza a
// oficina (ex: e-mail digitado errado, usuário não encontrado) — por isso,
// diferente dos outros models, ele NÃO usa o tenantPlugin (que exigiria
// oficina obrigatória e filtraria automaticamente por um contexto que,
// nesse momento da requisição, ainda não existe). O campo `oficina` aqui é
// opcional e preenchido manualmente quando já sabemos a qual usuário/oficina
// a tentativa se refere (ver controllers/authController.js).
const logAcessoSchema = new mongoose.Schema(
  {
    oficina: { type: mongoose.Schema.Types.ObjectId, ref: 'Oficina', index: true },
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
