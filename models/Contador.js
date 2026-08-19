const mongoose = require('mongoose');

// Contador NÃO usa o tenantPlugin: a chave (_id) já embute a oficina, então
// o isolamento é feito manualmente aqui mesmo (mais simples e explícito para
// esse model, que é só um gerador de sequência numérica).
const contadorSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequencia: { type: Number, default: 0 }
});

// `nome` = 'ordemServico' | 'venda'. Cada oficina tem sua própria sequência
// (OS #1, #2... de uma oficina não colide com a de outra).
contadorSchema.statics.proximoValor = async function proximoValor(oficinaId, nome) {
  if (!oficinaId) {
    throw new Error('proximoValor requer o id da oficina.');
  }
  const chave = `${oficinaId}:${nome}`;
  const doc = await this.findByIdAndUpdate(
    chave,
    { $inc: { sequencia: 1 } },
    { new: true, upsert: true }
  );
  return doc.sequencia;
};

module.exports = mongoose.model('Contador', contadorSchema);
