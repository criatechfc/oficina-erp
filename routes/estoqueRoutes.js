const express = require('express');
const router = express.Router();
const estoqueController = require('../controllers/estoqueController');
const { exigirPerfil } = require('../middlewares/auth');
const { uploadPeca } = require('../middlewares/upload');
const { csrfProtection } = require('../middlewares/csrf');

router.use(exigirPerfil('administrador', 'gerente'));

router.get('/', estoqueController.listar);
router.get('/novo', estoqueController.formularioNovo);
router.post('/', uploadPeca.array('fotos', 4), csrfProtection, estoqueController.criar);
router.get('/:id/editar', estoqueController.formularioEditar);
router.put('/:id', uploadPeca.array('fotos', 4), csrfProtection, estoqueController.atualizar);
router.delete('/:id', estoqueController.remover);
router.post('/:id/movimentar', estoqueController.movimentar);
router.get('/:id/historico', estoqueController.historico);

module.exports = router;
