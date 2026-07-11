const express = require('express');
const router = express.Router();
const motoController = require('../controllers/motoController');
const { exigirPerfil } = require('../middlewares/auth');
const { uploadMoto } = require('../middlewares/upload');
const { csrfProtection } = require('../middlewares/csrf');

router.use(exigirPerfil('administrador', 'gerente', 'atendente', 'mecanico'));

router.get('/', motoController.listar);
router.get('/novo', motoController.formularioNovo);
router.post('/', uploadMoto.array('fotos', 6), csrfProtection, motoController.criar);
router.get('/:id', motoController.visualizar);
router.get('/:id/editar', motoController.formularioEditar);
router.put('/:id', uploadMoto.array('fotos', 6), csrfProtection, motoController.atualizar);
router.delete('/:id', motoController.remover);

module.exports = router;
