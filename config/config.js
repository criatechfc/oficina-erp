require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  mongoUri: required('MONGO_URI'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  sessionSecret: required('SESSION_SECRET'),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'Oficina ERP <no-reply@oficina.com>'
  },
  whatsapp: {
    apiUrl: process.env.WHATSAPP_API_URL || '',
    apiToken: process.env.WHATSAPP_API_TOKEN || ''
  },
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5,
  isProduction: process.env.NODE_ENV === 'production'
};
