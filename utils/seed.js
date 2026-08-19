require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');
const config = require('../config/config');
const User = require('../models/User');
const Oficina = require('../models/Oficina');
const { executarSemIsolamento } = require('./tenantContext');

function perguntar(rl, texto) {
  return new Promise((resolve) => rl.question(texto, resolve));
}

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log('Conectado ao MongoDB.');

  await executarSemIsolamento(async () => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    const nomeOficina = (await perguntar(rl, 'Nome da oficina: ')).trim() || 'Minha Oficina';
    let nicho = (await perguntar(rl, 'Nicho (carro/moto/ambos) [ambos]: ')).trim().toLowerCase();
    if (!['carro', 'moto', 'ambos'].includes(nicho)) nicho = 'ambos';
    const nome = (await perguntar(rl, 'Nome do administrador: ')).trim() || 'Administrador';
    const email = (await perguntar(rl, 'E-mail do administrador: ')).trim().toLowerCase();
    const senha = (await perguntar(rl, 'Senha (mín. 8 caracteres, com maiúscula, minúscula e número): ')).trim();

    rl.close();

    if (!email || !senha) {
      console.error('E-mail e senha são obrigatórios.');
      process.exitCode = 1;
      return;
    }

    const emailExistente = await User.findOne({ email });
    if (emailExistente) {
      console.log(`Já existe um usuário com este e-mail: ${email}. Encerrando sem criar novo registro.`);
      return;
    }

    const oficina = await Oficina.create({ nome: nomeOficina, nicho });
    const admin = await User.create({ nome, email, senha, perfil: 'administrador', oficina: oficina._id });

    console.log(`Oficina "${oficina.nome}" (nicho: ${oficina.nicho}) criada.`);
    console.log(`Administrador criado com sucesso: ${admin.email}`);
  });

  await mongoose.disconnect();
  console.log('Seed finalizado.');
}

main().catch((err) => {
  console.error('Erro ao executar seed:', err);
  process.exit(1);
});
