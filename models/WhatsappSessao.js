const mongoose = require('mongoose');

/**
 * Guarda a sessão do WhatsApp (Baileys) de cada oficina, persistida no
 * MongoDB — não em arquivo local.
 *
 * Por quê no banco e não em arquivo: hospedagens como o Render apagam o
 * disco local a cada deploy/restart (sistema de arquivos efêmero). Se a
 * sessão do Baileys fosse salva só em arquivo, todo deploy novo obrigaria
 * escanear o QR code de novo — inviável pra usar de verdade. Guardando no
 * MongoDB, a sessão sobrevive a qualquer restart/deploy.
 *
 * `arquivos` reproduz a mesma estrutura que o Baileys usa nativamente em
 * disco (um "arquivo" por credencial/chave), só que como pares chave/valor
 * dentro de um Map em vez de arquivos separados — ver
 * services/whatsappBaileysService.js (useMongoAuthState).
 */
const whatsappSessaoSchema = new mongoose.Schema(
  {
    oficina: { type: mongoose.Schema.Types.ObjectId, ref: 'Oficina', required: true, unique: true },
    arquivos: { type: Map, of: String, default: () => new Map() },
    status: {
      type: String,
      enum: ['desconectado', 'aguardando_qr', 'conectado', 'erro'],
      default: 'desconectado'
    },
    numeroConectado: { type: String },
    atualizadoEm: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model('WhatsappSessao', whatsappSessaoSchema);
