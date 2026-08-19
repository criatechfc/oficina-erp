const mongoose = require('mongoose');

/**
 * Cache de consultas de placa. Guardado no MongoDB (não só em memória) de
 * propósito: se o servidor reiniciar (deploy, crash, restart do processo),
 * um cache só em memória se perderia e a economia de requisições some
 * junto. Persistindo no banco, o cache sobrevive a reinícios.
 *
 * NÃO usa o tenantPlugin (multi-tenant) de propósito: os dados de uma
 * placa (marca/modelo/ano/cor) são os mesmos não importa qual oficina
 * consultou — não é dado sensível nem específico de negócio de uma
 * oficina. Compartilhar o cache entre todas as oficinas do sistema
 * economiza requisições de verdade (duas oficinas diferentes consultando
 * a mesma placa gastam só 1 requisição à API paga, não 2).
 *
 * `expiraEm` tem um índice TTL nativo do MongoDB: o próprio banco apaga o
 * documento automaticamente assim que a data passa — não precisa de
 * nenhum job/cron rodando no Node para limpar cache velho.
 */
const cachePlacaSchema = new mongoose.Schema(
  {
    placa: { type: String, required: true, unique: true, uppercase: true, trim: true },
    dados: { type: mongoose.Schema.Types.Mixed, required: true },
    expiraEm: { type: Date, required: true }
  },
  { timestamps: true }
);

cachePlacaSchema.index({ expiraEm: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('CachePlaca', cachePlacaSchema);
