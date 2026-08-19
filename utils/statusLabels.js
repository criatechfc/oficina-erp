const ROTULOS_STATUS_OS = {
  recebida: 'Recebida',
  em_analise: 'Em Análise',
  aguardando_aprovacao: 'Aguardando Aprovação',
  em_manutencao: 'Em Manutenção',
  finalizada: 'Finalizada',
  entregue: 'Entregue',
  cancelada: 'Cancelada'
};

const ROTULOS_STATUS_VENDA = {
  orcamento: 'Orçamento',
  confirmada: 'Confirmada',
  convertida_os: 'Convertida em OS',
  cancelada: 'Cancelada'
};

const ROTULOS_STATUS_REVISAO = {
  pendente: 'Pendente',
  concluida: 'Concluída'
};

const ROTULOS_ITEM_REVISAO = {
  troca_oleo: 'Troca de óleo',
  filtro: 'Filtro',
  pastilhas: 'Pastilhas de freio',
  relacao: 'Relação',
  velas: 'Velas',
  pneus: 'Pneus',
  freios: 'Freios',
  suspensao: 'Suspensão',
  correia: 'Correia',
  corrente: 'Corrente'
};

function rotuloItemRevisao(item) {
  return ROTULOS_ITEM_REVISAO[item] || (item ? item.replace(/_/g, ' ') : '-');
}

function rotuloStatusOS(status) {
  return ROTULOS_STATUS_OS[status] || (status ? status.replace(/_/g, ' ') : '-');
}

function rotuloStatusVenda(status) {
  return ROTULOS_STATUS_VENDA[status] || (status ? status.replace(/_/g, ' ') : '-');
}

function rotuloStatusRevisao(status) {
  return ROTULOS_STATUS_REVISAO[status] || (status ? status.replace(/_/g, ' ') : '-');
}

module.exports = { rotuloStatusOS, rotuloStatusVenda, rotuloStatusRevisao, rotuloItemRevisao };
