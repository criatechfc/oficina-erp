require('dotenv').config();
const crypto = require('crypto');

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

// Painel do dono do sistema: duas camadas de segurança, as duas vindas só
// de variável de ambiente (nunca hardcoded no código):
//  1) ADMIN_PATH  — o caminho da URL (ex.: "painel-xyz123"). Não fica
//     linkado em lugar nenhum da aplicação, então só chega quem já sabe o
//     endereço exato.
//  2) ADMIN_SECRET — a senha exigida na tela desse caminho, mesmo que
//     alguém descubra a URL.
let adminPath = process.env.ADMIN_PATH;
if (!adminPath) {
  adminPath = `painel-${crypto.randomBytes(6).toString('hex')}`;
  console.warn('\n[AVISO] ADMIN_PATH não definido no .env.');
  console.warn(`[AVISO] Usando caminho temporário gerado agora: /${adminPath}`);
  console.warn('[AVISO] Ele muda a cada reinício do servidor. Defina ADMIN_PATH no .env em produção.\n');
}

let adminSecret = process.env.ADMIN_SECRET;
if (!adminSecret) {
  adminSecret = crypto.randomBytes(16).toString('hex');
  console.warn('[AVISO] ADMIN_SECRET não definido no .env.');
  console.warn(`[AVISO] Usando senha temporária gerada agora: ${adminSecret}`);
  console.warn('[AVISO] Ela muda a cada reinício do servidor. Defina ADMIN_SECRET no .env em produção.\n');
}

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  mongoUri: required('MONGO_URI'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  sessionSecret: required('SESSION_SECRET'),
  adminPath,
  adminSecret,
  appUrl: process.env.APP_URL || 'http://localhost:3000',
resend: {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM || 'Oficina ERP <onboarding@resend.dev>'
  },
  whatsapp: {
    apiUrl: process.env.WHATSAPP_API_URL || '',
    apiToken: process.env.WHATSAPP_API_TOKEN || ''
  },
  placaApi: {
    provedor: process.env.PLACA_API_PROVEDOR || 'apibrasil', // 'apibrasil' ou 'sinesp-local'
    bearerToken: process.env.PLACA_API_BEARER_TOKEN || '',
    // Opcional: algumas variações de API da APIBrasil exigem, outras não
    // (confirme na tela "Detalhes" da SUA API no marketplace). Se não
    // definir, o header simplesmente não é enviado.
    deviceToken: process.env.PLACA_API_DEVICE_TOKEN || '',
    // Tenta rodar em modo sandbox (sem cobrar), se o provedor suportar
    // isso na rota usada. Use para testar antes de gastar crédito real.
    homolog: process.env.PLACA_API_HOMOLOG === 'true',
    // Usado só quando provedor = 'sinesp-local': URL onde a
    // consultaplaca-api (github.com/yagoluiz/consultaplaca-api) está
    // rodando localmente, sem Docker (ver services/placaService.js).
    urlLocal: process.env.PLACA_API_URL_LOCAL || 'http://localhost:3001',
    // Por quantos dias o resultado de uma placa fica em cache antes de
    // consultar a API de novo (ver models/CachePlaca.js). Dados de
    // marca/modelo/ano raramente mudam, então um cache longo é seguro.
    cacheDias: parseInt(process.env.PLACA_API_CACHE_DIAS, 10) || 30,
    // Data em que o token atual foi configurado/trocado pela última vez
    // (formato AAAA-MM-DD). Usado só para o lembrete de rotação de
    // credenciais a cada 90 dias (ver utils/verificacaoCredenciais.js).
    // Atualize essa data toda vez que trocar o token.
    tokenDefinidoEm: process.env.PLACA_API_TOKEN_DEFINIDO_EM || null
  },
  alertas: {
    // Para onde mandar e-mail se alguma integração (ex.: busca de placa)
    // parar de funcionar. Usa o mesmo Resend já configurado acima — se
    // RESEND_API_KEY não estiver definida, o alerta simplesmente não é
    // enviado (o sistema continua funcionando normalmente).
    emailDestino: process.env.ALERTA_EMAIL_DESTINO || ''
  },
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5,
  isProduction: process.env.NODE_ENV === 'production'
};
