const multer = require('multer');

function paginaNaoEncontrada(req, res) {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ sucesso: false, mensagem: 'Rota não encontrada.' });
  }
  return res.status(404).render('erro', {
    titulo: 'Página não encontrada',
    mensagem: 'A página que você procura não existe.',
    codigo: 404
  });
}

function tratadorErros(err, req, res, next) {
  console.error('[ERRO]', err);

  if (err instanceof multer.MulterError || err.message?.includes('não permitido')) {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(400).json({ sucesso: false, mensagem: err.message });
    }
    req.session.mensagemErro = err.message;
    return res.redirect('back');
  }

  if (err.code === 'EBADCSRFTOKEN') {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(403).json({ sucesso: false, mensagem: 'Token de segurança inválido. Recarregue a página.' });
    }
    return res.status(403).render('erro', {
      titulo: 'Formulário expirado',
      mensagem: 'Token de segurança inválido ou expirado. Volte e tente novamente.',
      codigo: 403
    });
  }

  const statusCode = err.statusCode || 500;
  const mensagem = err.mensagemPublica || 'Ocorreu um erro interno. Tente novamente.';

  if (req.originalUrl.startsWith('/api/')) {
    return res.status(statusCode).json({ sucesso: false, mensagem });
  }

  return res.status(statusCode).render('erro', {
    titulo: 'Erro',
    mensagem,
    codigo: statusCode
  });
}

module.exports = { paginaNaoEncontrada, tratadorErros };
