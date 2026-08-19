const config = require('../config/config');

/**
 * Autenticação do painel de superadmin (dono do sistema). É totalmente
 * separada do login normal de usuários/oficinas: não usa User, não usa JWT,
 * só uma chave secreta (config.adminSecret) guardada na sessão depois de
 * validada. Ver controllers/superadminController.js.
 */
function exigirSuperAdmin(req, res, next) {
  if (req.session?.superAdmin === true) {
    return next();
  }
  req.session.mensagemErro = req.session.mensagemErro || null;
  return res.redirect(`/${config.adminPath}/login`);
}

function redirecionarSeSuperAdmin(req, res, next) {
  if (req.session?.superAdmin === true) {
    return res.redirect(`/${config.adminPath}`);
  }
  return next();
}

module.exports = { exigirSuperAdmin, redirecionarSeSuperAdmin };
