require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config/config');
const fs = require('fs');
const path = require('path');

/**
 * Roda `Model.syncIndexes()` para todo model do sistema — cria os índices
 * que estão faltando e REMOVE os que não existem mais no schema (ex:
 * índices antigos de uma versão single-tenant, sem o campo `oficina`).
 *
 * Necessário porque em produção o Mongoose conecta com `autoIndex: false`
 * (config/database.js) — de propósito, pra não recriar índice toda vez que
 * o servidor reinicia. Isso significa que depois de qualquer deploy que
 * muda um índice (ex: esta migração para multi-oficina), esse script
 * precisa ser rodado manualmente uma vez.
 *
 * Uso: node scripts/sincronizarIndices.js
 */
async function main() {
  await mongoose.connect(config.mongoUri);
  console.log('[Índices] Conectado ao MongoDB.');

  const modelsDir = path.join(__dirname, '..', 'models');
  const arquivos = fs.readdirSync(modelsDir).filter((f) => f.endsWith('.js'));

  for (const arquivo of arquivos) {
    const Model = require(path.join(modelsDir, arquivo));
    if (!Model || typeof Model.syncIndexes !== 'function') continue;

    try {
      const resultado = await Model.syncIndexes();
      console.log(`[Índices] ${Model.modelName}: ok`, resultado.length ? `(removidos: ${resultado.join(', ')})` : '');
    } catch (err) {
      console.error(`[Índices] ${Model.modelName}: FALHOU ->`, err.message);
    }
  }

  await mongoose.disconnect();
  console.log('[Índices] Concluído.');
}

main().catch((err) => {
  console.error('[Índices] Erro geral:', err);
  process.exit(1);
});
