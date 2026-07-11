const express = require('express');
const router = express.Router();
const perfilController = require('../controllers/perfilController');
const { uploadPerfil } = require('../middlewares/upload');

router.get('/', perfilController.pagina);
router.put('/', uploadPerfil.single('foto'), perfilController.atualizarDados);
router.post('/senha', perfilController.alterarSenha);

module.exports = router;
