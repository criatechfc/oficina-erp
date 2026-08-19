const express = require('express');
const router = express.Router();
const caixaController = require('../controllers/caixaController');
const { exigirPerfil } = require('../middlewares/auth');

router.use(exigirPerfil('administrador', 'gerente', 'caixa'));

router.get('/', caixaController.pagina);
router.post('/abrir', caixaController.abrir);
router.post('/movimentacao', caixaController.registrarMovimentacao);
router.post('/fechar', caixaController.fechar);

module.exports = router;
