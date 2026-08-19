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
 * ---------------------------------------------------------------------
 * Leitor de código de barras — texto/leitor físico + câmera do celular
 * ---------------------------------------------------------------------
 * Um leitor físico de código de barras, pro navegador, é só um teclado que
 * "digita" muito rápido e manda um Enter no final — não precisa de nenhuma
 * integração especial, só escutar o evento de tecla Enter no campo de texto.
 *
 * A leitura por câmera usa a biblioteca html5-qrcode (carregada via CDN só
 * nas páginas que precisam dela). Se a biblioteca não estiver carregada na
 * página, o botão de câmera simplesmente avisa e não quebra o resto do
 * formulário.
 *
 * Em ambos os casos, quem decide o que fazer com o código lido é o código
 * que chama essas funções (ex.: adicionar peça na Venda/OS, ou só preencher
 * um campo no cadastro de peça) — aqui é só a mecânica de captura do código.
 */

async function buscarPecaPorCodigoEAdicionar({ input, containerId, templateId, selectName, endpointBase }) {
  const codigo = input.value.trim();
  const feedback = document.getElementById(`${input.id}-feedback`);
  if (!codigo) return;

  input.disabled = true;
  try {
    const resposta = await fetch(`${endpointBase}/${encodeURIComponent(codigo)}`);
    const dados = await resposta.json();

    if (!resposta.ok || !dados.sucesso || !dados.peca) {
      if (feedback) {
        feedback.textContent = dados.mensagem || 'Peça não encontrada para este código.';
        feedback.classList.add('texto-erro');
      }
      input.select();
      return;
    }

    adicionarItemDinamico(containerId, templateId);
    const container = document.getElementById(containerId);
    const ultimaLinha = container.lastElementChild;
    const select = ultimaLinha ? ultimaLinha.querySelector(`select[name="${selectName}"]`) : null;

    if (select) {
      select.value = dados.peca._id;
      if (select.value !== String(dados.peca._id)) {
        // Peça existe no banco mas não estava no select (ex.: cadastrada
        // depois da página carregar). Adiciona a opção na hora.
        const opcao = document.createElement('option');
        opcao.value = dados.peca._id;
        opcao.textContent = `${dados.peca.nome} (estoque: ${dados.peca.quantidade})`;
        opcao.setAttribute('data-nome', dados.peca.nome);
        opcao.setAttribute('data-preco', dados.peca.precoVenda);
        select.appendChild(opcao);
        select.value = dados.peca._id;
      }
      select.dispatchEvent(new Event('change'));
    }

    if (feedback) {
      feedback.textContent = `${dados.peca.nome} adicionada.`;
      feedback.classList.remove('texto-erro');
    }
    input.value = '';
  } catch (err) {
    if (feedback) {
      feedback.textContent = 'Erro ao buscar peça. Tente novamente.';
      feedback.classList.add('texto-erro');
    }
  } finally {
    input.disabled = false;
    input.focus();
  }
}

function ativarLeitorCodigoBarras({ inputId, containerId, templateId, selectName, endpointBase }) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter') {
      evento.preventDefault();
      buscarPecaPorCodigoEAdicionar({ input, containerId, templateId, selectName, endpointBase });
    }
  });

  const botao = document.getElementById(`${inputId}-botao`);
  if (botao) {
    botao.addEventListener('click', () => {
      buscarPecaPorCodigoEAdicionar({ input, containerId, templateId, selectName, endpointBase });
    });
  }

  const botaoCamera = document.getElementById(`${inputId}-camera`);
  if (botaoCamera) {
    botaoCamera.addEventListener('click', () => {
      abrirLeitorCamera((codigoLido) => {
        input.value = codigoLido;
        buscarPecaPorCodigoEAdicionar({ input, containerId, templateId, selectName, endpointBase });
      });
    });
  }
}

/**
 * Liga um botão de câmera a um campo de texto qualquer: ao detectar um
 * código, só preenche o campo (sem tentar buscar peça/adicionar item).
 * Usado no cadastro de peça (campo "Código de barras") e na busca rápida
 * do estoque.
 */
function ativarBotaoCameraParaCampo(botaoId, inputId, aoDetectar) {
  const botao = document.getElementById(botaoId);
  const input = document.getElementById(inputId);
  if (!botao || !input) return;
  botao.addEventListener('click', () => {
    abrirLeitorCamera((codigoLido) => {
      input.value = codigoLido;
      if (typeof aoDetectar === 'function') aoDetectar(codigoLido, input);
    });
  });
}

let _scannerCameraAtivo = null;

function criarModalLeitorCamera() {
  if (document.getElementById('modal-leitor-camera')) return;
  const modal = document.createElement('div');
  modal.id = 'modal-leitor-camera';
  modal.className = 'modal-leitor-camera';
  modal.innerHTML = `
    <div class="modal-leitor-caixa">
      <div class="modal-leitor-cabecalho">
        <span>Aponte a câmera para o código de barras</span>
        <button type="button" id="modal-leitor-fechar" class="botao botao-secundario botao-pequeno">Fechar</button>
      </div>
      <div id="leitor-camera-viewport"></div>
      <p id="modal-leitor-erro" class="texto-erro" style="display:none;"></p>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('modal-leitor-fechar').addEventListener('click', fecharLeitorCamera);
}

function fecharLeitorCamera() {
  const modal = document.getElementById('modal-leitor-camera');
  if (_scannerCameraAtivo) {
    // .stop() lança erro NA HORA (não como promise rejeitada) se a câmera
    // nunca chegou a iniciar de verdade (ex.: permissão negada) — sem o
    // try/catch aqui, esse erro interrompia a função antes da linha que
    // esconde o modal, e o botão "Fechar" parecia simplesmente não
    // funcionar quando a câmera falhava.
    try {
      const resultado = _scannerCameraAtivo.stop();
      if (resultado && typeof resultado.then === 'function') {
        resultado.then(() => _scannerCameraAtivo && _scannerCameraAtivo.clear()).catch(() => {});
      }
    } catch (err) {
      // Câmera nunca iniciou de verdade — nada a parar, só segue o fechamento.
    }
    _scannerCameraAtivo = null;
  }
  if (modal) modal.style.display = 'none';
}

/**
 * Abre a câmera (traseira, se disponível) num modal e chama `aoDetectar`
 * assim que reconhecer um código de barras ou QR code, fechando o modal
 * automaticamente em seguida.
 */
async function abrirLeitorCamera(aoDetectar) {
  if (typeof Html5Qrcode === 'undefined') {
    alert('Leitor por câmera não está disponível nesta tela. Use a digitação ou um leitor físico.');
    return;
  }

  criarModalLeitorCamera();
  const modal = document.getElementById('modal-leitor-camera');
  const erroEl = document.getElementById('modal-leitor-erro');
  modal.style.display = 'flex';
  erroEl.style.display = 'none';

  _scannerCameraAtivo = new Html5Qrcode('leitor-camera-viewport');
  try {
    await _scannerCameraAtivo.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 260, height: 130 } },
      (codigoLido) => {
        aoDetectar(codigoLido);
        fecharLeitorCamera();
      },
      () => {} // erro de leitura de um frame específico: acontece o tempo todo enquanto não acha nada, ignorar
    );
  } catch (err) {
    erroEl.textContent = 'Não foi possível acessar a câmera. Verifique se o navegador tem permissão.';
    erroEl.style.display = 'block';
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
