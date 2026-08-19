const dns = require('node:dns');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const config = require('./config');

// Em algumas hospedagens (como o Render), a resolução de DNS prefere IPv6,
// o que pode causar falhas de handshake TLS ao conectar no MongoDB Atlas.
// Forçar IPv4 primeiro evita esse problema.
dns.setDefaultResultOrder('ipv4first');

/**
 * Cria/ajusta os índices de todos os models a partir do schema atual —
 * necessário porque a conexão usa `autoIndex: false` em produção (evita
 * recriar índice toda vez que o servidor reinicia, o que seria lento).
 *
 * Isso roda automaticamente uma vez a cada boot do servidor (ver abaixo),
 * então funciona mesmo em hospedagens sem acesso a shell (Render free,
 * por exemplo) — não precisa rodar comando manual depois de um deploy que
 * muda um índice.
 */
async function sincronizarIndices() {
  const modelsDir = path.join(__dirname, '..', 'models');
  const arquivos = fs.readdirSync(modelsDir).filter((f) => f.endsWith('.js'));

  for (const arquivo of arquivos) {
    const Model = require(path.join(modelsDir, arquivo));
    if (!Model || typeof Model.syncIndexes !== 'function') continue;
    try {
      await Model.syncIndexes();
    } catch (err) {
      // Não derruba o boot do servidor por causa disso — só avisa. Um
      // índice desatualizado quebra funcionalidades específicas, não a
      // aplicação inteira.
      console.error(`[MongoDB] Falha ao sincronizar índices de ${Model.modelName}:`, err.message);
    }
  }
}

async function connectDatabase() {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => {
    console.log('[MongoDB] Conectado com sucesso.');
  });

  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] Erro de conexão:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Desconectado.');
  });

  await mongoose.connect(config.mongoUri, {
    autoIndex: !config.isProduction
  });

  if (config.isProduction) {
    console.log('[MongoDB] Sincronizando índices...');
    await sincronizarIndices();
    console.log('[MongoDB] Índices sincronizados.');
  }

  return mongoose.connection;
}

module.exports = connectDatabase;
