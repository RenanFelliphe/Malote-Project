import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';

/**
 * Atributo `corFundo` para célula de tabela (RefatoracaoTabela.md — Etapa 4),
 * round-trip via `style="background-color: ..."` — mesmo padrão de
 * `NoBotao.ts`/`cor`: o valor vive como atributo do nó (não como marca),
 * escrito/lido do `style` inline da própria célula, sem depender de nenhuma
 * classe CSS. `parseHTML` lê `element.style.backgroundColor` (cai para
 * `null`/sem cor quando a célula não tem a propriedade definida);
 * `renderHTML` só emite o `style` quando o atributo está de fato definido,
 * para não gravar `style="background-color: null"` numa célula sem cor.
 *
 * Precisa ser declarado tanto em `TableCell` quanto em `TableHeader` porque
 * são dois tipos de nó distintos no schema (célula comum vs. célula de
 * cabeçalho, RefatoracaoTabela.md — Etapa 3) — a cor de fundo se aplica aos
 * dois da mesma forma. A barra contextual (`EmailEditorToolbar.tsx`) não
 * precisa distinguir qual dos dois está ativo: usa o comando nativo
 * `setCellAttribute('corFundo', ...)` da extensão de tabela, que já resolve
 * sozinho qual tipo de célula aplicar de acordo com a seleção atual (célula
 * única ou intervalo mesclando comum e cabeçalho).
 */
export const TableCellComCor = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      corFundo: {
        default: null,
        parseHTML: (elemento: HTMLElement) => elemento.style.backgroundColor || null,
        renderHTML: (atributos: { corFundo?: string | null }) => {
          if (!atributos.corFundo) return {};
          return { style: `background-color: ${atributos.corFundo}` };
        },
      },
    };
  },
});

export const TableHeaderComCor = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      corFundo: {
        default: null,
        parseHTML: (elemento: HTMLElement) => elemento.style.backgroundColor || null,
        renderHTML: (atributos: { corFundo?: string | null }) => {
          if (!atributos.corFundo) return {};
          return { style: `background-color: ${atributos.corFundo}` };
        },
      },
    };
  },
});