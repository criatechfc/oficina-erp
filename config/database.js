const mongoose = require('mongoose');
const config = require('./config');

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

  return mongoose.connection;
}

module.exports = connectDatabase;
