const express = require('express');
const router = express.Router();
const osController = require('../controllers/osController');
const { exigirPerfil } = require('../middlewares/auth');

router.use(exigirPerfil('administrador', 'gerente', 'atendente', 'mecanico'));

router.get('/', osController.listar);
router.get('/novo', osController.formularioNovo);
router.get('/motos-por-cliente/:clienteId', osController.buscarMotosPorCliente);
router.post('/', osController.criar);
router.get('/:id', osController.visualizar);
router.post('/:id/status', osController.atualizarStatus);
router.get('/:id/pdf', osController.gerarPdf);

module.exports = router;
