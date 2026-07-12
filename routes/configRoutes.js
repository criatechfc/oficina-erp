const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');
const { exigirPerfil } = require('../middlewares/auth');
const { uploadPerfil } = require('../middlewares/upload');
const { csrfProtection } = require('../middlewares/csrf');

router.use(exigirPerfil('administrador'));

router.get('/', configController.pagina);
router.get('/diagnostico-uploads', configController.diagnosticoUploads);
router.put('/', uploadPerfil.single('logo'), csrfProtection, configController.atualizar);

module.exports = router;
