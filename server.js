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
const { injetarLocals } = require('./middlewares/viewLocals');
const { paginaNaoEncontrada, tratadorErros } = require('./middlewares/errorHandler');
const { podeAcessar } = require('./utils/permissoes');

const authRoutes = require('./routes/authRoutes');
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
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'https://cdnjs.cloudflare.com']
      }
    }
  })
);

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
  next();
});

// Rotas públicas
app.use('/', authRoutes);

// A partir daqui, tudo exige autenticação
app.use(exigirAutenticacao);

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

app.get('/', (req, res) => res.redirect('/dashboard'));

app.use(paginaNaoEncontrada);
app.use(tratadorErros);

async function iniciar() {
  try {
    await connectDatabase();
    app.listen(config.port, () => {
      console.log(`[Servidor] Oficina ERP rodando na porta ${config.port} (${config.env})`);
    });
  } catch (err) {
    console.error('[Servidor] Falha ao iniciar:', err);
    process.exit(1);
  }
}

iniciar();

module.exports = app;
