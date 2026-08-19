const express = require('express');
const router = express.Router();
const publicoController = require('../controllers/publicoController');

// Sem exigirAutenticacao de propósito: é a área que o CLIENTE acessa pelo
// link/QR code, sem precisar de login. A segurança vem do token aleatório
// na URL (ver models/OrdemServico.js), não de sessão.
router.get('/:token', publicoController.verPublico);
router.post('/:token/aprovar', publicoController.aprovar);
router.post('/:token/recusar', publicoController.recusar);

module.exports = router;
