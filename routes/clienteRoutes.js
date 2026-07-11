const express = require('express');
const router = express.Router();
const clienteController = require('../controllers/clienteController');
const { exigirPerfil } = require('../middlewares/auth');

router.use(exigirPerfil('administrador', 'gerente', 'atendente'));

router.get('/', clienteController.listar);
router.get('/novo', clienteController.formularioNovo);
router.post('/', clienteController.criar);
router.get('/:id', clienteController.visualizar);
router.get('/:id/editar', clienteController.formularioEditar);
router.put('/:id', clienteController.atualizar);
router.delete('/:id', clienteController.remover);

module.exports = router;
