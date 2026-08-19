/**
 * Gera um link "clique para conversar" do WhatsApp (wa.me).
 * Ao clicar, abre o WhatsApp Web (no PC) ou o app (no celular) já com a
 * mensagem preenchida na conversa com o número informado — quem envia é
 * a pessoa que clicou, manualmente. Não requer nenhuma conta, API ou
 * credencial: é o mesmo link usado em botões "Fale conosco" de sites.
 *
 * @param {string} telefone - telefone do destinatário (com ou sem formatação)
 * @param {string} mensagem - texto que já vem preenchido na conversa
 * @returns {string|null} URL pronta para usar em um link, ou null se não houver telefone
 */
function construirLinkWhatsApp(telefone, mensagem) {
  if (!telefone) return null;
  const somenteDigitos = telefone.replace(/\D/g, '');
  if (!somenteDigitos) return null;
  const comCodigoPais = somenteDigitos.startsWith('55') ? somenteDigitos : `55${somenteDigitos}`;
  return `https://wa.me/${comCodigoPais}?text=${encodeURIComponent(mensagem || '')}`;
}

module.exports = { construirLinkWhatsApp };
