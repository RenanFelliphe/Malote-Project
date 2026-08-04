import { mergeAttributes, Node } from '@tiptap/core';

export interface NoBotaoOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    noBotao: {
      /**
       * Envolve o(s) parágrafo(s) selecionado(s) num nó `noBotao`, ou
       * desfaz o envolvimento se a seleção já estiver dentro de um (mesmo
       * padrão de `toggleBlockquote` do StarterKit).
       */
      toggleNoBotao: () => ReturnType;
    };
  }
}

/**
 * "Transformar em botão" (refatoracaoEmailFormatado.md — Etapa 7). Nó de
 * bloco customizado, não uma mark — por decisão de escopo registrada no
 * documento, precisa conter outras marcas (negrito, cor, alinhamento) sem
 * conflito, o que uma mark não permitiria (marks não podem envolver blocos
 * nem hospedar parágrafos próprios).
 *
 * `content: 'block+'` (mesmo padrão do `Blockquote` do StarterKit, aqui
 * desativado) em vez de `'inline*'`: o nó envolve parágrafo(s) inteiros, não
 * substitui o parágrafo por texto solto. É isso que mantém o parágrafo
 * interno intacto — com suas próprias marcas e, a partir da Etapa 8, seu
 * próprio alinhamento — em vez de forçar um modelo de conteúdo novo.
 *
 * Atributo de URL (`href`, Etapa 6): o nó passa a poder carregar seu próprio
 * destino, além do que já era possível — aplicar a mark de link (Etapa 5)
 * ao texto interno, normalmente. Os dois convivem sem conflito.
 *
 * Estilo (caixa arredondada, padding, margin, centralizado) fica em CSS
 * (`.email-botao`, em `index.css`) — o nó só marca a estrutura
 * (`data-tipo="botao-email"`). A cor de fundo é exceção a partir desta
 * etapa: quando o atributo `cor` está definido, ela vem inline (`style`),
 * sobrepondo a cor padrão do CSS — ver `addAttributes()` abaixo.
 *
 * Atributos (Etapa 6 — refatoracaoEmailFormatado.md, revisão): `cor` e
 * `href`. Mesma abordagem já usada no projeto para `Link` (atributo de
 * marca) e `Highlight` (atributo `color`), só que aplicada a um node em vez
 * de a uma mark. Nenhuma UI grava esses atributos ainda (isso é a Etapa 7);
 * por ora eles só existem no schema, com `default: null` — sem valor
 * definido, `renderHTML` de cada um devolve `{}` (nenhum atributo extra no
 * HTML), então o botão continua exatamente como está hoje: cor fixa do CSS
 * (`.email-botao`) e sem link. `parseHTML`/`renderHTML` fazem o round-trip
 * via `data-cor`/`data-href` — mesmo padrão de `data-color` do `Highlight`
 * (ver `sanitizarHtml.ts`: qualquer atributo `data-*` já é liberado por
 * padrão pelo DOMPurify, então nenhuma mudança foi necessária lá).
 */
export const NoBotao = Node.create<NoBotaoOptions>({
  name: 'noBotao',
  group: 'block',
  content: 'block+',
  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      /** Cor de fundo do botão (Etapa 6). `null` = usa a cor padrão do CSS (`.email-botao`). */
      cor: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-cor'),
        renderHTML: (attributes) => {
          if (!attributes.cor) {
            return {};
          }
          return {
            'data-cor': attributes.cor as string,
            style: `background-color: ${attributes.cor}`,
          };
        },
      },
      /** Destino do botão (Etapa 6). `null` = sem link (comportamento atual). */
      href: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-href'),
        renderHTML: (attributes) => {
          if (!attributes.href) {
            return {};
          }
          return {
            'data-href': attributes.href as string,
          };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-tipo="botao-email"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-tipo': 'botao-email',
        class: 'email-botao',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      toggleNoBotao:
        () =>
        ({ commands }) => {
          return commands.toggleWrap(this.name);
        },
    };
  },
});

export default NoBotao;
