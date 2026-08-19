const express = require('express');
const router = express.Router();
const relatorioController = require('../controllers/relatorioController');
const { exigirPerfil } = require('../middlewares/auth');

router.use(exigirPerfil('administrador', 'gerente'));

router.get('/', relatorioController.pagina);
router.get('/clientes', relatorioController.relatorioClientes);
router.get('/motos', relatorioController.relatorioMotos);
router.get('/estoque', relatorioController.relatorioEstoque);
router.get('/financeiro', relatorioController.relatorioFinanceiro);
router.get('/servicos', relatorioController.relatorioServicos);
router.get('/mecanicos', relatorioController.relatorioMecanicos);
router.get('/lucro', relatorioController.relatorioLucro);

module.exports = router;
