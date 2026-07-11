const mongoose = require('mongoose');

const motoSchema = new mongoose.Schema(
  {
    cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
    marca: { type: String, required: true, trim: true },
    modelo: { type: String, required: true, trim: true },
    ano: { type: Number },
    cor: { type: String, trim: true },
    placa: { type: String, required: true, trim: true, uppercase: true, unique: true },
    chassi: { type: String, trim: true, uppercase: true },
    motor: { type: String, trim: true },
    quilometragem: { type: Number, default: 0 },
    fotos: [{ type: String }],
    observacoes: { type: String, trim: true },
    ativo: { type: Boolean, default: true },
    criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

motoSchema.index({ cliente: 1 });

module.exports = mongoose.model('Moto', motoSchema);
