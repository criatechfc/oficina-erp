const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');
const { exigirPerfil } = require('../middlewares/auth');
const { uploadPerfil } = require('../middlewares/upload');

router.use(exigirPerfil('administrador'));

router.get('/', configController.pagina);
router.put('/', uploadPerfil.single('logo'), configController.atualizar);

module.exports = router;
