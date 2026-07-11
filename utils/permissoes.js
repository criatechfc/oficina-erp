/**
 * Mapa de permissões por módulo e perfil.
 * Usado nas views para exibir/ocultar menus e nas rotas via middleware exigirPerfil.
 */
const MAPA_PERMISSOES = {
  dashboard: ['administrador', 'gerente', 'atendente', 'caixa', 'mecanico'],
  clientes: ['administrador', 'gerente', 'atendente'],
  motos: ['administrador', 'gerente', 'atendente', 'mecanico'],
  ordensServico: ['administrador', 'gerente', 'atendente', 'mecanico'],
  revisoes: ['administrador', 'gerente', 'atendente', 'mecanico'],
  estoque: ['administrador', 'gerente'],
  fornecedores: ['administrador', 'gerente'],
  caixa: ['administrador', 'gerente', 'caixa'],
  financeiro: ['administrador', 'gerente'],
  vendas: ['administrador', 'gerente', 'atendente', 'caixa'],
  relatorios: ['administrador', 'gerente'],
  usuarios: ['administrador'],
  configuracoes: ['administrador']
};

function podeAcessar(perfil, modulo) {
  return MAPA_PERMISSOES[modulo]?.includes(perfil) ?? false;
}

module.exports = { MAPA_PERMISSOES, podeAcessar };
