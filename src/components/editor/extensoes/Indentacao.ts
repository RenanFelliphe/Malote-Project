import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorState } from '@tiptap/pm/state';
import type { Transaction } from '@tiptap/pm/state';

export interface IndentacaoOptions {
  /** Tipos de nó de bloco que recebem o atributo `indent` — parágrafo e
   * item de lista, conforme o texto da Etapa 5. */
  types: string[];
  /** Recuo aplicado por nível, em pixels (vira `margin-left` inline). */
  passoPx: number;
  /** Nível máximo de recuo — limite de segurança para não deixar o texto
   * fugir da largura útil do e-mail em telas estreitas; o plano só pede
   * limite mínimo (zero) explicitamente, este teto é só para não permitir
   * recuo ilimitado. */
  nivelMaximo: number;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indentacao: {
      /** Aumenta o recuo do(s) bloco(s) na seleção atual em um nível. */
      increaseIndent: () => ReturnType;
      /** Diminui o recuo do(s) bloco(s) na seleção atual em um nível — sem
       * efeito abaixo de zero (mesma tolerância de "Limpar formatação"
       * sobre seleção vazia, já usada no projeto). */
      decreaseIndent: () => ReturnType;
    };
  }
}

/**
 * Aplica `delta` (±1 nível) ao atributo `indent` de todo nó de bloco
 * elegível (`options.types`) que a seleção atual toca — não só o nó onde
 * o cursor está, para que selecionar vários parágrafos e clicar uma vez
 * recue todos juntos, mesmo comportamento esperado de "aumentar/diminuir
 * recuo" em qualquer editor de texto. Cada nó é ajustado a partir do seu
 * próprio valor atual (não um valor absoluto compartilhado), então blocos
 * com recuos diferentes na mesma seleção continuam relativos entre si
 * depois do ajuste.
 */
function ajustarRecuo(
  tr: Transaction,
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  options: IndentacaoOptions,
  delta: 1 | -1
): boolean {
  let alterado = false;
  const { from, to } = state.selection;

  state.doc.nodesBetween(from, to, (node: ProseMirrorNode, pos: number) => {
    if (!options.types.includes(node.type.name)) return;

    const atual = (node.attrs.indent as number | null) ?? 0;
    const novo = Math.min(Math.max(atual + delta, 0), options.nivelMaximo);
    if (novo !== atual) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: novo === 0 ? null : novo });
      alterado = true;
    }
  });

  if (alterado && dispatch) dispatch(tr);
  return alterado;
}

/**
 * Recuo de parágrafo/item de lista (RefatoracaoToolbarEmail.md — Etapa 5).
 *
 * O Tiptap não tem extensão oficial de indentação (registrado na seção 2
 * do plano) — implementado aqui como atributo customizado de nó, mesmo
 * mecanismo que `TextAlign` (já configurada em `EmailEditorRico.tsx` para
 * `paragraph`/`noBotao`) já usa neste projeto para acrescentar um atributo
 * a nós que o próprio Tiptap não modela: `addGlobalAttributes` associa
 * `indent` aos tipos de nó em `options.types`, com `renderHTML` devolvendo
 * `style: margin-left: Npx` — o framework funde esse `style` no HTML que o
 * `renderHTML` de cada nó (`Paragraph`, `ListItem`, ambos do `StarterKit`)
 * já produz, sem precisar reescrever esses nós do zero.
 *
 * Os comandos (`increaseIndent`/`decreaseIndent`) não usam
 * `updateAttributes` (que grava um valor absoluto) porque a seleção pode
 * tocar blocos com recuos diferentes entre si — em vez disso, percorrem os
 * nós da seleção (`ajustarRecuo`, acima) e cada um soma/subtrai um nível a
 * partir do próprio valor atual.
 */
export const Indentacao = Extension.create<IndentacaoOptions>({
  name: 'indentacao',

  addOptions() {
    return {
      types: ['paragraph', 'listItem'],
      passoPx: 24,
      nivelMaximo: 8,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: null,
            parseHTML: (elemento: HTMLElement) => {
              const margem = parseFloat(elemento.style.marginLeft || '0');
              if (!margem) return null;
              const nivel = Math.round(margem / this.options.passoPx);
              return nivel > 0 ? Math.min(nivel, this.options.nivelMaximo) : null;
            },
            renderHTML: (attributes: { indent?: number | null }) => {
              if (!attributes.indent) return {};
              return { style: `margin-left: ${attributes.indent * this.options.passoPx}px` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      increaseIndent:
        () =>
        ({ tr, state, dispatch }) => {
          return ajustarRecuo(tr, state, dispatch, this.options, 1);
        },
      decreaseIndent:
        () =>
        ({ tr, state, dispatch }) => {
          return ajustarRecuo(tr, state, dispatch, this.options, -1);
        },
    };
  },
});

export default Indentacao;
