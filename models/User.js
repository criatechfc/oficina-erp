const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const PERFIS = ['administrador', 'gerente', 'atendente', 'caixa', 'mecanico'];

const userSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    senha: { type: String, required: true, select: false },
    perfil: { type: String, enum: PERFIS, required: true, default: 'atendente' },
    telefone: { type: String, trim: true },
    foto: { type: String, default: null },
    ativo: { type: Boolean, default: true },
    ultimoLogin: { type: Date, default: null },
    tentativasLogin: { type: Number, default: 0 },
    bloqueadoAte: { type: Date, default: null },
    resetSenhaToken: { type: String, select: false },
    resetSenhaExpira: { type: Date, select: false }
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('senha')) return next();
  const salt = await bcrypt.genSalt(12);
  this.senha = await bcrypt.hash(this.senha, salt);
  next();
});

userSchema.methods.compararSenha = function compararSenha(senhaDigitada) {
  return bcrypt.compare(senhaDigitada, this.senha);
};

userSchema.methods.gerarTokenReset = function gerarTokenReset() {
  const token = crypto.randomBytes(32).toString('hex');
  this.resetSenhaToken = crypto.createHash('sha256').update(token).digest('hex');
  this.resetSenhaExpira = Date.now() + 60 * 60 * 1000; // 1 hora
  return token;
};

userSchema.methods.estaBloqueado = function estaBloqueado() {
  return !!(this.bloqueadoAte && this.bloqueadoAte > Date.now());
};

userSchema.statics.PERFIS = PERFIS;

module.exports = mongoose.model('User', userSchema);
