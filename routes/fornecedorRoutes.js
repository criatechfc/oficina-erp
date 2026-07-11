const express = require('express');
const router = express.Router();
const fornecedorController = require('../controllers/fornecedorController');
const { exigirPerfil } = require('../middlewares/auth');

router.use(exigirPerfil('administrador', 'gerente'));

router.get('/', fornecedorController.listar);
router.get('/novo', fornecedorController.formularioNovo);
router.post('/', fornecedorController.criar);
router.get('/:id/editar', fornecedorController.formularioEditar);
router.put('/:id', fornecedorController.atualizar);
router.delete('/:id', fornecedorController.remover);

module.exports = router;
