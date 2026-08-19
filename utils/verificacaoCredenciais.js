const config = require('../config/config');
const logger = require('./logger');
const { enviarEmailAlertaIntegracao } = require('../services/emailService');
const { podeEnviarAlerta } = require('./alertaThrottle');

/**
 * Lembrete de rotação de credenciais (recomendação de segurança: trocar
 * tokens de API a cada ~90 dias, para limitar o estrago se algum
 * vazamento acontecer sem que ninguém perceba na hora).
 *
 * O sistema NÃO consegue trocar sozinho o token de um provedor externo
 * (isso é uma ação manual no painel da APIBrasil) — o que ele faz é
 * avisar quando já passou do prazo, pra você lembrar de ir lá trocar.
 *
 * Para isso funcionar, defina no .env a data em que o token atual foi
 * configurado (ou trocado pela última vez):
 *   PLACA_API_TOKEN_DEFINIDO_EM=2026-01-15
 * Toda vez que você trocar o token, atualize essa data também.
 */

const DIAS_PARA_ROTACAO = 90;
const CHAVE_ALERTA = 'rotacao-credencial-placa';
const UMA_SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

function diasDesde(data) {
  return Math.floor((Date.now() - data.getTime()) / (24 * 60 * 60 * 1000));
}

async function verificarRotacaoCredencialPlaca() {
  const dataConfiguracao = config.placaApi.tokenDefinidoEm;
  if (!dataConfiguracao) {
    // Sem PLACA_API_TOKEN_DEFINIDO_EM definida, não dá pra saber a idade
    // do token — só avisa uma vez no log pra incentivar configurar, sem
    // incomodar por e-mail (não é um erro, é uma recomendação).
    logger.info('verificacaoCredenciais', 'data_rotacao_nao_configurada', {
      dica: 'Defina PLACA_API_TOKEN_DEFINIDO_EM no .env para habilitar o lembrete de rotação de credenciais.'
    });
    return;
  }

  const data = new Date(dataConfiguracao);
  if (Number.isNaN(data.getTime())) {
    logger.aviso('verificacaoCredenciais', 'data_rotacao_invalida', { valorConfigurado: dataConfiguracao });
    return;
  }

  const idadeDias = diasDesde(data);
  if (idadeDias < DIAS_PARA_ROTACAO) {
    logger.info('verificacaoCredenciais', 'credencial_dentro_do_prazo', {
      idadeDias,
      limiteDias: DIAS_PARA_ROTACAO
    });
    return;
  }

  logger.aviso('verificacaoCredenciais', 'credencial_vencida', {
    idadeDias,
    limiteDias: DIAS_PARA_ROTACAO,
    integracao: 'busca-placa'
  });

  // Depois de vencida, lembra 1x por semana (não a cada request/verificação
  // — isso lotaria a caixa de entrada) até alguém atualizar a data.
  if (!config.alertas.emailDestino) return;
  if (!podeEnviarAlerta(CHAVE_ALERTA, UMA_SEMANA_MS)) return;

  try {
    await enviarEmailAlertaIntegracao({
      destinatarioEmail: config.alertas.emailDestino,
      nomeIntegracao: 'Rotação de credencial — Busca de veículo por placa',
      detalhesErro: `O token da API de busca de placa está configurado há ${idadeDias} dias (limite recomendado: ${DIAS_PARA_ROTACAO} dias). Gere um novo token no painel da APIBrasil, atualize PLACA_API_BEARER_TOKEN/PLACA_API_DEVICE_TOKEN e também PLACA_API_TOKEN_DEFINIDO_EM no .env com a data de hoje.`
    });
  } catch (err) {
    logger.erro('verificacaoCredenciais', 'falha_enviar_lembrete', { erro: err.message });
  }
}

module.exports = { verificarRotacaoCredencialPlaca };
