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

### Etapa 1 — Dependência, schema e sanitização

**O que fazer:** instalar `@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-header`, `@tiptap/extension-table-cell`; registrar em `EmailEditorRico.tsx` junto das extensões já existentes, com `Table.configure({ resizable: true })`. Atualizar `sanitizarHtml.ts` conforme a seção 2 (tags de tabela + `colspan`/`rowspan`). Sem UI ainda — só o schema aceitando o nó e a sanitização deixando passar.

**Por quê:** é a base sobre a qual toda UI das etapas seguintes é construída; separar em etapa própria deixa claro, se algo falhar mais adiante, se o problema é de schema/sanitização ou de UI.

**Arquivos alterados:** `package.json`, `src/components/EmailEditorRico.tsx`, `src/components/utils/sanitizarHtml.ts`.

**Arquivos-fonte necessários:** `src/components/EmailEditorRico.tsx`, `src/components/utils/sanitizarHtml.ts`.

### Etapa 2 — Inserir tabela, linha/coluna e excluir tabela — checkpoint

**O que fazer:** trocar o botão placeholder "Tabela (em breve)" por um popover simples (linhas × colunas iniciais, ex.: dois campos numéricos + botão "Inserir") que insere a tabela na posição do cursor. Criar a barra contextual (só renderizada com o cursor dentro de uma tabela — checar via `editor.isActive('table')`, mesmo padrão de detecção de estado já usado no resto da toolbar) com os controles: adicionar/excluir linha, adicionar/excluir coluna, excluir tabela inteira. Todos ligados aos comandos nativos da extensão (`addRowBefore/After`, `deleteRow`, `addColumnBefore/After`, `deleteColumn`, `deleteTable`).

**Por quê é checkpoint:** é o núcleo funcional mínimo — tabela nasce, cresce, encolhe, é removida. Vale confirmar visualmente (inserção, edição de estrutura, texto dentro de célula, navegação por Tab) e reabrir um e-mail salvo com tabela para confirmar que sobrevive à sanitização de verdade, antes de somar mesclagem, cor e as demais etapas em cima de uma base ainda não validada.

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`, `src/components/Icons.tsx` (ícones dos novos controles da barra contextual), `src/index.css` (popover de inserção + barra contextual).

**Arquivos-fonte necessários:** `src/components/editor/ToolbarPopover.tsx` (reaproveitar o mecanismo de portal/posicionamento/clique-fora já pronto).

### Etapa 3 — Mesclar/dividir células e cabeçalho

**O que fazer:** adicionar à barra contextual os controles de mesclar (`mergeCells`) e dividir (`splitCell`) a seleção de células atual, mais os toggles de linha/coluna de cabeçalho (`toggleHeaderRow`, `toggleHeaderColumn`), nativos da extensão.

**Por quê:** completa a manipulação estrutural da tabela (o que sobra da lista original além de linha/coluna/exclusão, já cobertos na Etapa 2), e os toggles de cabeçalho são os extras de menor esforço confirmados — comandos prontos, só falta o botão.

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`, `src/components/Icons.tsx`, `src/index.css`.

**Arquivos-fonte necessários:** nenhum adicional além do já visto na Etapa 2.

### Etapa 4 — Cor de célula

**O que fazer:** adicionar o atributo `corFundo` a `TableCell`/`TableHeader` (round-trip via `style="background-color"`, mesmo padrão de `NoBotao.ts`/`cor`). Na barra contextual, um botão "Cor da célula" abre um popover reaproveitando `SeletorCor` (grade de tonalidades + campo hex + "Personalizar"), aplicando à seleção de células atual em vez de a uma marca de texto.

**Por quê:** é o item da lista original com maior valor visual (tabela de preço/comparativo depende de cor de fundo para ficar legível), e reaproveita um componente já pronto — não é um seletor novo do zero.

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`, `src/index.css`.

**Arquivos-fonte necessários:** nenhum adicional — `SeletorCor` já foi lido/documentado em `RefatoracaoFonteGruposCores.md`.

### Etapa 5 — Largura de coluna e altura de linha

**O que fazer:** confirmar visualmente que `resizable: true` (já ligado na Etapa 1) cobre largura de coluna por arraste, sem trabalho adicional. Adicionar o atributo `altura` a `TableRow` (round-trip via `style="height"`) e um campo numérico na barra contextual (visível com o cursor em qualquer célula da linha) para definir a altura da linha atual.

**Por quê:** fecha o item "tamanho da célula" da lista original, já esclarecido em conversa como largura por coluna + altura por linha, não por célula individual.

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`, `src/index.css`.

**Arquivos-fonte necessários:** nenhum adicional.

### Etapa 6 — Borda e largura da tabela

**O que fazer:** adicionar atributos `corBorda`/`espessuraBorda` ao nó `table` (round-trip via `style` no `<table>`) com um controle simples na barra contextual (cor via `SeletorCor` reaproveitado da Etapa 4, espessura via campo numérico pequeno). Adicionar um toggle "largura total" vs. "largura fixa" (alternando `style="width: 100%"` e um valor fixo em px) para a tabela como um todo.

**Por quê:** os dois extras restantes confirmados — sem borda visível, tabela em e-mail vira texto alinhado sem contorno; largura fixa em px pode estourar em tela estreita (preview de app, mobile), então o toggle cobre os dois casos de uso mais comuns sem virar um controle de dimensionamento livre.

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`, `src/index.css`.

**Arquivos-fonte necessários:** nenhum adicional.

### Etapa 7 — Duplicar célula

**O que fazer:** dois botões na barra contextual, "duplicar para a direita" e "duplicar para baixo" — cada um lê o conteúdo (texto/HTML interno) e `corFundo` da célula onde o cursor está, e escreve os dois na célula vizinha na direção escolhida, como uma única transação (não uma sequência de ações desfazível em dois passos).

**Por quê:** fecha o item "duplicar conteúdo da célula" da lista original pela via mais simples já alinhada em conversa — sem alça de arraste, sem detecção de intervalo de mouse.

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`, `src/components/Icons.tsx`, `src/index.css`.

**Arquivos-fonte necessários:** nenhum adicional.
