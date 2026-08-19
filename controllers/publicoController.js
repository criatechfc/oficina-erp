const OrdemServico = require('../models/OrdemServico');
const Configuracao = require('../models/Configuracao');
const { registrarAuditoria } = require('../utils/auditoria');
const { executarComOficina } = require('../utils/tenantContext');
const { enfileirarNotificacao, montarMensagemConfirmacaoServico } = require('../services/whatsappService');

/**
 * Rotas PÚBLICAS (sem login) — portal do cliente.
 *
 * O acesso é feito por um token aleatório de 40 caracteres embutido na URL
 * (ver OrdemServico.tokenPublico), não por ID sequencial nem por login.
 * Isso significa: quem tem o link só enxerga ESTA ordem de serviço — nunca
 * a lista de OS da oficina, nem dados de outro cliente ou outra oficina.
 *
 * Estas rotas rodam ANTES do middleware de autenticação (ver server.js),
 * então não existe req.usuario/req.oficina aqui. A busca é sempre feita
 * pelo token, que já é globalmente único.
 */

async function buscarOsPorToken(token) {
  if (!token) return null;
  return OrdemServico.findOne({ tokenPublico: token })
    .populate('cliente', 'nome')
    .populate('moto', 'marca modelo placa tipo')
    .populate('mecanico', 'nome')
    .populate('historicoStatus.usuario', 'nome');
}

async function verPublico(req, res, next) {
  try {
    const os = await buscarOsPorToken(req.params.token);
    if (!os) {
      return res.status(404).render('publico/nao-encontrado', { titulo: 'Link inválido', layout: false });
    }

    const configuracao = await Configuracao.findOne({ chave: 'geral' });

    return res.render('publico/acompanhar', {
      titulo: `Acompanhar OS Nº ${os.numero}`,
      os,
      configuracao,
      statusLista: OrdemServico.STATUS_OS,
      layout: false
    });
  } catch (err) {
    return next(err);
  }
}

async function aprovar(req, res, next) {
  try {
    const os = await buscarOsPorToken(req.params.token);
    if (!os) {
      return res.status(404).render('publico/nao-encontrado', { titulo: 'Link inválido', layout: false });
    }

    if (os.status === 'aguardando_aprovacao' && os.aprovacaoStatus === 'pendente') {
      await executarComOficina(os.oficina, async () => {
        os.aprovacaoStatus = 'aprovado';
        os.aprovacaoData = new Date();
        os.status = 'em_manutencao';
        os.historicoStatus.push({ status: 'em_manutencao', observacao: 'Orçamento aprovado pelo cliente pelo portal público.' });
        await os.save();

        await registrarAuditoria(
          { usuario: null, ip: req.ip },
          { modulo: 'ordensServico', acao: 'editar', referenciaId: os._id, descricao: `OS Nº ${os.numero} aprovada pelo cliente (portal público)` }
        );

        if (os.cliente?.whatsapp) {
          await enfileirarNotificacao({
            tipo: 'confirmacao_servico',
            cliente: os.cliente,
            ordemServico: os,
            destinatarioNome: os.cliente.nome,
            destinatarioTelefone: os.cliente.whatsapp,
            mensagem: montarMensagemConfirmacaoServico(os.cliente, os)
          });
        }
      });
    }

    req.session.mensagemSucesso = 'Orçamento aprovado! A oficina já foi avisada e vai começar o serviço.';
    return res.redirect(`/acompanhar/${os.tokenPublico}`);
  } catch (err) {
    return next(err);
  }
}

async function recusar(req, res, next) {
  try {
    const os = await buscarOsPorToken(req.params.token);
    if (!os) {
      return res.status(404).render('publico/nao-encontrado', { titulo: 'Link inválido', layout: false });
    }

    if (os.status === 'aguardando_aprovacao' && os.aprovacaoStatus === 'pendente') {
      await executarComOficina(os.oficina, async () => {
        os.aprovacaoStatus = 'recusado';
        os.aprovacaoData = new Date();
        os.aprovacaoObservacao = (req.body.motivo || '').trim().slice(0, 500);
        os.historicoStatus.push({
          status: 'aguardando_aprovacao',
          observacao: `Orçamento recusado pelo cliente pelo portal público.${os.aprovacaoObservacao ? ` Motivo: ${os.aprovacaoObservacao}` : ''}`
        });
        await os.save();

        await registrarAuditoria(
          { usuario: null, ip: req.ip },
          { modulo: 'ordensServico', acao: 'editar', referenciaId: os._id, descricao: `OS Nº ${os.numero} recusada pelo cliente (portal público)` }
        );
      });
    }

    req.session.mensagemSucesso = 'Recusa registrada. A oficina foi avisada.';
    return res.redirect(`/acompanhar/${os.tokenPublico}`);
  } catch (err) {
    return next(err);
  }
}

module.exports = { verPublico, aprovar, recusar };
