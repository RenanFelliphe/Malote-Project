import TableRow from '@tiptap/extension-table-row';

/**
 * Atributo `altura` para linha de tabela (RefatoracaoTabela.md — Etapa 5),
 * round-trip via `style="height: ...px"` — mesmo padrão de `corFundo` em
 * `CorCelula.ts`: o valor vive como atributo do nó `tableRow` (não como
 * marca), escrito/lido do `style` inline do próprio `<tr>`, sem depender de
 * nenhuma classe CSS.
 *
 * `parseHTML` lê `element.style.height` e extrai só a parte numérica
 * (`Number.parseFloat` descarta o sufixo `px` sozinho), caindo para `null`
 * quando a linha não tem altura definida ou o valor não é numérico (ex.:
 * uma altura em `%`/`em` vinda de HTML colado de fora, fora do que o campo
 * numérico da barra contextual produz). `renderHTML` só emite o `style`
 * quando o atributo está de fato definido, para não gravar
 * `style="height: nullpx"` numa linha sem altura customizada.
 *
 * Largura de coluna (mesma Etapa 5) não precisa de nenhum atributo
 * equivalente aqui: é nativa da extensão de tabela via `resizable: true`
 * (já ligado desde a Etapa 1, em `EmailEditorRico.tsx`) — arrastar a borda
 * de uma coluna já ajusta sua largura sem UI adicional, confirmado
 * visualmente ao concluir esta etapa.
 */
export const TableRowComAltura = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      altura: {
        default: null,
        parseHTML: (elemento: HTMLElement) => {
          const valor = Number.parseFloat(elemento.style.height);
          return Number.isFinite(valor) ? valor : null;
        },
        renderHTML: (atributos: { altura?: number | null }) => {
          if (!atributos.altura) return {};
          return { style: `height: ${atributos.altura}px` };
        },
      },
    };
  },
});
