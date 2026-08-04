import { Table } from '@tiptap/extension-table';

/**
 * Atributos `corBorda`, `espessuraBorda` e `largura` para o nó `table`
 * (RefatoracaoTabela.md — Etapa 6), mesmo padrão de round-trip via `style`
 * inline já usado por `corFundo` (`CorCelula.ts`) e `altura`
 * (`AlturaLinha.ts`): cada atributo escreve/lê sua própria fatia do `style`
 * do `<table>`, sem depender de nenhuma classe CSS. O Tiptap funde os
 * fragmentos de `style` devolvidos por cada atributo (`mergeAttributes`,
 * junta valores de `style` com `; `), então os três atributos coexistem no
 * mesmo elemento sem se sobrescrever.
 *
 * `corBorda`/`espessuraBorda` são a "borda externa" da tabela (seção 2 do
 * plano — reforçada pelo próprio ícone escolhido para o controle,
 * `IconeBordaTabela`/`TbBorderOuter`, em `Icons.tsx`), não um contorno por
 * célula. Cada um dos dois sempre acompanha `border-style: solid` no
 * próprio fragmento de `style` — sem isso, definir só `border-color` (sem
 * nenhum `border-width` explícito) ainda renderizaria uma borda visível,
 * com a largura padrão do navegador (`medium`, ~3px), mas incluir
 * `border-style: solid` nos dois deixa o resultado determinístico
 * independente de qual dos dois atributos está definido.
 *
 * `largura` guarda o valor final já pronto para `style="width: ..."`
 * (`'100%'` para largura total, ou uma string tipo `'450px'` para largura
 * fixa — decidido pela barra contextual em `EmailEditorToolbar.tsx`,
 * `alternarLarguraTotal`/`confirmarLarguraFixa`) — mantido como string única
 * (não um número + unidade separados) porque as duas formas de largura
 * desta etapa (percentual vs. pixels) não compartilham uma unidade comum
 * para clampar/formatar de um jeito genérico.
 *
 * `corBorda`/`espessuraBorda` têm um valor padrão (`#cccccc`/`1`, em vez de
 * `null` como os demais atributos desta extensão) — correção de bug: sem
 * isso, uma tabela recém-inserida (`insertTable`, sem nenhum `style` no
 * `<table>` ainda) saía sem nenhuma borda, dando a impressão de tabela
 * "invisível" até o usuário abrir a barra contextual e definir cor/espessura
 * manualmente. `default` só entra em jogo na criação de um nó novo por
 * comando (`insertTable`) — tabelas existentes, recarregadas a partir de
 * HTML salvo/colado, continuam lendo o valor real do `style` inline via
 * `parseHTML` (que devolve `null` quando o HTML de fato não tem borda,
 * sobrepondo o padrão), então o round-trip de conteúdo já salvo sem borda
 * não muda. "Remover borda" (`removerCorBorda`, em `EmailEditorToolbar.tsx`)
 * continua funcionando normalmente, gravando `corBorda: null` explícito por
 * cima do padrão.
 */
export const TableComBordaLargura = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      corBorda: {
        default: '#cccccc',
        parseHTML: (elemento: HTMLElement) => elemento.style.borderColor || null,
        renderHTML: (atributos: { corBorda?: string | null }) => {
          if (!atributos.corBorda) return {};
          return { style: `border-color: ${atributos.corBorda}; border-style: solid` };
        },
      },
      espessuraBorda: {
        default: 1,
        parseHTML: (elemento: HTMLElement) => {
          const valor = Number.parseFloat(elemento.style.borderWidth);
          return Number.isFinite(valor) ? valor : null;
        },
        renderHTML: (atributos: { espessuraBorda?: number | null }) => {
          if (!atributos.espessuraBorda) return {};
          return { style: `border-width: ${atributos.espessuraBorda}px; border-style: solid` };
        },
      },
      largura: {
        default: null,
        parseHTML: (elemento: HTMLElement) => elemento.style.width || null,
        renderHTML: (atributos: { largura?: string | null }) => {
          if (!atributos.largura) return {};
          return { style: `width: ${atributos.largura}` };
        },
      },
    };
  },
});
