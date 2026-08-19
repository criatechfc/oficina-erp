const express = require('express');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoSanitize = require('express-mongo-sanitize');
const methodOverride = require('method-override');

const expressLayouts = require('express-ejs-layouts');

const config = require('./config/config');
const connectDatabase = require('./config/database');
const { limiteGeral } = require('./middlewares/rateLimiters');
const { exigirAutenticacao } = require('./middlewares/auth');
const { injetarLocals, injetarConfiguracaoOficina } = require('./middlewares/viewLocals');
const { paginaNaoEncontrada, tratadorErros } = require('./middlewares/errorHandler');
const { podeAcessar } = require('./utils/permissoes');
const { rotuloStatusOS, rotuloStatusVenda, rotuloStatusRevisao, rotuloItemRevisao } = require('./utils/statusLabels');
const { formatarCpf, formatarCnpj } = require('./utils/validacao');

const authRoutes = require('./routes/authRoutes');
const superadminRoutes = require('./routes/superadminRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const clienteRoutes = require('./routes/clienteRoutes');
const motoRoutes = require('./routes/motoRoutes');
const osRoutes = require('./routes/osRoutes');
const revisaoRoutes = require('./routes/revisaoRoutes');
const estoqueRoutes = require('./routes/estoqueRoutes');
const fornecedorRoutes = require('./routes/fornecedorRoutes');
const caixaRoutes = require('./routes/caixaRoutes');
const financeiroRoutes = require('./routes/financeiroRoutes');
const vendaRoutes = require('./routes/vendaRoutes');
const relatorioRoutes = require('./routes/relatorioRoutes');
const perfilRoutes = require('./routes/perfilRoutes');
const configRoutes = require('./routes/configRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');

const app = express();

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Segurança HTTP
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
        // O Helmet mantém "script-src-attr" separado de "script-src" e o
        // padrão dele é 'none', o que bloqueia silenciosamente todo atributo
        // inline (onclick, onchange) usado nas telas de OS, Vendas e
        // Financeiro. Sem isso liberado, esses cliques/seleções não fazem
        // nada e não aparece nenhum erro no console de rede — só um aviso
        // de CSP, fácil de passar despercebido.
scriptSrcAttr: ["'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'https://cdnjs.cloudflare.com']
      }
    }
  })
);

// Permissions-Policy: permite câmera só pro próprio site (usada no leitor
// de código de barras e no QR code de aprovação da OS), mas continua
// bloqueando de terceiros/iframes externos. Microfone e geolocalização
// continuam bloqueados — o sistema não usa nenhum dos dois.
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  next();
});

app.use(compression());
app.use(morgan(config.isProduction ? 'combined' : 'dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(methodOverride('_method'));
app.use(limiteGeral);

app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: config.mongoUri, ttl: 60 * 60 }),
    cookie: {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000
    }
  })
);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// CSRF é aplicado depois dos arquivos estáticos e antes das rotas de formulário
const { csrfProtection } = require('./middlewares/csrf');
app.use((req, res, next) => {
  // Requisições multipart/form-data (formulários com upload de foto: motos,
  // estoque, perfil, configurações) ainda não tiveram o body processado pelo
  // multer neste ponto, então o campo _csrf não está disponível ainda.
  // Para essas rotas, o csrfProtection é aplicado depois do multer, na
  // própria definição da rota (ver motoRoutes, estoqueRoutes, perfilRoutes,
  // configRoutes). Para todas as outras (JSON/urlencoded), valida aqui.
  if (req.is('multipart/form-data')) {
    return next();
  }
  return csrfProtection(req, res, next);
});
app.use(injetarLocals);

// Disponibiliza helper de permissões nas views
app.use((req, res, next) => {
  res.locals.podeAcessar = podeAcessar;
  res.locals.rotuloStatusOS = rotuloStatusOS;
  res.locals.rotuloStatusVenda = rotuloStatusVenda;
  res.locals.rotuloStatusRevisao = rotuloStatusRevisao;
  res.locals.rotuloItemRevisao = rotuloItemRevisao;
  res.locals.formatarCpf = formatarCpf;
  res.locals.formatarCnpj = formatarCnpj;
  next();
});
// Endpoint de "saúde" — público, leve, sem autenticação. Serve pra dois
// propósitos:
//   1) Serviços de monitoramento/ping externo (ex.: UptimeRobot) baterem
//      aqui pra manter o servidor acordado em hospedagens com "sleep" por
//      inatividade (ex.: Render free tier), sem cair numa tela de login.
//   2) Checagem rápida de que o servidor E o banco estão respondendo —
//      útil pra debugar "caiu ou só está devagar".
app.get('/health', (req, res) => {
  const mongoose = require('mongoose');
  const bancoConectado = mongoose.connection.readyState === 1; // 1 = connected
  res.status(bancoConectado ? 200 : 503).json({
    status: bancoConectado ? 'ok' : 'banco_desconectado',
    timestamp: new Date().toISOString()
  });
});

// Rotas públicas
app.use('/', authRoutes);

// Portal do cliente (acompanhar status + aprovar/recusar orçamento).
// Fica ANTES de exigirAutenticacao de propósito: é acessado pelo cliente
// pelo link/QR code, sem login. Ver routes/publicoRoutes.js.
const publicoRoutes = require('./routes/publicoRoutes');
app.use('/acompanhar', publicoRoutes);

// Painel do dono do sistema (superadmin) — autenticação própria (chave
// secreta), nada a ver com o login normal de oficina/usuário.
// Painel do dono do sistema — o caminho vem de ADMIN_PATH (env), não fica
// escrito/linkado em nenhum lugar do código-fonte além daqui.
app.use(`/${config.adminPath}`, (req, res, next) => {
  res.locals.adminPath = config.adminPath;
  next();
}, superadminRoutes);

// A partir daqui, tudo exige autenticação
app.use(exigirAutenticacao);
// Só depois de autenticar sabemos a oficina do usuário, então a
// configuração (nome/logo/tema) da oficina é carregada aqui.
app.use(injetarConfiguracaoOficina);

app.use('/dashboard', dashboardRoutes);
app.use('/clientes', clienteRoutes);
app.use('/motos', motoRoutes);
app.use('/ordens-servico', osRoutes);
app.use('/revisoes', revisaoRoutes);
app.use('/estoque', estoqueRoutes);
app.use('/fornecedores', fornecedorRoutes);
app.use('/caixa', caixaRoutes);
app.use('/financeiro', financeiroRoutes);
app.use('/vendas', vendaRoutes);
app.use('/relatorios', relatorioRoutes);
app.use('/perfil', perfilRoutes);
app.use('/configuracoes', configRoutes);
app.use('/usuarios', usuarioRoutes);
app.use('/whatsapp', whatsappRoutes);

app.get('/', (req, res) => res.redirect('/dashboard'));

app.use(paginaNaoEncontrada);
app.use(tratadorErros);

async function iniciar() {
  try {
    await connectDatabase();
    app.listen(config.port, () => {
      console.log(`[Servidor] Oficina ERP rodando na porta ${config.port} (${config.env})`);
    });

    // Lembrete de rotação de credenciais (busca de placa): roda uma vez
    // já na subida do servidor (pra aparecer no log logo de cara, sem
    // esperar 24h) e depois periodicamente a cada 24h.
    const { verificarRotacaoCredencialPlaca } = require('./utils/verificacaoCredenciais');
    verificarRotacaoCredencialPlaca();
    setInterval(verificarRotacaoCredencialPlaca, 24 * 60 * 60 * 1000);

    // Reconecta automaticamente as oficinas que já tinham WhatsApp
    // (Baileys) conectado antes deste restart/deploy — sem isso, cada
    // deploy no Render exigiria escanear o QR code de novo.
    const { reconectarSessoesSalvas } = require('./services/whatsappBaileysService');
    reconectarSessoesSalvas().catch((err) => {
      console.error('[Servidor] Falha ao reconectar sessões de WhatsApp salvas:', err.message);
    });
  } catch (err) {
    console.error('[Servidor] Falha ao iniciar:', err);
    process.exit(1);
  }
}

iniciar();

module.exports = app;
