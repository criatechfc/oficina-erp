const express = require('express');
const router = express.Router();
const financeiroController = require('../controllers/financeiroController');
const { exigirPerfil } = require('../middlewares/auth');

router.use(exigirPerfil('administrador', 'gerente'));

router.get('/', financeiroController.pagina);
router.get('/novo', financeiroController.formularioNovo);
router.post('/', financeiroController.criar);
router.post('/:id/pagar', financeiroController.marcarPaga);
router.post('/:id/cancelar', financeiroController.cancelar);

module.exports = router;
