/**
 * Logger estruturado — imprime logs em JSON (uma linha por evento) em vez
 * de texto solto. Isso facilita muito filtrar e monitorar chamadas
 * anômalas em produção: qualquer ferramenta de log (Render, Railway,
 * Datadog, ou até só `grep`/`jq` no terminal) consegue buscar por
 * `servico`, `evento` ou `nivel` em vez de tentar casar texto livre.
 *
 * Não usa nenhuma biblioteca externa (winston, pino etc.) de propósito —
 * é só `console.log`/`console.error` com JSON.stringify, mantendo o
 * projeto sem dependências novas para uma necessidade simples.
 */

function registrar(nivel, servico, evento, dados = {}) {
  const linha = {
    timestamp: new Date().toISOString(),
    nivel,
    servico,
    evento,
    ...dados
  };

  const saida = JSON.stringify(linha);
  if (nivel === 'erro') {
    console.error(saida);
  } else if (nivel === 'aviso') {
    console.warn(saida);
  } else {
    console.log(saida);
  }
}

function info(servico, evento, dados) {
  registrar('info', servico, evento, dados);
}

function aviso(servico, evento, dados) {
  registrar('aviso', servico, evento, dados);
}

function erro(servico, evento, dados) {
  registrar('erro', servico, evento, dados);
}

module.exports = { info, aviso, erro };
