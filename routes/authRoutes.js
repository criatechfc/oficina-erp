const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { redirecionarSeAutenticado } = require('../middlewares/auth');
const { limiteLogin, limiteRecuperacaoSenha } = require('../middlewares/rateLimiters');

router.get('/login', redirecionarSeAutenticado, authController.paginaLogin);
router.post('/login', limiteLogin, redirecionarSeAutenticado, authController.autenticar);
router.post('/logout', authController.sair);

router.get('/esqueci-senha', redirecionarSeAutenticado, authController.paginaEsqueciSenha);
router.post('/esqueci-senha', limiteRecuperacaoSenha, authController.solicitarRecuperacao);

router.get('/redefinir-senha/:token', authController.paginaRedefinirSenha);
router.post('/redefinir-senha/:token', authController.redefinirSenha);

module.exports = router;
