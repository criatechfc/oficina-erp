const validator = require('validator');

function limparString(valor) {
  if (typeof valor !== 'string') return valor;
  return validator.escape(valor.trim());
}

function ehEmailValido(email) {
  return typeof email === 'string' && validator.isEmail(email);
}

function ehCpfValido(cpf) {
  if (!cpf) return true; // opcional
  const limpo = cpf.replace(/\D/g, '');
  if (limpo.length !== 11 || /^(\d)\1{10}$/.test(limpo)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i += 1) soma += parseInt(limpo.charAt(i), 10) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(limpo.charAt(9), 10)) return false;
  soma = 0;
  for (let i = 0; i < 10; i += 1) soma += parseInt(limpo.charAt(i), 10) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  return resto === parseInt(limpo.charAt(10), 10);
}

function ehSenhaForte(senha) {
  return typeof senha === 'string' && validator.isStrongPassword(senha, {
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 0
  });
}

function formatarCpf(cpf) {
  if (!cpf) return '';
  const limpo = String(cpf).replace(/\D/g, '');
  if (limpo.length !== 11) return cpf;
  return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatarCnpj(cnpj) {
  if (!cnpj) return '';
  const limpo = String(cnpj).replace(/\D/g, '');
  if (limpo.length !== 14) return cnpj;
  return limpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

module.exports = { limparString, ehEmailValido, ehCpfValido, ehSenhaForte, formatarCpf, formatarCnpj };
