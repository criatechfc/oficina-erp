const mongoose = require('mongoose');
const { getOficinaId, estaBypassado } = require('./tenantContext');

// Consultas de leitura/atualização/remoção que precisam ser restritas à
// oficina atual automaticamente.
const OPERACOES_QUERY = [
  'find',
  'findOne',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndRemove',
  'countDocuments',
  'updateMany',
  'updateOne',
  'deleteMany',
  'deleteOne',
  'distinct'
];

/**
 * Plugin de multi-tenancy (isolamento por oficina).
 *
 * - Adiciona o campo `oficina` (ObjectId, obrigatório) a todo model que usar
 *   este plugin.
 * - Em toda query, injeta automaticamente `{ oficina: <oficinaAtual> }` no
 *   filtro, usando o contexto da requisição (utils/tenantContext). Assim os
 *   controllers não precisam lembrar de filtrar manualmente em cada lugar —
 *   e não existe o risco de esquecer e vazar dado de uma oficina pra outra.
 * - Em `validate` (que roda ANTES da validação dos campos), preenche
 *   `oficina` automaticamente a partir do contexto quando o documento ainda
 *   não tiver esse campo definido. Importante: isso precisa ser em
 *   `pre('validate')`, não em `pre('save')` — o Mongoose valida os campos
 *   obrigatórios antes de disparar os hooks de `save`, então preencher em
 *   `pre('save')` seria tarde demais e o campo `oficina` (required) falharia
 *   a validação mesmo sendo preenchido corretamente logo em seguida.
 * - Em `aggregate`, injeta um `$match` no início do pipeline.
 *
 * Rotas/scripts de superadmin podem rodar fora do isolamento usando
 * `tenantContext.executarSemIsolamento(fn)`.
 */
function tenantPlugin(schema, opts = {}) {
  schema.add({
    oficina: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Oficina',
      required: true,
      index: true
    }
  });

  OPERACOES_QUERY.forEach((op) => {
    schema.pre(op, function aplicarFiltroOficina(next) {
      if (estaBypassado()) return next();

      const oficinaId = getOficinaId();
      if (!oficinaId) return next();

      const filtro = this.getFilter ? this.getFilter() : this._conditions;
      if (!filtro.oficina) {
        this.where({ oficina: oficinaId });
      }
      return next();
    });
  });

  schema.pre('validate', function preencherOficina(next) {
    if (this.isNew && !this.oficina && !estaBypassado()) {
      const oficinaId = getOficinaId();
      if (oficinaId) {
        this.oficina = oficinaId;
      }
    }
    return next();
  });

  schema.pre('aggregate', function injetarMatchOficina() {
    if (estaBypassado()) return;
    const oficinaId = getOficinaId();
    if (!oficinaId) return;

    const jaTemMatchOficina = this.pipeline().some(
      (estagio) => estagio.$match && Object.prototype.hasOwnProperty.call(estagio.$match, 'oficina')
    );
    if (!jaTemMatchOficina) {
      this.pipeline().unshift({ $match: { oficina: new mongoose.Types.ObjectId(oficinaId) } });
    }
  });
}

module.exports = tenantPlugin;
