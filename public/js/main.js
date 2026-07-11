document.addEventListener('DOMContentLoaded', () => {
  // Toggle sidebar mobile
  const menuToggle = document.querySelector('.menu-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => sidebar.classList.toggle('aberta'));
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 960 && sidebar.classList.contains('aberta') && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
        sidebar.classList.remove('aberta');
      }
    });
  }

  // Modo escuro
  const botaoTema = document.querySelector('#botao-tema');
  const temaSalvo = localStorage.getItem('oficina-tema') || 'claro';
  document.documentElement.setAttribute('data-tema', temaSalvo);
  if (botaoTema) {
    botaoTema.addEventListener('click', () => {
      const atual = document.documentElement.getAttribute('data-tema');
      const novo = atual === 'escuro' ? 'claro' : 'escuro';
      document.documentElement.setAttribute('data-tema', novo);
      localStorage.setItem('oficina-tema', novo);
    });
  }

  // Confirmação de exclusão
  document.querySelectorAll('[data-confirmar]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      const mensagem = form.getAttribute('data-confirmar') || 'Tem certeza que deseja realizar esta ação?';
      if (!confirm(mensagem)) e.preventDefault();
    });
  });

  // Fecha alertas automaticamente
  document.querySelectorAll('.alerta').forEach((alerta) => {
    setTimeout(() => { alerta.style.display = 'none'; }, 6000);
  });
});

/**
 * Adiciona uma linha de item dinâmico (peças/serviços) em formulários de OS e Vendas.
 */
function adicionarItemDinamico(containerId, templateId) {
  const container = document.getElementById(containerId);
  const template = document.getElementById(templateId);
  if (!container || !template) return;
  const clone = template.content.cloneNode(true);
  container.appendChild(clone);
}

function removerItemDinamico(botao) {
  const linha = botao.closest('.item-dinamico');
  if (linha) linha.remove();
}

/**
 * Preenche preço automaticamente ao selecionar uma peça em uma linha de item.
 */
function preencherPrecoPeca(select) {
  const opcao = select.options[select.selectedIndex];
  const preco = opcao?.getAttribute('data-preco');
  const linha = select.closest('.item-dinamico');
  if (linha && preco) {
    const campoPreco = linha.querySelector('.campo-preco');
    if (campoPreco) campoPreco.value = preco;
  }
}

/**
 * Busca motos de um cliente via fetch e popula o select de motos.
 */
async function carregarMotosDoCliente(clienteId, selectMotoId, endpointBase) {
  const selectMoto = document.getElementById(selectMotoId);
  if (!selectMoto) return;
  selectMoto.innerHTML = '<option value="">Carregando...</option>';
  if (!clienteId) {
    selectMoto.innerHTML = '<option value="">Selecione um cliente primeiro</option>';
    return;
  }
  try {
    const resposta = await fetch(`${endpointBase}/${clienteId}`);
    const dados = await resposta.json();
    selectMoto.innerHTML = '<option value="">Selecione a moto</option>';
    (dados.motos || []).forEach((moto) => {
      const opt = document.createElement('option');
      opt.value = moto._id;
      opt.textContent = `${moto.marca} ${moto.modelo} - ${moto.placa}`;
      selectMoto.appendChild(opt);
    });
  } catch (err) {
    selectMoto.innerHTML = '<option value="">Erro ao carregar motos</option>';
  }
}
