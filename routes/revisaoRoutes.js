const express = require('express');
const router = express.Router();
const revisaoController = require('../controllers/revisaoController');
const { exigirPerfil } = require('../middlewares/auth');

router.use(exigirPerfil('administrador', 'gerente', 'atendente', 'mecanico'));

router.get('/', revisaoController.listar);
router.post('/', revisaoController.criar);
router.post('/:id/concluir', revisaoController.concluir);

module.exports = router;
