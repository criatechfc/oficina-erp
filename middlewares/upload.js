const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const config = require('../config/config');

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

function criarStorage(subpasta) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, '..', 'uploads', subpasta));
    },
    filename: (req, file, cb) => {
      const nomeUnico = crypto.randomBytes(16).toString('hex');
      const extensao = path.extname(file.originalname).toLowerCase();
      cb(null, `${nomeUnico}${extensao}`);
    }
  });
}

function filtroImagem(req, file, cb) {
  if (!TIPOS_PERMITIDOS.includes(file.mimetype)) {
    return cb(new Error('Formato de arquivo não permitido. Envie JPG, PNG ou WEBP.'));
  }
  cb(null, true);
}

function criarUploader(subpasta) {
  return multer({
    storage: criarStorage(subpasta),
    fileFilter: filtroImagem,
    limits: { fileSize: config.maxFileSizeMb * 1024 * 1024 }
  });
}

module.exports = {
  uploadMoto: criarUploader('motos'),
  uploadPeca: criarUploader('pecas'),
  uploadPerfil: criarUploader('perfil')
};
