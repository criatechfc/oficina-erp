/**
 * Evita spam de e-mail quando uma integração externa fica indisponível.
 *
 * Sem isso, se a API de placa cair, cada consulta que algum atendente
 * tentar fazer dispararia um e-mail novo — em poucos minutos a caixa de
 * entrada ficaria inundada. Este módulo garante que só é enviado UM alerta
 * a cada janela de tempo (padrão: 30 minutos) por integração.
 *
 * Guardado em memória (reseta se o servidor reiniciar) — é suficiente pra
 * esse caso de uso, não precisa de banco para isso.
 */

const ultimoAlertaEnviado = new Map(); // nomeIntegracao -> timestamp (ms)
const JANELA_PADRAO_MS = 30 * 60 * 1000; // 30 minutos

/**
 * @param {string} chave - identifica a integração (ex.: 'busca-placa')
 * @param {number} janelaMs - tempo mínimo entre alertas para essa chave
 * @returns {boolean} true se pode enviar agora (e já marca como enviado)
 */
function podeEnviarAlerta(chave, janelaMs = JANELA_PADRAO_MS) {
  const agora = Date.now();
  const ultimo = ultimoAlertaEnviado.get(chave) || 0;
  if (agora - ultimo < janelaMs) return false;
  ultimoAlertaEnviado.set(chave, agora);
  return true;
}

module.exports = { podeEnviarAlerta };
