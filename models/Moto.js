const mongoose = require('mongoose');
const tenantPlugin = require('../utils/tenantPlugin');

// Este model representa o "veículo" atendido pela oficina. O nome do
// arquivo/model ficou "Moto" por razões históricas, mas com o campo `tipo`
// ele também comporta carros — o que muda são só alguns campos específicos
// (cilindrada para moto, portas/câmbio para carro) e os rótulos exibidos
// nas telas, que se adaptam ao nicho da oficina (ver Oficina.nicho).
const motoSchema = new mongoose.Schema(
  {
    tipo: { type: String, enum: ['carro', 'moto'], required: true, default: 'moto' },
    cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
    marca: { type: String, required: true, trim: true },
    modelo: { type: String, required: true, trim: true },
    ano: { type: Number },
    cor: { type: String, trim: true },
    placa: { type: String, required: true, trim: true, uppercase: true },
    chassi: { type: String, trim: true, uppercase: true },
    motor: { type: String, trim: true },
    quilometragem: { type: Number, default: 0 },
    // Específicos de moto
    cilindrada: { type: Number },
    // Específicos de carro
    numeroPortas: { type: Number },
    cambio: { type: String, enum: ['manual', 'automatico', 'cvt'] },
    combustivel: { type: String, enum: ['gasolina', 'etanol', 'flex', 'diesel', 'eletrico', 'hibrido'] },
    fotos: [{ type: String }],
    observacoes: { type: String, trim: true },
    ativo: { type: Boolean, default: true },
    criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

motoSchema.index({ cliente: 1 });
motoSchema.index({ oficina: 1, placa: 1 }, { unique: true });

motoSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Moto', motoSchema);
