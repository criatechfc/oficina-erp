require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');
const config = require('../config/config');
const User = require('../models/User');
const Configuracao = require('../models/Configuracao');

function perguntar(rl, texto) {
  return new Promise((resolve) => rl.question(texto, resolve));
}

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log('Conectado ao MongoDB.');

  const existeAdmin = await User.findOne({ perfil: 'administrador' });
  if (existeAdmin) {
    console.log(`Já existe um administrador cadastrado: ${existeAdmin.email}`);
    console.log('Encerrando sem criar novo usuário.');
    await mongoose.disconnect();
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const nome = (await perguntar(rl, 'Nome do administrador: ')).trim() || 'Administrador';
  const email = (await perguntar(rl, 'E-mail do administrador: ')).trim().toLowerCase();
  const senha = (await perguntar(rl, 'Senha (mín. 8 caracteres, com maiúscula, minúscula e número): ')).trim();

  rl.close();

  if (!email || !senha) {
    console.error('E-mail e senha são obrigatórios.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const admin = await User.create({ nome, email, senha, perfil: 'administrador' });
  console.log(`Administrador criado com sucesso: ${admin.email}`);

  const configExistente = await Configuracao.findOne({ chave: 'geral' });
  if (!configExistente) {
    await Configuracao.create({ chave: 'geral', nomeOficina: 'Minha Oficina de Motos' });
    console.log('Configuração padrão da oficina criada.');
  }

  await mongoose.disconnect();
  console.log('Seed finalizado.');
}

main().catch((err) => {
  console.error('Erro ao executar seed:', err);
  process.exit(1);
});
