const express = require('express');
const router = express.Router();
const perfilController = require('../controllers/perfilController');
const { uploadPerfil } = require('../middlewares/upload');
const { csrfProtection } = require('../middlewares/csrf');

router.get('/', perfilController.pagina);
router.put('/', uploadPerfil.single('foto'), csrfProtection, perfilController.atualizarDados);
router.post('/senha', perfilController.alterarSenha);

module.exports = router;
