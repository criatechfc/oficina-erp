const { AsyncLocalStorage } = require('node:async_hooks');

// Contexto por requisição: guarda o ID da oficina (tenant) atual para que
// os models consigam filtrar/gravar automaticamente sem que cada controller
// precise passar "oficina" manualmente em toda query.
const storage = new AsyncLocalStorage();

/**
 * Executa `fn` dentro de um contexto de tenant. Tudo que rodar de forma
 * síncrona ou assíncrona (await, promises, setTimeout, etc.) dentro de `fn`
 * enxerga o mesmo `oficinaId` via getOficinaId().
 */
function executarComOficina(oficinaId, fn) {
  return storage.run({ oficinaId: oficinaId ? String(oficinaId) : null, bypass: false }, fn);
}

/**
 * Executa `fn` "fora" do isolamento por tenant (usado por rotinas de
 * superadmin/scripts que precisam enxergar dados de todas as oficinas).
 */
function executarSemIsolamento(fn) {
  return storage.run({ oficinaId: null, bypass: true }, fn);
}

function getContexto() {
  return storage.getStore();
}

function getOficinaId() {
  const ctx = storage.getStore();
  return ctx ? ctx.oficinaId : null;
}

function estaBypassado() {
  const ctx = storage.getStore();
  return !!(ctx && ctx.bypass);
}

module.exports = {
  executarComOficina,
  executarSemIsolamento,
  getContexto,
  getOficinaId,
  estaBypassado
};
