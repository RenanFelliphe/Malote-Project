import DOMPurify from 'dompurify';

/**
 * Sanitização do HTML colado/armazenado (refatoracaoEmailFormatado.md —
 * Etapa 10). O HTML que chega ao editor tem duas origens não confiáveis:
 * conteúdo colado de fora (Gmail, Outlook, Word — já normalizado por
 * `normalizarHtmlColado`, em `EmailEditorRico.tsx`, mas normalização não é
 * sanitização: ela ajusta a estrutura para o schema do editor, não remove
 * conteúdo malicioso) e o próprio `EmailConteudo.conteudo` já salvo (que
 * pode ter sido editado fora da aplicação, ou vir de uma versão futura dela
 * com menos restrições). Sem essa etapa, HTML malicioso colado (ex.:
 * `<img src=x onerror="...">`, `<a href="javascript:...">`) ficaria salvo
 * tal como está e seria executado em qualquer lugar do sistema que venha a
 * renderizar esse `conteudo` como HTML (hoje: o próprio editor, na
 * reabertura; futuramente, potencialmente também numa pré-visualização).
 *
 * Abordagem: allowlist (`ALLOWED_TAGS`/`ALLOWED_ATTR`), não blocklist —
 * lista-se exatamente o que o conjunto de marcas/nós do editor produz (ver
 * `EmailEditorRico.tsx` e `NoBotao.ts`), e tudo fora disso é descartado por
 * padrão do DOMPurify, em vez de tentar enumerar tags perigosas uma a uma.
 *
 * - `p`, `br`: parágrafo e quebra de linha (base do StarterKit).
 * - `strong`, `em`, `u`, `s`: negrito, itálico, sublinhado, tachado (Etapa
 *   3). O Tiptap normaliza a saída para essas tags (não usa `b`/`i`), mas
 *   elas continuam na lista para não quebrar HTML salvo por uma versão
 *   anterior do editor ou colado de fora já nesse formato.
 * - `span`: portador de `style` para cor de texto e highlight (Etapa 4) —
 *   é como `Color`/`Highlight` renderizam a marca.
 * - `a`: link (Etapa 5).
 * - `ul`, `ol`, `li`: listas simples (Etapa 6).
 * - `div`: usado exclusivamente pelo nó `noBotao` (Etapa 7) — identificado
 *   por `data-tipo="botao-email"`, não por `div` genérico (ver
 *   `ALLOWED_ATTR` e a validação adicional abaixo).
 *
 * `ALLOWED_ATTR`:
 * - `style`: cor de texto/highlight (Etapa 4) e alinhamento (Etapa 8) saem
 *   como `style` inline (`color`, `background-color`, `text-align`). O
 *   próprio DOMPurify já sanitiza o valor do atributo contra vetores
 *   conhecidos (ex.: `url(javascript:...)`) — não é um "escape hatch" para
 *   CSS arbitrário perigoso.
 * - `href`, `target`, `rel`: link (Etapa 5). `href` com esquema
 *   `javascript:` é removido pelo `ALLOWED_URI_REGEXP` padrão do DOMPurify.
 * - `class`: usada só pelo nó de botão (`email-botao`, Etapa 7) para
 *   receber o estilo fixo definido em `index.css`. Mantida na allowlist
 *   porque não há atributo `style` equivalente vindo do editor para esse
 *   caso (o estilo do botão não é inline).
 * - `data-tipo`: marca estrutural do nó de botão (`parseHTML` de
 *   `NoBotao.ts` procura exatamente por `div[data-tipo="botao-email"]`).
 *
 * Deliberadamente fora da lista: `id` (não faz parte do HTML de e-mail —
 * o único uso de `id` no editor é no elemento raiz do `EditorContent`, fora
 * do HTML salvo), qualquer atributo `on*` (bloqueado por não constar em
 * `ALLOWED_ATTR`, reforçado por `FORBID_ATTR` abaixo para deixar explícito),
 * `src`/`srcset` (não há tag de mídia permitida) e `<script>`/`<style>`
 * (nunca chegam a `ALLOWED_TAGS`, então já saem por padrão — listados em
 * `FORBID_TAGS` mesmo assim, para deixar a intenção explícita e resistente
 * a uma futura expansão descuidada de `ALLOWED_TAGS`).
 */
const CONFIGURACAO_SANITIZACAO: Parameters<typeof DOMPurify.sanitize>[1] = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'span', 'a', 'ul', 'ol', 'li', 'div'],
  ALLOWED_ATTR: ['style', 'href', 'target', 'rel', 'class', 'data-tipo'],
  FORBID_TAGS: ['script', 'style', 'img', 'svg', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: [
    'onerror',
    'onload',
    'onclick',
    'onmouseover',
    'onfocus',
    'onblur',
    'onchange',
    'onsubmit',
  ],
  // Só o corpo do e-mail em si — sem permitir que HTML colado injete algo
  // fora do documento do editor.
  WHOLE_DOCUMENT: false,
  RETURN_DOM_FRAGMENT: false,
  RETURN_DOM: false,
};

/**
 * Sanitiza uma string HTML de acordo com o conjunto de marcas/nós suportado
 * pelo editor (ver `CONFIGURACAO_SANITIZACAO` acima). Usada tanto sobre o
 * HTML recém-colado (em `EmailEditorRico.tsx`, depois de
 * `normalizarHtmlColado`) quanto sobre o `conteudo` já salvo, no momento de
 * carregá-lo de volta no editor — cobrindo também conteúdo que tenha
 * chegado ao armazenamento por outro caminho que não o editor.
 */
export function sanitizarHtml(html: string): string {
  return DOMPurify.sanitize(html, CONFIGURACAO_SANITIZACAO);
}

export default sanitizarHtml;
