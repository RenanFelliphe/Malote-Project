import { Extension } from '@tiptap/core';

// `@tiptap/extension-text-style` já é uma dependência indireta do projeto
// (via `Color`, que estende a mesma mark) — só o tipo de comando é
// declarado aqui, sem precisar reimportar a extensão em si.
import '@tiptap/extension-text-style';

export interface FontSizeOptions {
  /**
   * Tipos de nó/mark que recebem o atributo `fontSize` — só `textStyle`,
   * mesma mark que `Color` (`setColor`/`unsetColor`) já estende no projeto.
   */
  types: string[];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      /** Aplica um tamanho de fonte à seleção atual (ex.: `'14px'`). */
      setFontSize: (tamanho: string) => ReturnType;
      /** Remove o tamanho de fonte da seleção atual, voltando ao padrão do bloco. */
      unsetFontSize: () => ReturnType;
    };
  }
}

/**
 * Tamanho de fonte (RefatoracaoToolbarEmail.md — Etapa 4).
 *
 * Segue a mesma decisão de escopo já usada no projeto para cor de
 * texto/realce (`PALETA_COR_TEXTO`/`PALETA_REALCE`, em
 * `EmailEditorToolbar.tsx`): nenhum input livre, só uma lista curada de
 * tamanhos (ver `TAMANHOS_FONTE`, no próprio `EmailEditorToolbar.tsx`) —
 * mantém o resultado visual consistente entre e-mails.
 *
 * Implementado como `Extension` (não uma `Mark` nova) que estende a mark
 * `textStyle` já registrada no editor via `addGlobalAttributes` — o mesmo
 * mecanismo que `@tiptap/extension-color` usa para acrescentar `color` à
 * mesma mark. `textStyle` já grava/lê seus atributos como propriedades do
 * `style` inline do `<span>` que ela renderiza (round-trip padrão do
 * Tiptap para esse tipo de mark) — por isso não é preciso escrever
 * `renderHTML`/`parseHTML` do zero aqui, só declarar como o atributo
 * `fontSize` deve ser lido/escrito dentro desse `style`.
 *
 * Uso: adicionar `FontSize` à lista de extensões do editor (em
 * `EmailEditorRico.tsx`), depois de `TextStyle`/`Color` (mesma mark que
 * eles estendem — a ordem entre extensões que só usam
 * `addGlobalAttributes` não importa de fato, mas mantém o agrupamento
 * lógico "tudo que estende `textStyle`" junto na lista).
 */
export const FontSize = Extension.create<FontSizeOptions>({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (elemento: HTMLElement) => elemento.style.fontSize || null,
            renderHTML: (attributes: { fontSize?: string | null }) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (tamanho: string) =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize: tamanho }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
        },
    };
  },
});

export default FontSize;
