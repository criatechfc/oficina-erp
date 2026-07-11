const nodemailer = require('nodemailer');
const config = require('../config/config');

let transportador = null;

/**
 * Retorna (e cria, na primeira vez) o transportador SMTP configurado no .env.
 * Se SMTP_HOST/SMTP_USER/SMTP_PASS não estiverem preenchidos, retorna null —
 * quem chamar deve tratar esse caso (o sistema continua funcionando sem e-mail,
 * apenas o link de recuperação não será enviado automaticamente).
 */
function obterTransportador() {
  if (!config.smtp.host || !config.smtp.user || !config.smtp.pass) {
    return null;
  }
  if (!transportador) {
    transportador = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass
      }
    });
  }
  return transportador;
}

/**
 * Envia o e-mail de recuperação de senha com o link para redefinição.
 * Retorna true se enviou, false se o SMTP não está configurado.
 * Lança erro se o SMTP estiver configurado mas o envio falhar (credenciais erradas, etc).
 */
async function enviarEmailRecuperacaoSenha(destinatarioEmail, destinatarioNome, linkReset) {
  const transporte = obterTransportador();
  if (!transporte) return false;

  await transporte.sendMail({
    from: config.smtp.from,
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
  });

  return true;
}

module.exports = { enviarEmailRecuperacaoSenha };
