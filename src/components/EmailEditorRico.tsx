import { EditorContent, useEditor } from '@tiptap/react';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';

import { NoBotao } from './editor/extensoes/NoBotao';
import { TableCellComCor, TableHeaderComCor } from './editor/extensoes/CorCelula';
import { FontSize } from './editor/extensoes/FontSize';
import { Indentacao } from './editor/extensoes/Indentacao';
import { EmailEditorToolbar } from './EmailEditorToolbar';
import { EmojiPickerFlutuante } from './EmojiPickerFlutuante';
import { sanitizarHtml } from './utils/sanitizarHtml';

/**
 * Tags sem nenhuma representação textual válida no editor (Etapa 9 —
 * refatoracaoEmailFormatado.md): nenhuma extensão suportada consegue
 * expressar o que elas representam, e manter só o texto de dentro (como se
 * faz com uma tag "desconhecida" comum, ex.: `<h1>`, `<table>`, `<div>`)
 * não faz sentido para nenhuma delas — é conteúdo binário/executável/de
 * controle (imagem, mídia, formulário, script). Por isso são removidas
 * inteiramente, com todo o conteúdo, em vez de desembrulhadas.
 */
const TAGS_REMOVER_COM_CONTEUDO = new Set([
  'script',
  'style',
  'meta',
  'link',
  'title',
  'head',
  'img',
  'picture',
  'iframe',
  'object',
  'embed',
  'svg',
  'canvas',
  'audio',
  'video',
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'noscript',
]);

/** Remove nós de comentário (`<!-- ... -->`), inclusive os comentários
 * condicionais que o Word usa para marcar blocos inteiros de HTML
 * proprietário (`<!--[if gte mso 9]-->...<!--[endif]-->`). Sem essa
 * remoção, o conteúdo dentro deles — que o navegador não considera
 * elementos de verdade, só texto de comentário — pode sobrar como texto
 * solto e estranho depois da colagem. */
function removerComentarios(raiz: Element) {
  const documento = raiz.ownerDocument;
  const walker = documento.createTreeWalker(raiz, NodeFilter.SHOW_COMMENT);
  const comentarios: Comment[] = [];
  let atual = walker.nextNode();
  while (atual) {
    comentarios.push(atual as Comment);
    atual = walker.nextNode();
  }
  comentarios.forEach((comentario) => comentario.parentNode?.removeChild(comentario));
}

/**
 * Percorre a árvore colada normalizando cada elemento (recursivamente,
 * filhos primeiro, já que remover/desembrulhar um pai não deve impedir que
 * os filhos dele já tenham sido tratados). Duas ações possíveis:
 *
 * - Tag da lista `TAGS_REMOVER_COM_CONTEUDO`: remove o elemento inteiro.
 * - Tag namespaced do Word (`o:p`, `w:sdt`, `v:shape`...): desembrulha
 *   (mantém os filhos/texto no lugar, descarta só a tag em si) — é a regra
 *   de "convertido para texto simples" do plano, para não perder conteúdo
 *   por causa de uma tag que o navegador nem reconhece como HTML padrão.
 *
 * Qualquer outra tag não fica a cargo desta função: tags HTML padrão fora
 * do conjunto suportado pelo editor (`<h1>`, `<table>`, `<div>` sem os
 * atributos esperados etc.) já são resolvidas pelo próprio parser do
 * ProseMirror ao montar o documento a partir do HTML normalizado — ele
 * ignora a tag e tenta preservar o conteúdo de texto de dentro dela.
 */
function normalizarElemento(elemento: Element) {
  Array.from(elemento.childNodes).forEach((filho) => {
    if (filho.nodeType !== Node.ELEMENT_NODE) return;
    const filhoElemento = filho as Element;
    normalizarElemento(filhoElemento);

    const tag = filhoElemento.tagName.toLowerCase();
    if (TAGS_REMOVER_COM_CONTEUDO.has(tag)) {
      filhoElemento.remove();
      return;
    }

    const namespaced = tag.includes(':');
    if (namespaced) {
      filhoElemento.replaceWith(...Array.from(filhoElemento.childNodes));
    }
  });
}

/**
 * Normaliza o HTML colado de fora (Gmail, Outlook, Word etc.) antes do
 * Tiptap reconstruir o documento a partir dele — usado em
 * `editorProps.transformPastedHTML` (Etapa 9 —
 * refatoracaoEmailFormatado.md). Ver `normalizarElemento` e
 * `removerComentarios` para o que é tratado e por quê.
 *
 * Se o parsing falhar por algum motivo (HTML malformado vindo de uma
 * origem inesperada), retorna o HTML original sem alterações: colar
 * continua funcionando normalmente — o parser do Tiptap ainda faz a
 * própria tentativa de leitura — só não recebe a limpeza extra desta
 * função.
 */
function normalizarHtmlColado(html: string): string {
  try {
    const documento = new DOMParser().parseFromString(html, 'text/html');
    removerComentarios(documento.body);
    normalizarElemento(documento.body);
    return documento.body.innerHTML;
  } catch {
    return html;
  }
}

interface Props {
  id?: string;
  /** HTML atual do corpo do e-mail (ver `EmailConteudo.conteudo`). */
  value: string;
  /** Chamado a cada alteração, já com o HTML atualizado (`editor.getHTML()`). */
  onChange: (html: string) => void;
  /**
   * Chamado a cada alteração com o tamanho do **texto visível**
   * (`editor.getText().length`), não o tamanho da string HTML. Existe para
   * que o componente pai (`EmailConteudoModal`) possa exibir um contador de
   * caracteres correto sem precisar da instância do editor em si (ver
   * `Etapa 2 — Atenção`, refatoracaoEmailFormatado.md).
   */
  onContagemChange?: (tamanho: number) => void;
  placeholder?: string;
}

/**
 * Editor de corpo do e-mail com formatação rica, baseado em Tiptap (ver
 * refatoracaoEmailFormatado.md — Etapas 2 e 3). Substitui o antigo
 * `<textarea>` de texto puro por um editor WYSIWYG que produz/consome HTML,
 * com a barra de ferramentas (`EmailEditorToolbar`) logo acima da área de
 * edição — ambos nascem juntos aqui porque a toolbar precisa da mesma
 * instância do editor para aplicar comandos e refletir o estado ativo dos
 * botões, então não há necessidade de expor o editor para o componente pai
 * (`EmailConteudoModal`).
 *
 * Nós do `StarterKit` fora do escopo do plano (título, citação, bloco de
 * código, código inline) ficam desativados — o objetivo declarado é um
 * formatador simples, não um processador de texto completo. Linha
 * horizontal (RefatoracaoToolbarEmail.md — Etapa 6) é a exceção: veio
 * desativada nesta mesma lista até esta etapa, mas o plano pede o botão na
 * toolbar, então foi reabilitada — ver o comentário junto de
 * `StarterKit.configure`, abaixo.
 *
 * Cor de texto, realce e tamanho da fonte (Etapa 4 — refatoracaoEmailFormatado.md
 * e RefatoracaoToolbarEmail.md) dependem de `TextStyle` como base — por isso
 * `TextStyle`, `Color` e `FontSize` (`editor/extensoes/FontSize.ts`, que
 * estende a mesma mark `textStyle` com o atributo `fontSize`) entram juntas,
 * seguidas de `Highlight`. `Highlight` usa `multicolor: true` para aceitar a paleta fixa definida em
 * `EmailEditorToolbar.tsx`, em vez da cor única padrão da extensão.
 *
 * Link (Etapa 5): `openOnClick: false` evita navegar para fora do editor ao
 * clicar num link já aplicado (o clique deve editar o link, não segui-lo);
 * `autolink: false` mantém a aplicação de links restrita ao botão da
 * toolbar, sem auto-detecção de URLs digitadas.
 *
 * "Transformar em botão" (Etapa 7): nó de bloco customizado (`NoBotao`, em
 * `editor/extensoes/NoBotao.ts`), não uma extensão oficial do Tiptap — não
 * existe pronta para esse comportamento (envolver parágrafo(s) numa caixa
 * estilizada que ainda aceita marcas internas). Ver o próprio arquivo da
 * extensão para os detalhes do modelo de conteúdo escolhido.
 *
 * Alinhamento (Etapa 8): `TextAlign` configurada para os tipos `paragraph` e
 * `noBotao` — precisa incluir `noBotao` para que o alinhamento continue
 * aplicável dentro do botão estilizado da Etapa 7, como o plano exige.
 *
 * Recuo (RefatoracaoToolbarEmail.md — Etapa 5): `Indentacao`
 * (`editor/extensoes/Indentacao.ts`) acrescenta o atributo `indent` a
 * `paragraph`/`listItem` (não há extensão oficial do Tiptap para isso — ver
 * a seção 2 do plano), no mesmo mecanismo de atributo global que
 * `TextAlign`, acima, já usa para `paragraph`/`noBotao`.
 *
 * Colar formatado (Etapa 9): `editorProps.transformPastedHTML` roda
 * `normalizarHtmlColado` (abaixo) sobre o HTML colado antes do Tiptap
 * reconstruir o documento a partir dele. A normalização em si não
 * reimplementa a lista de marcas/nós suportados — isso já é papel de cada
 * extensão registrada (via `parseHTML`) e do parser do ProseMirror, que já
 * descarta silenciosamente qualquer tag/atributo sem correspondência no
 * schema, preservando o texto como parágrafo simples. Esta função só
 * resolve o que esse parser padrão não resolveria sozinho, sem ajuda:
 * comentários (inclusive os condicionais do Word, `<!--[if ...]-->`), tags
 * namespaced (`o:p`, `w:sdt`...) e elementos sem nenhuma representação
 * textual válida (imagem, vídeo, formulário, script...). Ver a
 * documentação de `normalizarHtmlColado` para o detalhe de cada caso.
 *
 * Botão flutuante de emojis (refatoracaoEmailFormatado.md, revisão — Etapa
 * 10): `EmojiPickerFlutuante` (revisão — Etapa 9, ver o próprio arquivo) é
 * renderizado aqui — e não em `EmailConteudoModal.tsx` — porque a inserção
 * do emoji escolhido depende diretamente da instância do editor
 * (`editor.chain().focus().insertContent(...)`), que só existe neste
 * componente. O posicionamento visual (`position: absolute`, canto
 * inferior direito) continua resolvendo contra `.modal-email-conteudo`
 * normalmente: nem `.campo-corpo-email` nem nenhum elemento entre os dois
 * declara `position`, então o "containing block" do botão flutuante segue
 * sendo o modal, não este componente — só o `onSelecionarEmoji` precisava
 * estar aqui.
 *
 * Tabela (RefatoracaoTabela.md — Etapa 1): `Table`/`TableRow`/`TableHeader`/
 * `TableCell` registradas com `resizable: true` — só o schema aceitando o
 * nó por enquanto, sem UI própria (o botão "Tabela" da toolbar continua
 * placeholder até a Etapa 2 daquele plano). Ver `sanitizarHtml.ts` para as
 * tags/atributos liberados em paralelo, ou HTML de tabela produzido aqui
 * seria descartado na sanitização. Cor de célula (Etapa 4): `TableHeader`/
 * `TableCell` entram como `TableHeaderComCor`/`TableCellComCor`
 * (`editor/extensoes/CorCelula.ts`), que só acrescentam o atributo
 * `corFundo` aos nós base — nenhuma outra configuração muda.
 *
 * Sanitização (Etapa 10 — refatoracaoEmailFormatado.md): `normalizarHtmlColado`
 * ajusta a *estrutura* do HTML colado ao schema do editor, mas não tem como
 * objetivo remover conteúdo malicioso — um `<a href="javascript:...">` ou um
 * atributo `onerror` continuam sendo HTML "normal" do ponto de vista da
 * função. Por isso `transformPastedHTML` encadeia `sanitizarHtml` (de
 * `utils/sanitizarHtml.ts`) depois da normalização, e `onUpdate` sanitiza de
 * novo o HTML resultante antes de repassá-lo a `onChange` — cobre tanto o
 * que entra colado quanto qualquer HTML que a própria reconstrução do
 * documento pelo ProseMirror venha a produzir. `content` (o HTML já salvo,
 * vindo do componente pai) também passa por `sanitizarHtml` antes de virar o
 * conteúdo inicial do editor, para não confiar cegamente em `conteudo` já
 * gravado anteriormente. Ver `sanitizarHtml.ts` para a lista de tags/atributos
 * permitidos e o porquê de cada um.
 */
export function EmailEditorRico({ id, value, onChange, onContagemChange, placeholder }: Props) {
  const editor = useEditor({
    // Este é um app puramente client-side (Vite/CSR), sem SSR — desativar
    // explicitamente evita o aviso de hidratação que o Tiptap 3 emite por
    // padrão quando não sabe se está rodando em ambiente com SSR.
    immediatelyRender: false,
    extensions: [
      // Linha horizontal (RefatoracaoToolbarEmail.md — Etapa 6): o plano
      // presumia que `horizontalRule` já vinha habilitado por padrão dentro
      // do `StarterKit` — na prática, ao inspecionar esta configuração para
      // começar a etapa, ela estava na mesma lista de nós desligados que
      // heading/blockquote/codeBlock/code (linha removida abaixo). Reabilitada
      // aqui; nenhuma extensão adicional foi instalada, só a remoção do
      // `false` que já a desligava.
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
      }),
      // Negrito, itálico e tachado já vêm do StarterKit; sublinhado precisa
      // da extensão própria (Etapa 3 — refatoracaoEmailFormatado.md).
      Underline,
      // Cor de texto e realce (Etapa 4 — refatoracaoEmailFormatado.md).
      TextStyle,
      Color,
      // Tamanho da fonte (Etapa 4 — RefatoracaoToolbarEmail.md): estende a
      // mesma mark `textStyle` que `Color` já usa (ver
      // `editor/extensoes/FontSize.ts`) — por isso entra logo depois dela,
      // agrupada com o resto do que se apoia em `textStyle`.
      FontSize,
      Highlight.configure({ multicolor: true }),
      // Link (Etapa 5 — refatoracaoEmailFormatado.md).
      Link.configure({
        openOnClick: false,
        autolink: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      // "Transformar em botão" (Etapa 7 — refatoracaoEmailFormatado.md).
      NoBotao,
      // Alinhamento de texto (Etapa 8 — refatoracaoEmailFormatado.md). Só
      // `paragraph` e `noBotao` (o nó de botão da Etapa 7) — não há outros
      // tipos de bloco habilitados no editor. Direita e justificado
      // (refatoracaoEmailFormatado.md, revisão — Etapa 2) habilitados aqui:
      // já eram suportados nativamente pela extensão, só não constavam em
      // `alignments`.
      TextAlign.configure({
        types: ['paragraph', 'noBotao'],
        alignments: ['left', 'center', 'right', 'justify'],
        defaultAlignment: 'left',
      }),
      // Recuo (RefatoracaoToolbarEmail.md — Etapa 5). Só `paragraph` e
      // `listItem` (não `noBotao`) — o plano restringe o recuo a
      // parágrafo/item de lista, sem pedir suporte dentro do botão
      // estilizado.
      Indentacao,
      // Tabela (RefatoracaoTabela.md — Etapa 1): só o schema por enquanto,
      // sem UI — o botão "Tabela" na toolbar segue placeholder até a Etapa
      // 2. `resizable: true` já habilitado aqui porque é a própria extensão
      // que resolve largura de coluna por arraste nativamente (ver seção 2
      // do plano); nenhuma UI adicional depende disso além do que a
      // extensão já oferece sozinha.
      Table.configure({ resizable: true }),
      TableRow,
      // Cor de célula (RefatoracaoTabela.md — Etapa 4): `TableHeaderComCor`/
      // `TableCellComCor` (`editor/extensoes/CorCelula.ts`) estendem os nós
      // base só para declarar o atributo `corFundo`, round-trip via
      // `style="background-color"` — ver o próprio arquivo para o porquê de
      // precisar dos dois.
      TableHeaderComCor,
      TableCellComCor,
      Placeholder.configure({
        placeholder: placeholder ?? '',
      }),
    ],
    // Sanitização (Etapa 10 — refatoracaoEmailFormatado.md): não confia
    // cegamente em `conteudo` já salvo (pode ter sido gravado por uma versão
    // anterior do sistema, ou editado fora dele) — mesma sanitização aplicada
    // ao HTML colado, ver `sanitizarHtml.ts`.
    content: sanitizarHtml(value),
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        class: 'campo-corpo-email-editor',
      },
      // Colar formatado (Etapa 9 — refatoracaoEmailFormatado.md): roda
      // antes do HTML colado virar documento do editor. Ver
      // `normalizarHtmlColado` para o que é normalizado e por quê.
      // Sanitização (Etapa 10): encadeada logo depois — `normalizarHtmlColado`
      // cuida da estrutura, `sanitizarHtml` remove o que for potencialmente
      // malicioso (ver `sanitizarHtml.ts`).
      transformPastedHTML: (html) => sanitizarHtml(normalizarHtmlColado(html)),
    },
    onUpdate: ({ editor }) => {
      // Sanitização (Etapa 10): aplicada de novo aqui, sobre o HTML que sai
      // do editor a cada alteração — antes de `onChange` repassar o valor
      // para ser salvo (`EmailConteudoModal.tsx`). Cinturão e suspensório em
      // relação ao `transformPastedHTML`: cobre qualquer HTML que a própria
      // reconstrução do documento pelo ProseMirror venha a produzir, não só
      // o que entrou colado.
      onChange(sanitizarHtml(editor.getHTML()));
      onContagemChange?.(editor.getText().length);
    },
    onCreate: ({ editor }) => onContagemChange?.(editor.getText().length),
  });

  // Botão flutuante de emojis (revisão — Etapa 10): insere o caractere
  // Unicode escolhido no popover diretamente no cursor atual do editor.
  // `insertContent` é a API padrão do Tiptap para isso; `focus()` antes
  // garante que a inserção aconteça na posição em que o usuário estava
  // editando, mesmo que o clique no botão/popover tenha tirado o foco do
  // editor. Nenhum tratamento especial é necessário depois: o emoji é só
  // texto Unicode dentro de um `<p>`, já coberto pela sanitização e pela
  // exportação "email-safe" existentes.
  function handleSelecionarEmoji(emoji: string) {
    editor?.chain().focus().insertContent(emoji).run();
  }

  return (
    <>
      <div className="campo-corpo-email">
        <EmailEditorToolbar editor={editor} />
        <EditorContent editor={editor} />
        <EmojiPickerFlutuante onSelecionarEmoji={handleSelecionarEmoji} />
      </div>
    </>
  );
}