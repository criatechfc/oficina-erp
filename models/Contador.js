const mongoose = require('mongoose');

const contadorSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequencia: { type: Number, default: 0 }
});

contadorSchema.statics.proximoValor = async function proximoValor(nome) {
  const doc = await this.findByIdAndUpdate(
    nome,
    { $inc: { sequencia: 1 } },
    { new: true, upsert: true }
  );
  return doc.sequencia;
};

module.exports = mongoose.model('Contador', contadorSchema);
