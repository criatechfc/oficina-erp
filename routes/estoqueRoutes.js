const express = require('express');
const router = express.Router();
const estoqueController = require('../controllers/estoqueController');
const { exigirPerfil } = require('../middlewares/auth');
const { uploadPeca } = require('../middlewares/upload');
const { csrfProtection } = require('../middlewares/csrf');

// Busca por código/código de barras: usada no PDV (Vendas) e na Ordem de
// Serviço por qualquer perfil já autenticado (atendente, caixa, mecânico
// também precisam disso no dia a dia), por isso fica antes da restrição de
// perfil abaixo, que vale só pro cadastro/CRUD de estoque em si.
router.get('/buscar/:codigo', estoqueController.buscarPorCodigo);

router.use(exigirPerfil('administrador', 'gerente'));

router.get('/', estoqueController.listar);
router.get('/novo', estoqueController.formularioNovo);
router.get('/gerar-codigo', estoqueController.gerarCodigo);
router.post('/', uploadPeca.array('fotos', 4), csrfProtection, estoqueController.criar);
router.get('/:id/editar', estoqueController.formularioEditar);
router.get('/:id/etiqueta', estoqueController.etiqueta);
router.put('/:id', uploadPeca.array('fotos', 4), csrfProtection, estoqueController.atualizar);
router.delete('/:id', estoqueController.remover);
router.post('/:id/movimentar', estoqueController.movimentar);
router.get('/:id/historico', estoqueController.historico);

module.exports = router;
