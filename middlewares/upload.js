const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../config/config');

// Assinaturas binárias (magic bytes) dos formatos de imagem aceitos.
//
// Antes, o tipo do arquivo era decidido pelo Content-Type e pelo nome
// enviados pelo navegador do usuário — ambos fornecidos pelo cliente e
// fáceis de forjar. Isso permitia enviar, por exemplo, uma página HTML de
// phishing disfarçada de "foto.jpg" (com Content-Type: image/jpeg), que o
// sistema salvava e servia publicamente em /uploads no nosso domínio.
// Validar os bytes reais do arquivo fecha essa brecha: só gravamos no disco
// o que comprovadamente é uma imagem, e a extensão salva vem do conteúdo
// verificado, nunca do que o cliente disse que estava enviando.
const ASSINATURAS = [
  { extensao: '.jpg', bytes: [0xff, 0xd8, 0xff] },
  { extensao: '.png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { extensao: '.webp', bytes: [0x52, 0x49, 0x46, 0x46], offsetSecundario: { pos: 8, bytes: [0x57, 0x45, 0x42, 0x50] } }
];

function detectarExtensaoReal(buffer) {
  if (!buffer || buffer.length < 12) return null;
  for (const assinatura of ASSINATURAS) {
    const inicioOk = assinatura.bytes.every((byte, i) => buffer[i] === byte);
    if (!inicioOk) continue;
    if (assinatura.offsetSecundario) {
      const { pos, bytes } = assinatura.offsetSecundario;
      const okSecundario = bytes.every((byte, i) => buffer[pos + i] === byte);
      if (!okSecundario) continue;
    }
    return assinatura.extensao;
  }
  return null;
}

function criarValidador(subpasta) {
  return function validarConteudoEGravar(req, res, next) {
    const arquivos = req.files || (req.file ? [req.file] : []);
    if (!arquivos.length) return next();

    try {
      const pasta = path.join(__dirname, '..', 'uploads', subpasta);
      for (const arquivo of arquivos) {
        const extensaoReal = detectarExtensaoReal(arquivo.buffer);
        if (!extensaoReal) {
          return next(new Error('Formato de arquivo não permitido. Envie JPG, PNG ou WEBP.'));
        }
        const nomeUnico = `${crypto.randomBytes(16).toString('hex')}${extensaoReal}`;
        fs.writeFileSync(path.join(pasta, nomeUnico), arquivo.buffer);
        // Mantém compatibilidade com os controllers, que esperam "filename"
        // preenchido como se o multer tivesse salvo direto no disco.
        arquivo.filename = nomeUnico;
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

function criarUploader(subpasta) {
  const instanciaMulter = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxFileSizeMb * 1024 * 1024 }
  });
  const validador = criarValidador(subpasta);

  return {
    array: (campo, max) => [instanciaMulter.array(campo, max), validador],
    single: (campo) => [instanciaMulter.single(campo), validador]
  };
}

module.exports = {
  uploadMoto: criarUploader('motos'),
  uploadPeca: criarUploader('pecas'),
  uploadPerfil: criarUploader('perfil')
};
