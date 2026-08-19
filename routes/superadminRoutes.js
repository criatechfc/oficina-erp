const express = require('express');
const router = express.Router();
const superadminController = require('../controllers/superadminController');
const { exigirSuperAdmin, redirecionarSeSuperAdmin } = require('../middlewares/superadmin');
const { limiteLogin } = require('../middlewares/rateLimiters');

// Login com a chave secreta (config.adminSecret / env ADMIN_SECRET)
router.get('/login', redirecionarSeSuperAdmin, superadminController.paginaLogin);
router.post('/login', limiteLogin, redirecionarSeSuperAdmin, superadminController.autenticar);
router.post('/logout', superadminController.sair);

// Tudo abaixo exige a sessão de superadmin válida
router.use(exigirSuperAdmin);

router.get('/', superadminController.paginaDashboard);

router.get('/oficinas/nova', superadminController.paginaNovaOficina);
router.post('/oficinas', superadminController.criarOficina);

router.get('/oficinas/:id', superadminController.paginaOficina);
router.post('/oficinas/:id', superadminController.atualizarOficina);
router.post('/oficinas/:id/status', superadminController.alternarStatusOficina);

router.post('/oficinas/:id/usuarios/:usuarioId/email', superadminController.trocarEmailUsuario);
router.post('/oficinas/:id/usuarios/:usuarioId/senha', superadminController.trocarSenhaUsuario);
router.post('/oficinas/:id/usuarios/:usuarioId/status', superadminController.alternarStatusUsuario);

module.exports = router;
