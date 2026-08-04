/**
 * Util de clipboard compartilhado.
 *
 * Extraído da lógica que existia dentro do `ListarEmailsModal` (agora
 * removido) para ser reaproveitado pelos botões de copiar nos cabeçalhos
 * "Nome" e "E-mail" da tabela principal (seção 7).
 */

import { converterParaHtmlEmailSeguro } from './emailHtmlInline';

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

/**
 * Extrai o texto visível de uma string HTML, preservando quebras de linha
 * entre parágrafos e itens de lista (refatoracaoEmailFormatado.md — Etapa
 * 13, fallback `text/plain` de `copiarHtml` abaixo). Ler `textContent`
 * diretamente concatenaria todo o corpo numa única linha, sem nenhuma
 * separação entre parágrafos/itens — por isso cada `p`/`li`/`div` (este
 * último cobre o nó de botão da Etapa 7, que é uma `div`) recebe uma quebra
 * de linha ao final antes da extração; múltiplas quebras seguidas (ex.:
 * parágrafo vazio) são colapsadas em uma só.
 */
function extrairTextoVisivel(html: string): string {
  const documento = new DOMParser().parseFromString(html, 'text/html');
  documento.body.querySelectorAll('p, li, div').forEach((elemento) => {
    elemento.append(documento.createTextNode('\n'));
  });
  return (documento.body.textContent ?? '').replace(/\n{2,}/g, '\n').trim();
}

/**
 * Copia o corpo do e-mail com formatação preservada
 * (refatoracaoEmailFormatado.md — Etapa 13, fecha o segundo lado da demanda
 * original: colar já formatado no Gmail/Outlook). Recebe o HTML bruto do
 * editor (`EmailConteudo.conteudo`), converte para a versão "email-safe"
 * (`converterParaHtmlEmailSeguro`, Etapa 12 — estilos inline em vez de
 * classes/CSS externo) e escreve um único `ClipboardItem` com duas
 * representações do mesmo conteúdo:
 *
 * - `text/html`: o HTML email-safe — é o que Gmail/Outlook usam ao colar,
 *   preservando negrito/cor/link/botão/listas/alinhamento.
 * - `text/plain`: o texto visível equivalente (`extrairTextoVisivel`),
 *   fallback para qualquer destino que não aceite HTML colado (ex.: um
 *   campo de texto puro, ou um editor mais simples).
 *
 * Se `navigator.clipboard.write`/`ClipboardItem` não estiverem disponíveis
 * (navegador antigo, contexto não seguro) ou a chamada falhar por qualquer
 * outro motivo (ex.: permissão negada), recorre a `copiarTexto` só com o
 * texto visível — perde a formatação nesse caminho, mas a cópia em si ainda
 * funciona.
 */
export async function copiarHtml(html: string): Promise<void> {
  const htmlSeguro = converterParaHtmlEmailSeguro(html);
  const textoVisivel = extrairTextoVisivel(htmlSeguro);

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([htmlSeguro], { type: 'text/html' }),
        'text/plain': new Blob([textoVisivel], { type: 'text/plain' }),
      }),
    ]);
    return;
  } catch {
    // Segue para o fallback abaixo.
  }

  await copiarTexto([textoVisivel]);
}
