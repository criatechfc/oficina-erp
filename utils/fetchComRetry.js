const logger = require('./logger');

/**
 * `fetch` com timeout + retry exponencial, para chamadas a APIs externas
 * (ex.: busca de placa) que podem travar ou falhar de forma transitória.
 *
 * O que ele NÃO tenta de novo, de propósito:
 *   - Erros 4xx (400-499): são erros de payload/credencial/negócio — tentar
 *     de novo não resolve, e em APIs cobradas por consulta (como a
 *     APIBrasil) isso arriscaria gastar crédito repetidamente por nada.
 *
 * O que ele TENTA de novo, com backoff exponencial (+ um pouco de
 * variação aleatória, pra evitar que várias tentativas caiam exatamente
 * juntas se várias requisições falharem ao mesmo tempo):
 *   - Timeout (a requisição não respondeu dentro do prazo)
 *   - Erro de rede (servidor inacessível, DNS, conexão recusada etc.)
 *   - 5xx (erro do lado do provedor — geralmente transitório)
 *   - 429 (limite de requisições por minuto — vale esperar um pouco e
 *     tentar de novo)
 */
async function fetchComRetry(url, opcoes = {}, { tentativas = 3, timeoutMs = 8000, servico = 'fetch' } = {}) {
  let ultimoErro;

  for (let tentativa = 1; tentativa <= tentativas; tentativa += 1) {
    const controlador = new AbortController();
    const timeoutId = setTimeout(() => controlador.abort(), timeoutMs);

    try {
      const resposta = await fetch(url, { ...opcoes, signal: controlador.signal });
      clearTimeout(timeoutId);

      const devePersistirRetry = resposta.status >= 500 || resposta.status === 429;
      if (!resposta.ok && devePersistirRetry && tentativa < tentativas) {
        logger.aviso(servico, 'retry_status_transitorio', {
          url,
          tentativa,
          tentativasRestantes: tentativas - tentativa,
          status: resposta.status
        });
        await aguardarComBackoff(tentativa);
        continue;
      }

      // 2xx, ou um erro 4xx que não vale repetir, ou já era a última
      // tentativa: devolve a resposta como está (quem chamou decide o
      // que fazer com resposta.ok === false).
      return resposta;
    } catch (err) {
      clearTimeout(timeoutId);
      ultimoErro = err.name === 'AbortError' ? new Error(`Timeout após ${timeoutMs}ms`) : err;

      if (tentativa < tentativas) {
        logger.aviso(servico, 'retry_erro_rede', {
          url,
          tentativa,
          tentativasRestantes: tentativas - tentativa,
          erro: ultimoErro.message
        });
        await aguardarComBackoff(tentativa);
      }
    }
  }

  throw ultimoErro || new Error('Falha desconhecida em fetchComRetry');
}

function aguardarComBackoff(tentativa) {
  const baseMs = 500 * 2 ** (tentativa - 1); // 500ms, 1000ms, 2000ms...
  const jitterMs = Math.random() * 200;
  return new Promise((resolve) => setTimeout(resolve, baseMs + jitterMs));
}

module.exports = { fetchComRetry };
