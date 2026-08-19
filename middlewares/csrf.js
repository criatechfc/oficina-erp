const csurf = require('csurf');

// Instância única, compartilhada entre o middleware global (server.js) e as
// rotas que precisam validar o CSRF DEPOIS do multer (uploads multipart).
const csrfProtection = csurf({ cookie: false });

module.exports = { csrfProtection };
