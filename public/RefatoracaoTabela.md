# Refatoração — Tabela no Editor de E-mail

## 1. Contexto desta revisão

O botão "Tabela" existe na toolbar desde `RefatoracaoToolbarEmail.md` (Etapa 7), mas foi entregue deliberadamente como placeholder — clique sem função, título "Tabela (em breve)" — porque a extensão de tabela de fato foi considerada trabalho grande demais para entrar naquela revisão (ver seção 2 daquele plano: "a extensão de tabela de fato (`@tiptap/extension-table`...) fica para uma revisão futura, fora deste plano"). Esta revisão é essa continuação: dá função real ao botão.

O projeto hoje não tem nenhuma extensão de tabela instalada (`package.json` não lista `@tiptap/extension-table` nem correlatas) e `sanitizarHtml.ts` não libera nenhuma tag de tabela (`table`/`tr`/`td`/`th` ausentes de `ALLOWED_TAGS`) — sem essas duas peças, qualquer HTML de tabela que o editor produzisse seria descartado na sanitização, tanto ao reabrir um e-mail salvo quanto ao colar conteúdo de fora.

Vale registrar a natureza do projeto, porque ela limita o escopo mais do que num editor de tabela genérico: isto é conteúdo de **e-mail**, renderizado depois em clientes como Outlook (motor do Word, historicamente hostil a CSS moderno) e Gmail — não uma página web comum. Cor, largura e borda de tabela precisam sobreviver a esses clientes via atributo/`style` inline simples, o que na prática também ajuda a manter o escopo enxuto: nada aqui depende de CSS avançado.

## 2. Decisões de escopo

- **Biblioteca:** `@tiptap/extension-table` + `@tiptap/extension-table-row` + `@tiptap/extension-table-header` + `@tiptap/extension-table-cell` — conjunto oficial do Tiptap, mesma major version já usada no projeto (`^3.29.2`). Cobre nativamente inserir tabela, adicionar/remover linha e coluna, excluir tabela inteira, mesclar/dividir células, alternar linha/coluna de cabeçalho e redimensionamento de coluna por arraste (`resizable: true`).
- **Adicionar/excluir célula = linha/coluna inteira, não célula avulsa:** confirmado no alinhamento anterior — a grade de uma tabela Tiptap/ProseMirror é sempre retangular; excluir uma célula isolada quebraria o alinhamento das demais linhas. Todo comando de adicionar/excluir opera sobre linha ou coluna completa.
- **Cor de célula:** não é um recurso nativo da extensão de tabela — implementado como atributo customizado (`corFundo`, análogo a `cor` em `NoBotao.ts`) em `TableCell`/`TableHeader`, saindo como `style="background-color: ..."` na célula. Reaproveita o componente `SeletorCor` (grade de tonalidades + campo hex) já existente da revisão de cores, em vez de construir um seletor novo.
- **Largura de coluna:** nativa, via `resizable: true` — arrastar a borda de uma coluna ajusta sua largura, sem UI adicional a construir.
- **Altura de linha:** não é nativo (ProseMirror tabela não modela altura por linha) — implementado como atributo customizado (`altura`) em `TableRow`, saindo como `style="height: ...px"` no `<tr>`, com um campo numérico na barra contextual (seção abaixo).
- **Duplicar conteúdo de célula:** decisão já tomada em conversa — **não** é uma alça de arraste estilo Excel (mouse-tracking customizado, avaliado como complexo demais para o escopo). É um botão simples na barra contextual: "duplicar para a direita" e "duplicar para baixo", cada um copiando conteúdo + `corFundo` da célula selecionada para a célula vizinha correspondente, como uma ação única.
- **Cabeçalho, borda e largura da tabela** (extras confirmados): `toggleHeaderRow`/`toggleHeaderColumn` nativos da extensão; borda como atributo customizado (`corBorda`/`espessuraBorda`) no nó `table`, saindo em `style` no `<table>`; largura da tabela como atributo (`larguraTotal: boolean` ou equivalente) alternando entre `width: 100%` e uma largura fixa em px.
- **Quebra de texto por célula:** fora de escopo — descartado em conversa.
- **Barra contextual, não botões soltos na toolbar principal:** todos os controles específicos de tabela (linha, coluna, mesclar, cor, dimensões, cabeçalho, borda, largura da tabela, duplicar) vivem numa barra secundária que só aparece com o cursor dentro de uma tabela — evita inflar a faixa principal da toolbar com botões que não fazem sentido fora desse contexto, no mesmo espírito de "Ver Mais" já usado no resto da toolbar (`RefatoracaoToolbarEmail.md`), mas como um painel condicional em vez de um menu de overflow.
- **Sanitização:** `sanitizarHtml.ts` precisa passar a liberar `table`, `thead`, `tbody`, `tr`, `td`, `th` em `ALLOWED_TAGS` e `colspan`/`rowspan` em `ALLOWED_ATTR` — `style` já é liberado sem allowlist por propriedade CSS hoje, então cor/altura/borda/largura saindo via `style` não exigem entrada nova além das tags em si.

> ## ⚠️ Regra de entrega a cada etapa — leia antes de começar
>
> **A cada etapa implementada, a entrega deve ser um único ZIP contendo *todos* os arquivos alterados desde a Etapa 1 desta revisão até a etapa atual — não apenas os da etapa corrente.**
>
> Mesma regra dos planos anteriores. **Este arquivo de plano (`RefatoracaoTabela.md`) também deve ir dentro do ZIP de cada etapa**, atualizado para refletir o progresso (etapas concluídas marcadas, ajustes de rota se algum diagnóstico mudar uma decisão registrada aqui), no mesmo lugar de sempre em `public/`.

## 3. Divisão em etapas

A Etapa 1 é pré-requisito de todas as demais. A Etapa 2 depende da 1 e é checkpoint — valida que a tabela nasce, edita linha/coluna e sobrevive à sanitização antes de empilhar o resto em cima. As Etapas 3–7 dependem da 2 pronta, mas são independentes entre si e podem ser feitas em qualquer ordem a partir dali.

### Etapa 1 — Dependência, schema e sanitização ✅ concluída

**O que fazer:** instalar `@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-header`, `@tiptap/extension-table-cell`; registrar em `EmailEditorRico.tsx` junto das extensões já existentes, com `Table.configure({ resizable: true })`. Atualizar `sanitizarHtml.ts` conforme a seção 2 (tags de tabela + `colspan`/`rowspan`). Sem UI ainda — só o schema aceitando o nó e a sanitização deixando passar.

**Por quê:** é a base sobre a qual toda UI das etapas seguintes é construída; separar em etapa própria deixa claro, se algo falhar mais adiante, se o problema é de schema/sanitização ou de UI.

**Arquivos alterados:** `package.json`, `src/components/EmailEditorRico.tsx`, `src/components/utils/sanitizarHtml.ts`.

**Arquivos-fonte necessários:** `src/components/EmailEditorRico.tsx`, `src/components/utils/sanitizarHtml.ts`.

### Etapa 2 — Inserir tabela, linha/coluna e excluir tabela — checkpoint

**O que fazer:** trocar o botão placeholder "Tabela (em breve)" por um popover simples (linhas × colunas iniciais, ex.: dois campos numéricos + botão "Inserir") que insere a tabela na posição do cursor. Criar a barra contextual (só renderizada com o cursor dentro de uma tabela — checar via `editor.isActive('table')`, mesmo padrão de detecção de estado já usado no resto da toolbar) com os controles: adicionar/excluir linha, adicionar/excluir coluna, excluir tabela inteira. Todos ligados aos comandos nativos da extensão (`addRowBefore/After`, `deleteRow`, `addColumnBefore/After`, `deleteColumn`, `deleteTable`).

**Por quê é checkpoint:** é o núcleo funcional mínimo — tabela nasce, cresce, encolhe, é removida. Vale confirmar visualmente (inserção, edição de estrutura, texto dentro de célula, navegação por Tab) e reabrir um e-mail salvo com tabela para confirmar que sobrevive à sanitização de verdade, antes de somar mesclagem, cor e as demais etapas em cima de uma base ainda não validada.

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`, `src/components/Icons.tsx` (ícones dos novos controles da barra contextual), `src/index.css` (popover de inserção + barra contextual).

**Arquivos-fonte necessários:** `src/components/editor/ToolbarPopover.tsx` (reaproveitar o mecanismo de portal/posicionamento/clique-fora já pronto).

### Etapa 3 — Mesclar/dividir células e cabeçalho ✅ concluída

**O que fazer:** adicionar à barra contextual os controles de mesclar (`mergeCells`) e dividir (`splitCell`) a seleção de células atual, mais os toggles de linha/coluna de cabeçalho (`toggleHeaderRow`, `toggleHeaderColumn`), nativos da extensão.

**Por quê:** completa a manipulação estrutural da tabela (o que sobra da lista original além de linha/coluna/exclusão, já cobertos na Etapa 2), e os toggles de cabeçalho são os extras de menor esforço confirmados — comandos prontos, só falta o botão.

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`, `src/components/Icons.tsx`.

**Arquivos-fonte necessários:** nenhum adicional além do já visto na Etapa 2.

**Notas de execução:**
- Os 4 novos botões (mesclar, dividir, cabeçalho de linha, cabeçalho de coluna) entram na barra contextual existente, entre o grupo de coluna e "excluir tabela", cada um separado por `.email-editor-toolbar-separador`, mesmo padrão visual da Etapa 2.
- Ícones: nem Feather, nem Bootstrap Icons, nem Tabler Icons (os três já usados no projeto) têm ícone dedicado de mesclar/dividir célula. Em vez de forçar um símbolo genérico, foi introduzido um quarto conjunto — Remix Icon (`react-icons/ri`, mesmo pacote `react-icons` já instalado, sem dependência nova) — que tem `RiMergeCellsHorizontal`/`RiSplitCellsHorizontal` dedicados, no mesmo estilo de contorno dos demais. Os toggles de cabeçalho reaproveitam o Tabler já usado na Etapa 2 (`TbTableRow`/`TbTableColumn`).
- Estado "ativo" dos toggles de cabeçalho: `toggleHeaderRow`/`toggleHeaderColumn` gravam o mesmo tipo de nó (`tableHeader`) tanto para célula de cabeçalho de linha quanto de coluna — a extensão não distingue as duas depois de aplicadas. Por isso os dois botões compartilham uma única flag de estado (`celulaCabecalhoAtiva`, via `editor.isActive('tableHeader')`) para se destacar quando o cursor está numa célula já convertida em cabeçalho.
- `mergeCells`/`splitCell` não ganharam gating extra (`can()`) além do já padrão `disabled={!editor}` — fora de uma seleção mesclável/divisível, os comandos simplesmente não fazem nada (mesmo comportamento de no-op que os comandos de linha/coluna da Etapa 2 já tinham fora de contexto válido).
- `src/index.css` não precisou de nenhuma regra nova: `.email-editor-toolbar-botao`, `.email-editor-toolbar-botao.ativo` e `.email-editor-toolbar-separador` já são genéricas e cobrem os botões novos; a barra contextual já tinha `overflow-x: auto` desde a Etapa 2 para absorver o crescimento de itens.

### Etapa 4 — Cor de célula ✅ concluída

**O que fazer:** adicionar o atributo `corFundo` a `TableCell`/`TableHeader` (round-trip via `style="background-color"`, mesmo padrão de `NoBotao.ts`/`cor`). Na barra contextual, um botão "Cor da célula" abre um popover reaproveitando `SeletorCor` (grade de tonalidades + campo hex + "Personalizar"), aplicando à seleção de células atual em vez de a uma marca de texto.

**Por quê:** é o item da lista original com maior valor visual (tabela de preço/comparativo depende de cor de fundo para ficar legível), e reaproveita um componente já pronto — não é um seletor novo do zero.

**Arquivos alterados:** `src/components/editor/extensoes/CorCelula.ts` (novo), `src/components/EmailEditorRico.tsx`, `src/components/EmailEditorToolbar.tsx`, `src/index.css`.

**Arquivos-fonte necessários:** nenhum adicional — `SeletorCor` já foi lido/documentado em `RefatoracaoFonteGruposCores.md`.

**Notas de execução (retomadas/corrigidas na entrega da Etapa 5):** a entrega anterior desta etapa tinha ficado pela metade — `corFundo` já existia em `CorCelula.ts` e já estava registrado em `EmailEditorRico.tsx`, e `EmailEditorToolbar.tsx` já tinha o estado (`corCelulaAtiva`, tipo `'corCelula'` em `painelAberto`, `refCorCelula`) preparado, mas o botão "Cor da célula" em si nunca chegou a ser renderizado na barra contextual. Isso deixava `IconeCorCelula` e `refCorCelula` como import/variável não usados, **quebrando o build** (`tsc -b`, dois erros `TS6133`). `src/index.css` também tinha, no fim do arquivo, um comentário remanescente de uma versão intermediária ("ATENÇÃO — este NÃO é o `index.css` completo...") com formatação de linha dupla e variáveis CSS erradas (`--cor-borda`, `--cor-fundo-secundario`, que não existem no projeto — os tokens reais são `--color-border`, `--color-surface-hover` etc.). Os dois problemas foram corrigidos junto com a Etapa 5, já que envolviam os mesmos arquivos: o botão "Cor da célula" foi de fato renderizado na barra contextual (grupo entre os toggles de cabeçalho e "excluir tabela", com `aplicarCorCelula`/`aplicarCorCelulaLivre`/`removerCorCelula` ligando a `setCellAttribute('corFundo', ...)`, comando nativo que resolve sozinho a seleção de células atual), e o `index.css` foi limpo (comentário removido, tokens corrigidos, formatação normalizada). `tsc -b` e `vite build` passam limpos depois da correção.

### Etapa 5 — Largura de coluna e altura de linha ✅ concluída

**O que fazer:** confirmar visualmente que `resizable: true` (já ligado na Etapa 1) cobre largura de coluna por arraste, sem trabalho adicional. Adicionar o atributo `altura` a `TableRow` (round-trip via `style="height"`) e um campo numérico na barra contextual (visível com o cursor em qualquer célula da linha) para definir a altura da linha atual.

**Por quê:** fecha o item "tamanho da célula" da lista original, já esclarecido em conversa como largura por coluna + altura por linha, não por célula individual.

**Arquivos alterados:** `src/components/editor/extensoes/AlturaLinha.ts` (novo), `src/components/EmailEditorRico.tsx`, `src/components/EmailEditorToolbar.tsx`, `src/index.css`.

**Arquivos-fonte necessários:** nenhum adicional.

**Notas de execução:**
- Largura de coluna: confirmado — `resizable: true` já cobre o arraste de borda de coluna nativamente, sem nenhuma mudança de código nesta etapa.
- Altura de linha: `altura` entra em `TableRow` como `TableRowComAltura` (`editor/extensoes/AlturaLinha.ts`), mesmo padrão de `corFundo` em `CorCelula.ts` — `parseHTML` extrai só a parte numérica de `element.style.height` (`Number.parseFloat` descarta o `px` sozinho), `renderHTML` só emite `style` quando o atributo está definido.
- Campo "Altura" na barra contextual: buffer local (`campoAlturaLinha`) com o mesmo padrão de digitação livre + confirmação no blur/Enter já usado pelo campo de tamanho de fonte — sincronizado a partir de `estado.alturaLinhaAtiva` sempre que não está focado. Campo vazio ao confirmar limpa o atributo (`altura: null`, volta à altura automática); um valor não numérico ou ≤ 0 reverte o campo sem aplicar nada. Aplicado via `updateAttributes('tableRow', { altura })`, mesmo comando genérico já usado por `aplicarCorBotao` para o nó `noBotao`. Fica direto na faixa da barra contextual (não atrás de um popover), como o próprio plano pedia ("campo numérico... visível com o cursor em qualquer célula da linha").
- `sanitizarHtml.ts` não precisou de nenhuma mudança: `style` já é liberado sem allowlist por propriedade CSS desde a Etapa 1, então `height` inline já passa.
- `src/index.css`: nova classe `.email-editor-toolbar-contextual-campo-altura` (rótulo + campo numérico curto, mesmo espírito visual de `.email-editor-toolbar-stepper-campo`, sem os botões +/− — aqui a digitação livre confirmada no blur/Enter já basta).

### Etapa 6 — Borda e largura da tabela ✅ concluída

**O que fazer:** adicionar atributos `corBorda`/`espessuraBorda` ao nó `table` (round-trip via `style` no `<table>`) com um controle simples na barra contextual (cor via `SeletorCor` reaproveitado da Etapa 4, espessura via campo numérico pequeno). Adicionar um toggle "largura total" vs. "largura fixa" (alternando `style="width: 100%"` e um valor fixo em px) para a tabela como um todo.

**Por quê:** os dois extras restantes confirmados — sem borda visível, tabela em e-mail vira texto alinhado sem contorno; largura fixa em px pode estourar em tela estreita (preview de app, mobile), então o toggle cobre os dois casos de uso mais comuns sem virar um controle de dimensionamento livre.

**Arquivos alterados:** `src/components/editor/extensoes/BordaLarguraTabela.ts` (novo), `src/components/EmailEditorRico.tsx`, `src/components/EmailEditorToolbar.tsx`, `src/index.css`.

**Arquivos-fonte necessários:** nenhum adicional.

**Notas de execução:** a entrega anterior desta etapa (recebida como "Etapa 5") já tinha ficado parcialmente pronta, mas incompleta e **quebrando o build**: `EmailEditorRico.tsx` já importava `TableComBordaLargura` de `editor/extensoes/BordaLarguraTabela.ts` (com o JSDoc já descrevendo a Etapa 6 como se estivesse pronta), e `EmailEditorToolbar.tsx` já tinha as constantes de clamp (`ESPESSURA_BORDA_MIN/MAX`, `LARGURA_TABELA_FIXA_MIN/MAX`) e os três campos correspondentes já declarados em `ESTADO_EDITOR_INDISPONIVEL` (`corBordaAtiva`, `espessuraBordaAtiva`, `larguraTabelaAtiva`) — mas o arquivo de extensão em si nunca chegou a ser criado, então o import não resolvia, e nada disso estava de fato ligado ao editor (sem leitura via `useEditorState`, sem handlers, sem UI na barra contextual). Os ícones dedicados (`IconeBordaTabela`/`TbBorderOuter`, `IconeLarguraTotalTabela`/`TbArrowAutofitWidth`, em `Icons.tsx`) também já existiam prontos, só não estavam importados em `EmailEditorToolbar.tsx`. Esta entrega completa o que faltava:
- `editor/extensoes/BordaLarguraTabela.ts` (novo): estende `Table` (import nomeado — `@tiptap/extension-table` não tem `export default`, diferente de `TableCell`/`TableRow`/`TableHeader`, que têm) com `corBorda`/`espessuraBorda`/`largura`, mesmo padrão de round-trip via `style` de `CorCelula.ts`/`AlturaLinha.ts`. `corBorda`/`espessuraBorda` sempre emitem `border-style: solid` junto (garante borda visível determinística mesmo com só um dos dois definido). O Tiptap funde os fragmentos de `style` de cada atributo automaticamente (`mergeAttributes` junta valores de `style` com `; `), então os três coexistem no mesmo elemento sem se sobrescrever.
- `EmailEditorToolbar.tsx`: leitura de `ed.getAttributes('table')` no `useEditorState` (mesmo padrão de `alturaLinhaAtiva`), handlers `aplicarCorBorda`/`aplicarCorBordaLivre`/`removerCorBorda` (via `updateAttributes('table', ...)`, mesma resolução que `updateAttributes('tableRow', ...)` já usa para altura — encontra o `table` ancestral mais próximo da seleção), `confirmarEspessuraBorda` (mesmo padrão de clamp silencioso de `confirmarAlturaLinha`) e `alternarLarguraTotal`/`confirmarLarguraFixa` (toggle "100%" e campo de largura fixa em px escrevem no mesmo atributo `largura`, nunca os dois ao mesmo tempo). Novo popover `corBorda` (reaproveita `SeletorCor`) e dois campos numéricos ("Espessura", "Largura") reaproveitando a classe `.email-editor-toolbar-contextual-campo-altura` já existente (renomeada de intenção só no comentário — nenhuma classe CSS nova precisou ser criada, os três campos têm a mesma forma).
- `src/index.css`: sem classe nova — só o comentário de `.email-editor-toolbar-contextual-campo-altura` foi atualizado para refletir que a classe agora é compartilhada pelos campos "Altura", "Espessura" e "Largura".
- `tsc --noEmit` (isolado, com stubs mínimos só para os arquivos fora do escopo desta entrega) confirma que os arquivos alterados compilam limpos, sem imports/variáveis não usados.

**Correção posterior (bug reportado após a Etapa 7):** uma tabela recém-inserida (`insertTable`) nascia sem nenhum `style` de borda no `<table>` — `corBorda`/`espessuraBorda` tinham `default: null` em `BordaLarguraTabela.ts`, então só ganhavam borda depois que o usuário abria a barra contextual e definia cor/espessura manualmente. Até lá, a tabela ficava com aparência de "invisível" (sem contorno nenhum). Corrigido trocando o `default` desses dois atributos para um valor visível (`corBorda: '#cccccc'`, `espessuraBorda: 1`) — só afeta a criação de tabela nova por comando; tabelas existentes, recarregadas a partir de HTML salvo/colado sem borda, continuam sem borda no round-trip, porque `parseHTML` lê o `style` real do elemento (retornando `null` quando não há borda no HTML) em vez de cair no `default` do schema. "Remover borda" continua funcionando normalmente por cima do novo padrão. Mantido o escopo já decidido na seção 2 (borda externa da tabela, não contorno por célula) — nenhuma mudança de CSS ou de arquivo além de `BordaLarguraTabela.ts`.

### Etapa 7 — Duplicar célula ✅ concluída

**O que fazer:** dois botões na barra contextual, "duplicar para a direita" e "duplicar para baixo" — cada um lê o conteúdo (texto/HTML interno) e `corFundo` da célula onde o cursor está, e escreve os dois na célula vizinha na direção escolhida, como uma única transação (não uma sequência de ações desfazível em dois passos).

**Por quê:** fecha o item "duplicar conteúdo da célula" da lista original pela via mais simples já alinhada em conversa — sem alça de arraste, sem detecção de intervalo de mouse.

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`, `src/components/Icons.tsx`, `src/index.css`.

**Arquivos-fonte necessários:** nenhum adicional.

**Notas de execução:**
- Não existe comando nativo da extensão de tabela para "copiar conteúdo desta célula para a vizinha" (os comandos nativos cobrem estrutura — linha/coluna/mesclar — não cópia de conteúdo entre células). A operação foi montada como uma transação direta do ProseMirror, dentro de `editor.chain().focus().command(({ tr, state }) => ...).run()`, usando `isInTable`/`selectedRect` de `@tiptap/pm/tables` — os mesmos utilitários de baixo nível que os comandos nativos de linha/coluna/mesclagem já usam por baixo dos panos para resolver a célula/seleção atual —, em vez de uma sequência de comandos prontos encadeados (não existe um comando "escrever nesta célula" para encadear). Fica como um único passo de undo, igual pedia o plano.
- `duplicarCelula(direcao)`: `selectedRect(state)` devolve o retângulo da seleção atual (`left`/`top`/`right`/`bottom`, mais `map`/`table`/`tableStart`) já resolvido a partir do cursor, mesmo com uma única célula (sem precisar de uma `CellSelection` de intervalo). A célula de origem é sempre o canto superior-esquerdo desse retângulo (`rect.top`/`rect.left`); a célula de destino é a vizinha imediatamente à direita (`rect.right`, já considerando o colspan da célula de origem) ou abaixo (`rect.bottom`, considerando rowspan), conforme a direção. `TableMap.map[linha * largura + coluna]` resolve a posição de cada uma dentro da tabela.
- Fora da última coluna/linha da tabela (`colunaDestino >= map.width` ou `linhaDestino >= map.height`), ou quando origem e destino resolvem para a mesma célula mesclada (`origemPos === destinoPos`), a função não faz nada — mesmo no-op silencioso que `mesclarCelulas`/`dividirCelula` (Etapa 3) já têm fora de contexto válido, sem gating extra (`can()`) além do já padrão `disabled={!editor}` dos botões.
- Conteúdo e `corFundo` são escritos juntos na mesma transação: `tr.setNodeMarkup` grava `corFundo` da origem nos atributos da célula de destino (preservando os demais atributos dela — colspan/rowspan não são tocados), e `tr.replaceWith` substitui o conteúdo interno da célula de destino pelo `Fragment` de conteúdo da célula de origem (preserva formatação interna, não só texto puro). `setNodeMarkup` não altera o tamanho do documento, então as posições calculadas antes da transação continuam válidas para o `replaceWith` seguinte, sem precisar de `tr.mapping`.
- Ícones: nem Feather, nem Bootstrap Icons, nem Tabler (os três primeiros conjuntos já usados no projeto) têm um símbolo de "copiar nesta direção" — Tabler só tem `Copyleft`/`Copyright` (símbolos de ©, sem relação com direção). O mesmo conjunto Remix Icon já importado na Etapa 3 para mesclar/dividir célula tem `ArrowRightBoxLine`/`ArrowDownBoxLine` (seta entrando numa caixa) — usado para os dois novos ícones, sem precisar de um quinto conjunto.
- Os dois botões entram na barra contextual entre "Largura" (Etapa 6) e "Excluir tabela", separados por `.email-editor-toolbar-separador` — mesmo padrão visual do resto da barra. "Excluir tabela" continua por último, mantendo a ação destrutiva no fim da faixa.
- `src/index.css` não precisou de nenhuma classe nova — os dois botões reaproveitam `.email-editor-toolbar-botao`, já genérica; só o comentário do bloco `.email-editor-toolbar-contextual` foi atualizado para citar o grupo "duplicar".
- Checagem de tipos: rodada de forma isolada (`tsc` com stubs mínimos para os arquivos fora do escopo desta entrega — `NoBotao.ts`, `FontSize.ts`, `Indentacao.ts`, `EmojiPickerFlutuante.tsx` — não incluídos neste zip por não terem sido alterados), sem nenhum erro nos trechos novos desta etapa (`duplicarCelula`, os dois ícones, os dois botões).