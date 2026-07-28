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
 * Sem atributo de URL: o nó é só um contêiner com estilo fixo (Etapa 7 não
 * pede link embutido). Se o botão precisar apontar para algum lugar, o link
 * é aplicado ao texto interno com a mark de link da Etapa 5, normalmente.
 *
 * Estilo (caixa arredondada, cor de fundo, padding, margin, centralizado)
 * fica inteiramente em CSS (`.email-botao`, em `index.css`) — o nó em si só
 * marca a estrutura (`data-tipo="botao-email"`).
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
