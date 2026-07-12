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
resend: {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM || 'Oficina ERP <onboarding@resend.dev>'
  },
  whatsapp: {
    apiUrl: process.env.WHATSAPP_API_URL || '',
    apiToken: process.env.WHATSAPP_API_TOKEN || ''
  },
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5,
  isProduction: process.env.NODE_ENV === 'production'
};
