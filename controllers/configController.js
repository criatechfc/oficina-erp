const Configuracao = require('../models/Configuracao');
const { invalidarCacheConfiguracao } = require('../middlewares/viewLocals');
const { registrarAuditoria } = require('../utils/auditoria');

async function pagina(req, res, next) {
  try {
    let config = await Configuracao.findOne({ chave: 'geral' });
    if (!config) config = await Configuracao.create({ chave: 'geral' });
    res.render('config/index', { titulo: 'Configurações', config });
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const { nomeOficina, telefone, whatsapp, email, endereco, tema } = req.body;
    let config = await Configuracao.findOne({ chave: 'geral' });
    if (!config) config = new Configuracao({ chave: 'geral' });

    config.nomeOficina = nomeOficina;
    config.telefone = telefone;
    config.whatsapp = whatsapp;
    config.email = email;
    config.endereco = endereco;
    config.tema = tema;

    if (req.file) {
      config.logo = `/uploads/perfil/${req.file.filename}`;
    }

    await config.save();
    invalidarCacheConfiguracao();

    await registrarAuditoria(req, { modulo: 'configuracoes', acao: 'editar', descricao: 'Configurações da oficina atualizadas' });

    req.session.mensagemSucesso = 'Configurações atualizadas com sucesso.';
    return res.redirect('/configuracoes');
  } catch (err) {
    return next(err);
  }
}

module.exports = { pagina, atualizar };
