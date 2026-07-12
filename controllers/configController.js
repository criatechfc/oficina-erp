const Configuracao = require('../models/Configuracao');
const { invalidarCacheConfiguracao } = require('../middlewares/viewLocals');
const { registrarAuditoria } = require('../utils/auditoria');
const path = require('path');
const fs = require('fs');

const EXTENSOES_SEGURAS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Diagnóstico temporário: lista todos os arquivos nas pastas de upload
 * (motos, pecas, perfil) e sinaliza qualquer arquivo cuja extensão não seja
 * de imagem — sinal de que algo pode ter sido enviado explorando a falha de
 * validação de upload corrigida agora. Só administrador acessa.
 * Pode ser removida depois de confirmar que está tudo limpo.
 */
function diagnosticoUploads(req, res, next) {
  try {
    const pastas = ['motos', 'pecas', 'perfil'];
    const resultado = {};
    let suspeitosEncontrados = 0;

    for (const pasta of pastas) {
      const caminho = path.join(__dirname, '..', 'uploads', pasta);
      const arquivos = fs.existsSync(caminho)
        ? fs.readdirSync(caminho).filter((nome) => nome !== '.gitkeep')
        : [];

      resultado[pasta] = arquivos.map((nome) => {
        const extensao = path.extname(nome).toLowerCase();
        const suspeito = !EXTENSOES_SEGURAS.includes(extensao);
        if (suspeito) suspeitosEncontrados += 1;
        return { nome, extensao, suspeito };
      });
    }

    res.json({ suspeitosEncontrados, pastas: resultado });
  } catch (err) {
    next(err);
  }
}

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
module.exports = { pagina, atualizar, diagnosticoUploads };
