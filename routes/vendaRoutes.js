const express = require('express');
const router = express.Router();
const vendaController = require('../controllers/vendaController');
const { exigirPerfil } = require('../middlewares/auth');

router.use(exigirPerfil('administrador', 'gerente', 'atendente', 'caixa'));

router.get('/', vendaController.listar);
router.get('/novo', vendaController.formularioNovo);
router.get('/motos-por-cliente/:clienteId', vendaController.buscarMotosPorCliente);
router.post('/', vendaController.criar);
router.get('/:id', vendaController.visualizar);
router.post('/:id/confirmar', vendaController.confirmar);
router.post('/:id/converter-os', vendaController.converterEmOS);

module.exports = router;
