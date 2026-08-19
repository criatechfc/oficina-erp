const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const { exigirPerfil } = require('../middlewares/auth');

router.use(exigirPerfil('administrador'));

router.get('/', usuarioController.listar);
router.get('/novo', usuarioController.formularioNovo);
router.post('/', usuarioController.criar);
router.get('/:id/editar', usuarioController.formularioEditar);
router.put('/:id', usuarioController.atualizar);
router.post('/:id/redefinir-senha', usuarioController.redefinirSenha);

module.exports = router;
