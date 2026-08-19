# Oficina ERP

Sistema de gestão (ERP) completo para oficinas de motos, desenvolvido em Node.js + Express + MongoDB, com EJS no frontend (sem frameworks JS), autenticação segura, controle de permissões por perfil, e módulos de clientes, motos, ordens de serviço, revisões, estoque, fornecedores, caixa, financeiro, vendas, relatórios e configurações.

## Tecnologias

- Node.js + Express.js
- MongoDB + Mongoose (MongoDB Atlas)
- EJS (template engine) + CSS puro (sem Bootstrap)
- JWT + bcrypt + express-session
- Helmet, express-rate-limit, csurf, express-mongo-sanitize (segurança)
- Multer (upload de imagens)
- PDFKit (geração de PDF das OS) e ExcelJS (exportação de relatórios)

## Estrutura do projeto

```
config/        Configuração de ambiente e conexão com o banco
controllers/    Lógica de negócio de cada módulo
middlewares/   Autenticação, upload, rate limit, tratamento de erros
models/         Schemas Mongoose
routes/         Rotas Express por módulo
services/       PDF, Excel e WhatsApp
utils/          Validações, permissões, auditoria, seed
public/         CSS e JS estáticos
views/          Templates EJS
uploads/        Arquivos enviados pelos usuários (fotos)
```

## 1. Pré-requisitos

- Node.js 18 ou superior
- Uma conta gratuita no [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- Git e uma conta no GitHub (para deploy)

## 2. Instalação local

```bash
git clone <url-do-seu-repositorio>
cd oficina-erp
npm install
cp .env.example .env
```

Edite o arquivo `.env` preenchendo, no mínimo:

- `MONGO_URI` — string de conexão do MongoDB Atlas (veja o passo 3)
- `JWT_SECRET` e `SESSION_SECRET` — strings aleatórias longas (gere com `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)

## 3. Configurando o MongoDB Atlas

1. Crie uma conta em https://www.mongodb.com/cloud/atlas e crie um **Cluster gratuito (M0)**.
2. Em **Database Access**, crie um usuário de banco com senha (guarde a senha).
3. Em **Network Access**, adicione o IP `0.0.0.0/0` (permite acesso de qualquer lugar — necessário para o Render) ou o IP do seu servidor.
4. Em **Database > Connect > Drivers**, copie a *connection string*, que se parece com:
   ```
   mongodb+srv://usuario:<senha>@cluster.mongodb.net/?retryWrites=true&w=majority
   ```
5. Substitua `<senha>` pela senha do usuário criado e acrescente o nome do banco antes do `?`, por exemplo:
   ```
   mongodb+srv://usuario:minhasenha@cluster.mongodb.net/oficina-erp?retryWrites=true&w=majority
   ```
6. Cole essa string na variável `MONGO_URI` do seu `.env`.

## 4. Criando o primeiro usuário administrador

Como o sistema não tem cadastro público (por segurança), o primeiro administrador é criado via terminal:

```bash
npm run seed
```

O script pedirá nome, e-mail e senha do administrador. Depois disso, você já pode fazer login em `/login` e, a partir do painel **Usuários**, cadastrar gerentes, atendentes, caixas e mecânicos.

## 5. Rodando em desenvolvimento

```bash
npm run dev
```

O servidor sobe em `http://localhost:3000` (ou na porta definida em `PORT` no `.env`), reiniciando automaticamente a cada alteração (nodemon).

## 6. Rodando em produção (local)

```bash
npm start
```

## 7. Publicando no GitHub

```bash
git init
git add .
git commit -m "Oficina ERP - versão inicial"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/oficina-erp.git
git push -u origin main
```

O arquivo `.gitignore` já garante que `.env`, `node_modules` e uploads não sejam enviados ao repositório.

## 8. Deploy no Render

1. Acesse https://render.com e crie uma conta (pode usar login do GitHub).
2. Clique em **New > Web Service** e selecione o repositório `oficina-erp` que você acabou de subir.
3. Configure:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (ou o plano desejado)
4. Em **Environment Variables**, adicione todas as variáveis do seu `.env` (MONGO_URI, JWT_SECRET, SESSION_SECRET, APP_URL — use a própria URL que o Render vai gerar, ex: `https://oficina-erp.onrender.com`, NODE_ENV=production, etc).
5. Clique em **Create Web Service**. O Render fará o build e deploy automaticamente.
6. Após o primeiro deploy, rode o script de seed apontando para o banco de produção. Você pode fazer isso rodando localmente com o `.env` apontando para o mesmo `MONGO_URI` de produção:
   ```bash
   npm run seed
   ```
7. Acesse a URL gerada pelo Render e faça login com o administrador criado.

### Atualizações futuras

Qualquer `git push` para a branch `main` conectada ao Render dispara um novo deploy automaticamente.

## 9. Perfis de usuário e permissões

| Perfil        | Acesso                                                                 |
|---------------|-------------------------------------------------------------------------|
| Administrador | Acesso total, incluindo usuários e configurações                        |
| Gerente       | Todos os módulos operacionais e financeiros, exceto usuários            |
| Atendente     | Clientes, motos, ordens de serviço, revisões, vendas                    |
| Caixa         | Caixa e vendas                                                          |
| Mecânico      | Motos, ordens de serviço e revisões                                     |

## 10. Segurança implementada

- Senhas com hash bcrypt (nunca armazenadas em texto puro)
- Autenticação via JWT em cookie httpOnly + sessão server-side (MongoStore)
- Proteção CSRF em todos os formulários
- Rate limiting em login e recuperação de senha (proteção contra força bruta)
- Bloqueio temporário de conta após tentativas de login inválidas
- Cabeçalhos de segurança via Helmet (CSP, etc.)
- Sanitização contra NoSQL Injection (express-mongo-sanitize)
- Validação de CPF, e-mail e força de senha no backend
- Logs de acesso (login/logout/falhas) e auditoria de ações administrativas
- Variáveis sensíveis sempre em `.env`, nunca no código

## 11. Notificações via WhatsApp

Por padrão, o sistema usa links **wa.me** (o mesmo tipo de link usado em botões "Fale conosco" de sites). Nas telas de Ordem de Serviço, Revisões e Vendas/Orçamentos, sempre que o cliente tiver WhatsApp cadastrado aparece um botão **"📲 Enviar WhatsApp"**: ao clicar, abre o WhatsApp (Web ou app) já com a mensagem escrita, e você só confirma o envio manualmente. Não exige conta, API, custo ou risco de banimento — é 100% gratuito e funciona assim que você preencher o campo "WhatsApp" no cadastro do cliente.

Se no futuro você quiser que o envio seja **automático** (sem precisar clicar), configure `WHATSAPP_API_URL` e `WHATSAPP_API_TOKEN` no `.env` com as credenciais de um provedor pago (Twilio WhatsApp API, Z-API, Meta Cloud API etc). Isso é opcional — o sistema funciona completo sem essa configuração.

## 12. Suporte

Dúvidas sobre a estrutura do código: consulte os comentários nos arquivos de `controllers/`, `models/` e `services/`, que documentam as decisões mais importantes de cada módulo.
