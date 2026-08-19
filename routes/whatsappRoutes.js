const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const { exigirPerfil } = require('../middlewares/auth');

router.use(exigirPerfil('administrador', 'gerente'));

router.get('/', whatsappController.verStatus);
router.get('/status.json', whatsappController.statusJson);
router.post('/conectar', whatsappController.conectar);
router.post('/desconectar', whatsappController.desconectar);

module.exports = router;
