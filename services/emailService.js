const config = require('../config/config');

/**
 * Envia o e-mail de recuperação de senha usando a API HTTP do Resend
 * (https://resend.com), em vez de SMTP tradicional.
 *
 * Motivo: provedores de hospedagem gratuitos (como o Render free tier)
 * costumam bloquear tráfego de saída nas portas SMTP (25/465/587) para
 * evitar abuso/spam. A API do Resend funciona via HTTPS normal (porta 443),
 * a mesma usada pelo próprio site, então não sofre esse bloqueio.
 *
 * Retorna true se enviou, false se RESEND_API_KEY não está configurada
 * (o sistema continua funcionando sem e-mail; o link de recuperação fica
 * apenas registrado no log do servidor).
 * Lança erro se a API key estiver configurada mas o envio falhar.
 */
async function enviarEmailRecuperacaoSenha(destinatarioEmail, destinatarioNome, linkReset) {
  if (!config.resend.apiKey) return false;

  const resposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resend.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: config.resend.from,
      to: destinatarioEmail,
      subject: 'Recuperação de senha - Oficina ERP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #0f172a;">
          <h2 style="margin-bottom: 4px;">Recuperação de senha</h2>
          <p>Olá, ${destinatarioNome}.</p>
          <p>Recebemos uma solicitação para redefinir a senha da sua conta no Oficina ERP. Clique no botão abaixo para escolher uma nova senha:</p>
          <p style="text-align:center; margin: 28px 0;">
            <a href="${linkReset}" style="background:#2563eb; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold;">Redefinir minha senha</a>
          </p>
          <p style="font-size:13px; color:#64748b;">Este link expira em 1 hora. Se você não solicitou essa alteração, pode ignorar este e-mail com segurança — sua senha atual continuará válida.</p>
        </div>
      `
    })
  });

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => '');
    throw new Error(`Resend respondeu ${resposta.status}: ${corpo}`);
  }

  return true;
}

/**
 * Envia um e-mail de alerta quando uma integração externa (ex.: busca de
 * veículo por placa) para de funcionar. Usa o mesmo Resend já configurado
 * para recuperação de senha — não precisa de nenhuma credencial nova.
 *
 * Assim como o e-mail de recuperação, retorna false silenciosamente se
 * RESEND_API_KEY não estiver configurada (o sistema continua funcionando
 * normalmente, só não avisa por e-mail).
 */
async function enviarEmailAlertaIntegracao({ destinatarioEmail, nomeIntegracao, detalhesErro }) {
  if (!config.resend.apiKey) return false;
  if (!destinatarioEmail) return false;

  const resposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resend.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: config.resend.from,
      to: destinatarioEmail,
      subject: `⚠️ Alerta: ${nomeIntegracao} parou de funcionar - Oficina ERP`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #0f172a;">
          <h2 style="margin-bottom: 4px; color:#b91c1c;">⚠️ Integração com falha</h2>
          <p>A integração <strong>${nomeIntegracao}</strong> do Oficina ERP parou de responder corretamente.</p>
          <p style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:12px; font-size:13px; font-family:monospace; white-space:pre-wrap;">${detalhesErro}</p>
          <p style="font-size:13px; color:#64748b;">O restante do sistema continua funcionando normalmente — apenas essa integração específica está indisponível no momento. Este alerta não é repetido a cada tentativa; se o problema persistir, um novo aviso será enviado depois de um tempo.</p>
        </div>
      `
    })
  });

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => '');
    console.error(`[EmailAlerta] Falha ao enviar alerta de "${nomeIntegracao}": Resend respondeu ${resposta.status}: ${corpo}`);
    return false;
  }

  return true;
}

module.exports = { enviarEmailRecuperacaoSenha, enviarEmailAlertaIntegracao };
