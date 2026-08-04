# Refatoração — Barra Contextual de Tabela (estilização + bug de layout)

## 1. Contexto desta revisão

`RefatoracaoTabela.md` (Etapas 1–7) entregou a função real da tabela — inserir,
editar estrutura, mesclar, cabeçalho, cor de célula/borda, altura/largura,
duplicar célula. Cada etapa acrescentou seu próprio controle direto na barra
contextual (`.email-editor-toolbar-contextual`), que por decisão de escopo
daquela revisão ficou como uma faixa plana com `overflow-x: auto` "para
absorver o crescimento de itens" (nota de execução da Etapa 3). Com as 7
etapas somadas, a faixa acumulou ~20 botões/campos soltos e passou a depender
de rolagem horizontal o tempo todo — visualmente ruim e, mais grave, fonte de
um bug de layout: selecionar linhas/colunas arrastando o mouse fazia a barra
"piscar" (desmontar e remontar), deslocando o conteúdo abaixo dela para cima
e de volta.

Esta revisão parte do diagnóstico correto já usado para o mesmo problema na
faixa principal do editor (`RefatoracaoToolbarEmail.md` — Etapa 2: "Ver
Mais"): reestrutura os ~20 controles em 8 seções com trigger único + popover,
reaproveitando a mesma estratégia de responsividade por largura em vez de
rolagem, e corrige separadamente o bug de deslocamento.

## 2. Decisões de escopo

- **Seções, não faixa plana:** os ~20 botões/campos viram 8 triggers
  (`inserir`, `excluir`, `mesclar`, `cabecalho`, `corCelula`, `corBorda`,
  `tamanho`, `duplicar`) — `overflow-x: auto` é removido, nunca mais
  scrollbar. `inserir`/`excluir`/`mesclar`/`cabecalho`/`duplicar` reaproveitam
  `PainelGrupoOpcoes`, o mesmo componente de "grupo com popover" já usado por
  Alinhamento/Recuo/Lista na faixa principal (`RefatoracaoFonteGruposCores.md`
  — Etapas 2–3) — nenhum componente novo para eles. `corCelula`/`corBorda`
  continuam triggers avulsos (já eram "botão com popover de `SeletorCor`",
  padrão de interação diferente de uma lista de ações). `tamanho` tem
  conteúdo próprio (`CampoTamanho`) por misturar toggle + três campos
  numéricos, fora do que `PainelGrupoOpcoes` cobre.
- **"Excluir tabela" migra para dentro do grupo "Excluir":** deixa de ser o
  último botão solto da faixa; agora é uma das 3 opções do grupo (linha,
  coluna, tabela), com destaque visual de perigo só no hover (flag `perigo`
  nova em `PainelGrupoOpcoes`) — reaproveita a mesma cor de
  `.email-editor-toolbar-popover-remover:hover`.
- **Campo "Tamanho" (altura/espessura/largura): ícone + input, sem rótulo
  nem placeholder** — pedido explícito desta revisão. Os três campos, antes
  soltos na faixa como "rótulo + número" (`.email-editor-toolbar-contextual-
  campo-altura`, descontinuada), passam a viver dentro do popover do grupo
  "Tamanho", cada um como ícone (que já comunica o campo) + input puro; a
  explicação completa (o que o campo faz, o que um valor vazio significa)
  fica só no `title`/`aria-label`, como tooltip.
- **`corBorda` fica fora do grupo "Tamanho":** é um seletor de cor (grade +
  hex), padrão de interação diferente dos três campos numéricos do grupo —
  fica como trigger avulso ao lado de `corCelula`, mesmo raciocínio de "cor
  é um tipo de controle à parte" já usado na revisão anterior.
- **Mesma estratégia de "Ver Mais" da faixa principal, não uma cópia:** o
  algoritmo de medição por `ResizeObserver` + ocultação por largura
  (`RefatoracaoToolbarEmail.md` — Etapa 2) foi extraído da faixa principal
  para um hook reaproveitável (`useToolbarOverflow`, novo,
  `editor/useToolbarOverflow.ts`) e a faixa principal foi migrada para usá-lo
  — sem mudança de comportamento nela — para que a barra contextual de
  tabela chame exatamente a mesma lógica, não uma reimplementação paralela.
- **Bug de deslocamento ao selecionar linha/coluna:** a barra contextual só
  existe no DOM enquanto `editor.isActive('table')`; arrastar o mouse para
  selecionar um intervalo de células dispara uma transação do ProseMirror a
  cada `mousemove`, e nesse meio-tempo a seleção pode, por um frame, resolver
  como fora da tabela antes de voltar — o suficiente para a barra
  desmontar/remontar no mesmo gesto. Corrigido com um estado "estabilizado"
  (`tabelaAtivaEstavel`): mostrar a barra continua imediato, mas escondê-la é
  atrasado numa janela curta (120 ms) e cancelado se a tabela voltar a ficar
  ativa antes disso — a barra nunca chega a desmontar durante a oscilação.
- **Selo "Tabela" no início da faixa:** elemento não-interativo (`aria-
  hidden`) com o ícone de tabela, só para reforçar visualmente que aquela
  segunda faixa pertence à tabela — não é mais um botão disputando espaço,
  puramente cosmético.

## 3. Arquivos alterados

`src/components/EmailEditorToolbar.tsx`, `src/components/Icons.tsx`,
`src/components/editor/useToolbarOverflow.ts` (novo), `src/index.css`.

Nenhuma mudança em `sanitizarHtml.ts` nem nas extensões (`AlturaLinha.ts`,
`CorCelula.ts`, `BordaLarguraTabela.ts`) — esta revisão é só de organização/
estilização da barra contextual e do bug de layout, nenhum atributo novo,
nenhum comando novo.

## 4. Notas de execução

- `useToolbarOverflow` (novo): extrai o algoritmo de medição/ocultação que
  antes vivia inline em `EmailEditorToolbar` (Etapa 2 de
  `RefatoracaoToolbarEmail.md`) para um hook genérico, parametrizado por
  `itemIds`/`ordemOcultacao`/`quantidadeClusters`/`refs`/`containerRef` —
  mesmo algoritmo, sem mudança de comportamento para a faixa principal (que
  passou a chamar o hook em vez do bloco inline). Ganhou um parâmetro
  `ativo` que a faixa principal não precisa (nunca desmonta, sempre `true`)
  mas a barra de tabela precisa: sem ele, o `ResizeObserver`/a medição
  inicial rodariam uma única vez no primeiro mount do componente pai — como
  a barra de tabela começa fora do DOM (`tabelaAtivaEstavel` inicial
  `false`), o efeito bateria em `containerRef.current === null` e nunca mais
  tentaria de novo quando a barra de fato aparecesse. `ativo` (ligado a
  `tabelaAtivaEstavel`) faz os efeitos relevantes rodarem de novo a cada vez
  que a barra remonta com nós DOM novos.
- `TABELA_ITEM_IDS`/`TABELA_CLUSTERS`/`TABELA_ORDEM_OCULTACAO`: mesmo papel
  de `ITEM_IDS`/`CLUSTERS`/`ORDEM_OCULTACAO` da faixa principal, só que para
  os 8 triggers da tabela. Ordem de ocultação prioriza manter
  inserir/excluir/cor da célula visíveis por mais tempo (estrutura básica,
  mais usada); duplicar/cor da borda/tamanho somem primeiro (extras).
  Checagem de sincronia em `import.meta.env.DEV` espelhando a já existente
  para `ORDEM_OCULTACAO`.
- `PainelGrupoOpcoes`: ganhou uma flag opcional `perigo` por opção — aplica
  a classe `perigo` (nova, CSS) no botão, usada só por "Excluir tabela"
  dentro do grupo "Excluir". Nenhuma mudança para os grupos que já
  usavam o componente (Alinhamento/Recuo/Lista, sem `perigo`).
- `CampoTamanho` (novo, local a `EmailEditorToolbar.tsx`): componente
  pequeno reaproveitado pelos três campos do popover "Tamanho" — ícone +
  input sem rótulo/placeholder, `title`/`aria-label` explicando o campo.
  Nenhum dos três handlers (`confirmarAlturaLinha`/`confirmarEspessuraBorda`/
  `confirmarLarguraFixa`) mudou de comportamento — só a apresentação.
- Ícones novos em `Icons.tsx`: `IconeGrupoInserir` (`TbTablePlus`),
  `IconeGrupoExcluir` (`TbTableMinus`), `IconeGrupoTamanho` (`TbResize`),
  `IconeAlturaLinhaCampo` (`TbArrowAutofitHeight`), `IconeEspessuraBordaCampo`
  (`TbBorderStyle`), `IconeLarguraFixaCampo` (`TbRulerMeasure`) — todos do
  mesmo conjunto Tabler já usado pelos ícones de linha/coluna/borda
  existentes, sem quinto conjunto novo. `mesclar`/`cabecalho`/`duplicar`
  reaproveitam os ícones que já tinham (`IconeMesclarCelulas`,
  `IconeAlternarLinhaCabecalho`, `IconeDuplicarParaDireita`) como ícone do
  próprio trigger do grupo, sem ícone dedicado extra.
- `src/index.css`: `.email-editor-toolbar-contextual` perdeu `overflow-x:
  auto` (não é mais necessário — a faixa cabe com 8 triggers de largura
  fixa) e ganhou `border-radius` levemente maior, para diferenciar da faixa
  principal. Novas classes: `.email-editor-toolbar-contextual-selo` (selo
  não-interativo), `.email-editor-toolbar-botao.perigo` (hover destrutivo),
  `.email-editor-toolbar-popover-tamanho`/`-tamanho-linha` (layout do
  popover do grupo "Tamanho") e `.email-editor-toolbar-popover-campo-icone`
  (o campo ícone+input em si, substitui `.email-editor-toolbar-contextual-
  campo-altura`, removida — não tinha mais nenhum uso).
- Checagem de tipos: rodada isolada (`tsc`, com stubs mínimos só para
  `ToolbarPopover.tsx`, que não mudou nesta revisão e por isso não entra
  neste zip, e para os comandos de extensões fora do escopo desta entrega —
  `StarterKit`, `TextAlign`, `Link`, `Highlight`, `Color`, `NoBotao`,
  `Indentacao`, `FontSize`) confirma que `EmailEditorToolbar.tsx`,
  `Icons.tsx` e `useToolbarOverflow.ts` compilam limpos, sem imports/
  variáveis não usados e sem nenhum handler órfão (cada função de comando de
  tabela já existente — `inserirLinhaAcima`, `excluirColuna`,
  `duplicarCelula` etc. — continua chamada a partir do novo agrupamento).
