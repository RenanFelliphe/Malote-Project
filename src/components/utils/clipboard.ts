/**
 * Util de clipboard compartilhado.
 *
 * Extraído da lógica que existia dentro do `ListarEmailsModal` (agora
 * removido) para ser reaproveitado pelos botões de copiar nos cabeçalhos
 * "Nome" e "E-mail" da tabela principal (seção 7).
 */

/**
 * Copia uma lista de valores para a área de transferência, unindo-os em uma
 * única string separada por `;` (mesmo padrão usado anteriormente no modal
 * "Listar E-mails" para copiar e-mails) — sem espaços entre os itens e sem
 * deduplicação: cada valor da lista, na ordem em que é passado, aparece uma
 * vez no resultado.
 *
 * Tenta primeiro a Clipboard API; se ela não estiver disponível (contexto
 * não seguro, navegador antigo, permissão negada etc.), recorre ao fallback
 * via `document.execCommand('copy')`.
 */
export async function copiarTexto(valores: string[]): Promise<void> {
  const texto = valores.join(';');

  try {
    await navigator.clipboard.writeText(texto);
    return;
  } catch {
    // Segue para o fallback abaixo.
  }

  const textarea = document.createElement('textarea');
  textarea.value = texto;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
