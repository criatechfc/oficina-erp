const dns = require('node:dns');
const mongoose = require('mongoose');
const config = require('./config');

// Em algumas hospedagens (como o Render), a resolução de DNS prefere IPv6,
// o que pode causar falhas de handshake TLS ao conectar no MongoDB Atlas.
// Forçar IPv4 primeiro evita esse problema.
dns.setDefaultResultOrder('ipv4first');

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
