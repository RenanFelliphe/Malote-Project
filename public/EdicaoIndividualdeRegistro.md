# Edição Individual de Registro

> Documento de implementação autocontido da **Demanda 5** (ver `DEMANDAS.md`, seção "Registro de Demandas"). Ao final, sua execução completa deixa a Demanda 5 pronta para ser marcada como **Concluída** em `DEMANDAS.md`.

## 1. Contexto

O **Malote** é uma aplicação React/TypeScript que permite importar planilhas de contatos, validar e-mails, marcar registros como enviados/deletados e exportar o resultado. Hoje, para corrigir um erro de digitação num registro (`nome` ou `email`), o único caminho é reimportar a planilha inteira via `sync.ts` no terminal — não existe edição pontual pela interface.

A própria tabela (`src/components/EmailTable.tsx`) já resolve esse problema para o campo `status`: `renderStatus` substitui o badge por um `<select>` inline quando o registro está sob edição. O objetivo desta demanda é estender o mesmo espírito de edição inline para `nome` e `email`.

Isso levanta uma pergunta maior do que a UI em si: como proteger uma correção manual contra ser silenciosamente sobrescrita numa reimportação futura (Demanda 3)? Hoje essa proteção já existe, mas só para `status`, através do campo booleano `status_alterado` (`EmailRecord`, em `src/types/email.ts`), lido tanto por `recalcularStatusAutomatico` (`src/components/EmailStatus.ts`) quanto por `applyStatusRules` (`src/scripts/sync.ts`). A resposta adotada aqui é generalizar esse mecanismo de proteção para qualquer campo editável manualmente — não só o status.

## 2. Escopo

**Cobre:**
- Edição inline de `nome` e `email` diretamente na célula da tabela (`EmailTable.tsx`), no mesmo espírito visual do stepper de tamanho de fonte do editor (`EmailEditorToolbar.tsx`): buffer local de digitação + confirmação só no blur/Enter, reversão no Esc.
- Persistência imediata via o pipeline já existente (`persistirRegistros`, em `src/pages/emails.tsx`), sem botão "Salvar".
- Revalidação do e-mail digitado (mesma regex de `isValidEmail`, em `EmailStatus.ts`).
- Um novo modelo de proteção unificado (`backup_dados`), que substitui `status_alterado` e passa a cobrir também `nome` e `email`.
- Um único botão "Restaurar" por linha (não mais por célula), que resolve automaticamente quando há só um campo alterado, ou abre um modal de escolha quando há mais de um.

**Não cobre nesta fase:**
- Edição em massa de nome/e-mail para múltiplos registros ao mesmo tempo — é, por natureza, uma correção pontual (cada registro tem um valor único), diferente de status (um conjunto pequeno e fixo de opções, onde aplicar a mesma escolha a vários registros já faz sentido hoje).
- Edição de outros campos além de nome/e-mail (`id` não deve ser editável — é a chave de sincronização com a planilha).
- Qualquer mudança no fluxo de reimportação de planilha (Demanda 3) — esta demanda só prepara o modelo de dados (`backup_dados`) que a Demanda 3 vai precisar consultar para detectar conflitos.

## 3. Modelo de dados: `backup_dados`

Substitui inteiramente o campo `status_alterado` (booleano) de `EmailRecord`:

```ts
interface EmailRecord {
  id: string;
  nome: string;
  email: string;
  status: TStatus;
  backup_dados?: {
    nome?: string;    // valor original da planilha, capturado na primeira edição manual
    email?: string;   // valor original da planilha, capturado na primeira edição manual
    status?: boolean; // true = status foi alterado manualmente (mesmo papel de status_alterado antigo)
  };
  last_updated: string;
}
```

**Regra de captura — "primeira alteração vence", por campo, independentemente:**
- Ao editar `nome` ou `email` pela primeira vez, `backup_dados[campo]` recebe o valor **atual antes da edição** (que nesse momento ainda é o valor vindo da planilha).
- Em qualquer edição seguinte do mesmo campo, `backup_dados[campo]` **não muda** — continua com o valor da primeira captura, nunca o valor imediatamente anterior à edição atual.
- `nome` e `email` são capturados de forma independente um do outro: editar só o e-mail grava só `backup_dados.email`; editar os dois grava as duas chaves.

**Regras de restauração — assimétricas entre campos, por design:**
- **`nome` / `email`:** restaurar escreve o valor capturado em `backup_dados[campo]` de volta no campo, literalmente, e remove a chave.
- **`status`:** restaurar **não** escreve um valor literal de volta — remove a chave `backup_dados.status` e dispara `recalcularStatusAutomatico`. Isso é proposital: o status correto no momento da restauração pode ter mudado desde a alteração manual (ex.: o grupo de duplicados daquele e-mail pode ter encolhido nesse meio tempo), então reaplicar um valor antigo poderia restaurar um status desatualizado. `backup_dados.status` guarda apenas `true`/`false` — nunca o valor de status em si — porque nunca é lido para restauração, só usado como marcação de proteção (mesmo papel que `status_alterado = true` cumpria antes).

A própria presença de uma chave em `backup_dados` já funciona como a trava de proteção contra sobrescrita numa sincronização futura — não é necessário nenhum booleano adicional por campo.

## 4. Botão "Restaurar" por linha

- Um único botão por registro, no canto direito da linha (`td-acoes`, já existente na estrutura de `EmailTable.tsx`) — não mais um botão por célula.
- Visível somente quando **as duas condições** são verdadeiras: (1) `backup_dados` tem pelo menos uma chave presente, e (2) a linha está sob hover ou está selecionada via checkbox — mesmo padrão de visibilidade condicional já usado em `botao-icone-th` (`visibility: hidden` reservando o espaço, não `display: none`).
- **Se `backup_dados` tem exatamente 1 chave:** restaura direto, sem modal — aplica a regra de restauração do campo correspondente (seção 3).
- **Se `backup_dados` tem 2 ou mais chaves:** abre um modal de conflito para o usuário escolher quais campos restaurar.

> **Atenção de nomenclatura:** o botão desta demanda usa `onRestaurarCampos`, mantendo separado o fluxo de restauração de campos do fluxo de restauração da lixeira.

## 5. Modal de restauração — individual vs. em massa

O mesmo modal cobre os dois fluxos, com uma diferença de escopo entre eles:

- **Individual** (clique no botão de restaurar de uma linha específica): o modal mostra **somente os campos daquele registro** que estão em `backup_dados` (ex.: um registro com e-mail e status alterados mostra só essas duas opções).
- **Em massa** (ação equivalente aplicada a uma seleção de vários registros): o modal mostra a **união** de todos os campos alterados entre os registros selecionados — se, na seleção, existir ao menos um registro com nome alterado, um com e-mail alterado e um com status alterado, as três opções aparecem juntas.

Em ambos os casos, ao confirmar a escolha, a restauração de cada campo selecionado só tem efeito nos registros que de fato tinham aquele campo em `backup_dados` — nos demais, é um no-op silencioso. Exemplo (sete registros selecionados, campos escolhidos para restaurar: e-mail, nome e status):

| Registro | Campos alterados antes | Resultado ao restaurar e-mail + nome + status |
|---|---|---|
| 1 | E-mail | E-mail restaurado |
| 2 | Nome | Nome restaurado |
| 3 | Status | Status restaurado (recalculado) |
| 4 | E-mail e Status | Ambos restaurados |
| 5 | Nome e Status | Ambos restaurados |
| 6 | Nome e E-mail | Ambos restaurados |
| 7 | Nenhum | Nada acontece |

> **Decisão registrada aqui:** a variante "em massa" do modal fica **especificada** nesta seção para não perder a decisão de design, mas fora do escopo mínimo de aprovação da demanda (seção 2, "Não cobre nesta fase" trata só de edição em massa de nome/e-mail — restauração em massa de campos já protegidos é uma continuação natural da Etapa 7 e pode ser feita na mesma leva se o tempo permitir; se adiada, deixar registrada como pendência ao final da Etapa 7, não como nova demanda).

## 6. Divisão em etapas

As etapas abaixo são sequenciais até a Etapa 5 (cada uma depende da anterior); as Etapas 6 e 7 dependem de toda a lógica de dados estar pronta (Etapas 1–5).

---

## ⚠️ Fluxo de entrega por etapas — leia antes de começar

Para toda demanda implementada, o processo segue duas partes: uma etapa preliminar de mapeamento (Etapa 0) e a regra de entrega cumulativa que vale a partir da Etapa 1.

### Etapa 0 — Mapeamento ✅ concluída

Etapa preliminar, que roda antes da Etapa 1 de qualquer demanda. Único objetivo: reunir de uma vez o contexto necessário, para que as etapas seguintes não dependam mais do projeto inteiro sendo reenviado a cada troca.

1. A partir do planner da demanda (`nomeDaDemanda.md`), identificar todos os arquivos envolvidos na implementação — Fontes, Alterados e Criados — mesmo os que ainda não existem, mas estão previstos para etapas futuras.

2. Retornar um único ZIP contendo o planner da demanda + todos esses arquivos. Os "Criados" que ainda não foram implementados devem ser criados e guardados vazios.

A partir daqui, o usuário passa a enviar apenas o ZIP mais recente como referência — nunca mais o projeto inteiro.

**Nota de execução (Etapa 0):** ZIP montado com os 12 arquivos da seção 7 — 3 Fonte, 6 Alterados (incluindo `EmailStatus.ts`, que aparece também como Fonte por conter `isValidEmail`), 3 Criados (`restaurarCampos.ts`, `RestaurarCamposModal.tsx`, `migrarBackupDados.ts`, todos vazios — nenhuma etapa de implementação foi iniciada ainda). Nenhum ajuste de rota necessário nesta etapa.

### Regra de entrega (Etapa 1 em diante)

A cada etapa, a entrega é **um único ZIP, cumulativo**:

- **Contém todos os arquivos necessários até aqui, não só os da etapa atual.** Isso inclui (a) todo arquivo efetivamente alterado desde a Etapa 1 desta revisão, e (b) todo arquivo listado como Fonte, Alterado ou Criado em qualquer etapa já concluída — mesmo os que nunca chegaram a ser modificados. Uma vez que um arquivo apareceu em algum ZIP, ele continua aparecendo em todos os ZIPs seguintes até o fim da implementação, para que o usuário nunca precise reenviar manualmente algo que ainda é relevante, só porque não mudou na etapa mais recente.

- **Sempre inclui o planner da demanda** (`nomeDaDemanda.md`), atualizado a cada entrega: etapas concluídas marcadas com "✅ concluída" no título, notas de execução preenchidas, e qualquer ajuste de rota registrado — caso um diagnóstico feito durante a implementação mude uma decisão já tomada no planner.

---

### Etapa 1 — Modelo de dados ✅ concluída

**Nota de execução:** `backup_dados` adicionado a `EmailRecord` em `src/types/email.ts` (com a documentação completa das regras de captura/restauração da seção 3), `status_alterado` removido. `recalcularStatusAutomatico` (`EmailStatus.ts`) e `applyStatusRules` (`sync.ts`) migrados para ler `backup_dados?.status`. Novos registros em `sync.ts` nascem sem `backup_dados` (antes nasciam com `status_alterado: false`). `npx tsc --noEmit` limpo nos três tsconfigs (app/scripts/node) e `eslint` limpo nos 3 arquivos alterados — os erros existentes em `npm run lint` (LixeiraSidebar.tsx, Paginacao.tsx, QuantidadeInput.tsx, ThemeContext.tsx) são pré-existentes, não relacionados a esta etapa. Como esperado, `EmailTable.tsx`/`emails.tsx` ainda usam `status_alterado` em object literals com spread — TypeScript não acusou erro de excess-property nesses pontos porque o retorno não é contextualmente tipado como `EmailRecord`, então o "checklist automático de erros de build" citado no racional desta etapa não se materializou; o rastreamento desses usos ficará por conta da Etapa 3/4/6 (ver seção 7). Nenhum ajuste de rota nas decisões do planner.

**O que fazer:**
- Em `src/types/email.ts`: remover `status_alterado` de `EmailRecord`; adicionar `backup_dados?: { nome?: string; email?: string; status?: boolean }`.
- Em `src/components/EmailStatus.ts` (`recalcularStatusAutomatico`): ler `backup_dados?.status` no lugar de `status_alterado`.
- Em `src/scripts/sync.ts` (`applyStatusRules`): ler `backup_dados?.status` no lugar de `status_alterado`.
- Novos registros (criados por sincronização) nascem sem `backup_dados`.

**Por quê:** é a mudança de modelo em si. Feita isolada e primeiro, o próprio compilador TypeScript passa a listar, como erro de build, todo lugar que ainda referencia `status_alterado` — funcionando como checklist automático das etapas seguintes.

### Etapa 2 — Migração dos dados já existentes ✅ concluída

**Nota de execução:** optei pela abordagem de script único (`src/scripts/migrarBackupDados.ts`, seguindo o mesmo padrão CLI de `sync.ts`), em vez de leitura retrocompatível no carregamento — mantém a lógica de migração fora do caminho de carregamento normal (mais simples de auditar e de rodar uma única vez). O script varre genericamente todo `data/active/<slug>/emails.json` (em vez de hardcodar os dois caminhos citados no planner), suporta `--dry-run` e é idempotente (registro sem `status_alterado` é ignorado). Adicionado `npm run migrar-backup-dados` ao `package.json`, no mesmo molde de `npm run sync`.

Rodado com `--dry-run` primeiro (1815 + 100 = 1915 registros identificados), depois de fato: `chamada-alunos-ibm/emails.json` (1815 registros, todos `status_alterado: false`) migrou sem nenhum ganhar `backup_dados` (campo apenas removido); `projeto-teste/emails.json` (100 registros, 2 com `status_alterado: true`) migrou com esses 2 ganhando `backup_dados: { status: true }`. Confirmado zero `status_alterado` remanescente nos dois arquivos e reexecução subsequente migra 0/0 (idempotência). `tsc --noEmit` limpo nos três tsconfigs e `eslint` limpo no script novo. Nenhum ajuste de rota nas decisões do planner.

**O que fazer:** os arquivos `data/active/projeto-teste/emails.json` e `data/active/chamada-alunos-ibm/emails.json` têm registros com `status_alterado: true`. Escrever uma migração — script único (ex. `src/scripts/migrarBackupDados.ts`, rodado uma vez) ou leitura retrocompatível no carregamento — que traduza `status_alterado: true` → `backup_dados: { status: true }`.

**Por quê:** sem essa migração, os dados de produção quebram silenciosamente assim que o tipo mudar na Etapa 1 (um registro com `status_alterado: true` mas sem `backup_dados` perde a proteção contra sobrescrita).

### Etapa 3 — Captura em `nome`/`email` ✅ concluída

**Nota de execução:** lógica de captura implementada como função pura `capturarEdicaoCampo(registro, campo, novoValor)`, exportada em `EmailTable.tsx` junto com o tipo `TCampoEditavel = 'nome' | 'email'`. Aplica exatamente a regra "primeira vez vence" da seção 3: checa `registro.backup_dados?.[campo] !== undefined` antes de gravar — se já capturado, `backup_dados` é devolvido intocado (mesma referência); caso contrário, captura o valor **atual** do registro (pré-edição) só naquela chave, via `{ ...registro.backup_dados, [campo]: registro[campo] }`, preservando qualquer chave já existente de outro campo (independência entre `nome`/`email`/`status`, conforme a proteção por campo). Deliberadamente não faz revalidação de e-mail (`isValidEmail`) nem recálculo de status — fica a critério do chamador, que ainda não existe (ver abaixo). Optei por deixar a função como utilitário puro e testável isoladamente em vez de já embuti-la num handler, para que a Etapa 4 (que vai criar o `<input>` real e o handler de blur/Enter/Esc) só precise chamá-la, sem repetir a lógica de captura. Como esperado, a função ainda **não é chamada em lugar nenhum**: as células de `nome`/`email` em `EmailTable.tsx` continuam como `<td>{registro.nome}</td>`/`<td>{registro.email}</td>` estáticos — a integração com edição inline real e com `persistirRegistros` (`emails.tsx`) é o escopo da Etapa 4. Não tive acesso ao projeto completo (`tsconfig.json`, demais componentes) nesta sessão para rodar `tsc`/`eslint` fim a fim — a revisão desta etapa foi por inspeção manual do arquivo alterado; recomendo rodar `npm run build`/`npm run lint` no projeto completo antes de seguir para a Etapa 4. Nenhum ajuste de rota nas decisões do planner.

**O que fazer:** no handler de persistência de edição de célula (dentro de `EmailTable.tsx`, acionado antes de chamar `persistirRegistros` em `emails.tsx`): antes de gravar o novo valor, checar se `backup_dados[campo]` já existe; só capturar o valor atual se ainda não existir (regra "primeira vez vence", seção 3).

**Por quê:** é a lógica central da proteção — sem ela, a segunda edição do mesmo campo sobrescreveria a primeira captura, e o "valor original da planilha" se perderia.

### Etapa 4 — Campo editável na tabela ✅ concluída

**Nota de execução:** ao abrir o ZIP recebido para esta etapa, `EmailTable.tsx` e `emails.tsx` já continham a implementação completa da Etapa 4 — divergência do que a nota de execução da Etapa 3 registrava ("as células continuam estáticas"). Como o Teste 7 (build/lint) não pôde ser rodado durante a Etapa 3 por falta do projeto completo, um adiantamento de escopo passou despercebido na revisão daquela etapa; ajuste de rota registrado aqui, sem retrabalho, já que o código entregue está correto e cobre a especificação linha a linha. Revisão feita nesta sessão, por inspeção manual (mesma limitação de acesso ao projeto completo da Etapa 3 — recomendo `npm run build`/`npm run lint` no projeto completo antes da Etapa 5):

- `renderCelulaEditavel` (`EmailTable.tsx`) alterna texto estático / `<input>` ao clicar, com foco e seleção automáticos do conteúdo ao entrar em edição.
- `confirmarEdicaoCelula` cobre blur e Enter; `cancelarEdicaoCelula` cobre Esc, sem persistir. Valor idêntico ao atual ou vazio (após trim) cancela silenciosamente, sem gravar nem capturar em `backup_dados` — não é uma correção de fato.
- Revalidação de e-mail com `isValidEmail` (`EmailStatus.ts`) antes de confirmar; valor inválido mantém a edição aberta com `erroEdicaoEmail` e não é persistido.
- Captura em `backup_dados` via `capturarEdicaoCampo` (Etapa 3) já integrada dentro de `confirmarEdicaoCelula`, antes de propagar para `onEditarCampo`.
- `handleEditarCampo` (`emails.tsx`) persiste via `persistirRegistros` e só recalcula status (`recalcularStatusAutomatico`, sobre o conjunto inteiro, não só o registro editado) quando `campo === 'email'` — edição de `nome` nunca aciona o recálculo, como especificado.
- Busca por `status_alterado` em `src/` confirma zero ocorrências fora de comentários/changelog (critério da seção 8.1).
- `td-acoes` continua vazio (`<td className="td-acoes" />`) e `IconeRestaurar` só é usado no botão de restauração em massa do cabeçalho — confirma que a Etapa 6 (botão de restaurar por linha) não foi antecipada por engano junto com a 4.

Nenhuma alteração de código foi necessária nesta etapa.

**O que fazer:**
- Em `EmailTable.tsx`: trocar `<td>{registro.nome}</td>` e `<td>{registro.email}</td>` por um campo editável inline, no mesmo espírito do stepper de tamanho de fonte (`EmailEditorToolbar.tsx`): exibição normal por padrão, vira `<input>` ao clicar, confirma no blur ou Enter, reverte no Esc.
- Ao confirmar edição de e-mail: revalidar com `isValidEmail` e recalcular status conforme a prioridade já existente (só se `backup_dados.status` for ausente/`false`).

**Por quê:** é a parte visível da demanda — sem ela, o modelo de dados das Etapas 1–3 não tem como ser acionado pelo usuário.

### Etapa 5 — Lógica central de restauração ✅ concluída

**Nota de execução:** `restaurarCampos(registro, camposEscolhidos)` implementada em `src/components/utils/restaurarCampos.ts` (antes vazio) como função pura, seguindo o mesmo estilo de `capturarEdicaoCampo` (Etapa 3): não muta `registro`, opera sobre um único registro (sem acesso ao conjunto completo). Novo tipo `TCampoRestauravel = 'nome' | 'email' | 'status'` (distinto de `TCampoEditavel`, que só cobre `nome`/`email` — a edição inline nunca lida com `status`, mas a restauração sim). Cada campo escolhido só tem efeito se estiver de fato presente em `backup_dados` — senão é ignorado silenciosamente (no-op da seção 5), o que permite passar a mesma lista de `camposEscolhidos` (ex. a escolha do usuário no modal em massa da Etapa 7) para vários registros sem filtrar antes campo a campo. Regra assimétrica da seção 3 aplicada: `nome`/`email` são escritos de volta literalmente (valor de `backup_dados[campo]`); `status` **não** recebe nenhum valor literal — a função só remove a chave `backup_dados.status`, deixando o recálculo de fato (`recalcularStatusAutomatico`, que precisa do array completo para recontar duplicados) a cargo do chamador (Etapa 6/7 em `emails.tsx`), no mesmo padrão já usado por `handleRestaurar` (restauração em massa de status, hoje já existente). Quando nenhum campo escolhido está presente em `backup_dados`, retorna a mesma referência do registro recebido, sem gravar `last_updated` — evita marcar como alterado um registro que na prática não mudou. `backup_dados` volta a `undefined` (não objeto vazio) quando a última chave é removida, mesmo padrão já usado em `handleRestaurar`/`capturarEdicaoCampo`. Checado isoladamente com `tsc --noEmit --strict` sobre o arquivo (sem tsconfig do projeto completo, mesma limitação de acesso das Etapas 3/4 — recomendo `npm run build`/`npm run lint` no projeto completo antes da Etapa 6): sem erros. Busca por `status_alterado` em `src/` confirma zero ocorrências fora de comentários/changelog. Nenhum ajuste de rota nas decisões do planner.

**O que fazer:** criar `restaurarCampos(registro, camposEscolhidos)` (novo módulo, `src/components/utils/restaurarCampos.ts`), que aplica a regra certa por campo: literal para `nome`/`email`, recálculo automático (via `recalcularStatusAutomatico`) para `status`. Usada tanto pelo caminho "1 campo, sem modal" quanto pela confirmação do modal.

**Por quê:** centralizar a regra assimétrica (seção 3) num único lugar evita que o botão direto e o modal implementem a mesma lógica de forma divergente.

### Etapa 6 — Botão de restaurar por linha ✅ concluída

**Nota de execução:** Novo botão em `td-acoes` (`EmailTable.tsx`, antes vazio) usando o mesmo `IconeRestaurar` já usado no dropdown de restauração em massa do cabeçalho. Só é renderizado quando `onRestaurarCampos` está presente e `registro.backup_dados` tem ao menos 1 chave — condição (1) da seção 4 satisfeita via JS. Condição (2) (hover ou seleção): a parte de seleção é resolvida via classe JS (`selecionados.has(registro.id)` alterna `botao-restaurar-linha-invisivel`, mesmo padrão de `botao-icone-th-invisivel`); a parte de hover depende de uma regra CSS (`tr:hover .botao-restaurar-linha-invisivel { visibility: visible }`) que **não pôde ser verificada nem adicionada nesta sessão** — a folha de estilos do projeto não está entre os arquivos desta demanda (seção 7) e não veio no ZIP recebido. Ajuste de rota registrado aqui: se essa regra ainda não existir no CSS global do projeto, o botão só ficará visível ao selecionar a linha, não ao passar o mouse — recomendo confirmar/adicionar essa regra fora desta sessão antes de considerar a Etapa 6 visualmente completa.

Clique no botão (`handleClicarRestaurarLinha`) decide entre os dois caminhos da seção 4: com exatamente 1 chave em `backup_dados`, chama `restaurarCampos` (Etapa 5) diretamente e propaga o registro já atualizado via novo prop `onRestaurarCampos` — nome escolhido deliberadamente diferente do `onRestaurar` já existente (restauração em lote de deletados), conforme o aviso de nomenclatura da seção 4. Com 2+ chaves, repassa registro + campos disponíveis para um novo prop `onAbrirConflitoRestaurarCampos`, que ainda não é passado por `emails.tsx` nesta etapa (o modal que o consome só existe a partir da Etapa 7) — clicar em "Restaurar" num registro com 2+ campos alterados não tem efeito visível por enquanto, mesmo padrão de degradação graciosa de outros props opcionais do componente (`onEditarCampo`, `onAtualizarStatusIndividual`).

Em `emails.tsx`, novo handler `handleRestaurarCampos` (mesmo padrão de `handleEditarCampo`): substitui o registro no array, recalcula o status automático do conjunto inteiro via `recalcularStatusAutomatico` apenas quando `'status'` está entre os campos restaurados (mesmo motivo do recálculo condicional em `handleEditarCampo` — `restaurarCampos` não tem acesso aos demais registros para recontar duplicados) e persiste via `persistirRegistros`. Ajuste de rota: `emails.tsx` está sendo tratado como Alterado nesta etapa (e já era, de fato, desde a Etapa 4, apesar de listado só como Fonte na tabela original da seção 7 — ver nota da Etapa 4).

Sem tsconfig do projeto completo nesta sessão (mesma limitação das Etapas 3-5): checagem feita com `tsc --strict --noEmit` sobre `EmailTable.tsx` e `emails.tsx` isoladamente, usando stubs locais só para os módulos externos ausentes do ZIP (`Icons.tsx`, `clipboard.ts`, `EmailToolbar.tsx`, etc.) — zero erros atribuíveis ao código desta etapa (os 3 erros de tipo implícito `any` que apareceram vêm dos próprios stubs simplificados, não do código alterado). Recomendo `npm run build`/`npm run lint` no projeto completo antes da Etapa 7. Busca por `status_alterado` em `src/` confirma zero ocorrências fora de comentários/changelog.

**O que fazer:** novo ícone na área de ações da linha (`td-acoes`, já existente em `EmailTable.tsx`), com a regra de visibilidade condicional (hover ou seleção + `backup_dados` não vazio, seção 4). Decide entre restaurar direto (1 campo, chamando `restaurarCampos` diretamente) ou abrir o modal (2+ campos).

**Por quê:** consequência direta da Etapa 5 — a UI só existe depois que a lógica que ela aciona está pronta e testável isoladamente.

### Etapa 7 — Modal de conflito de restauração ✅ concluída

**Nota de execução:** `RestaurarCamposModal.tsx` (antes vazio) implementado sobre `ConflictDialog` (mesmo casco de `ConflitoExclusaoModal`/`DuplicadosConflitoModal`): recebe `campos: TCampoRestauravel[]` e renderiza uma lista de checkboxes (um por campo), todos pré-marcados ao abrir — restaurar tudo é o caminho mais comum, desmarcar é a exceção. Botão "Restaurar" (via `confirmLabel`) fica desabilitado quando a seleção esvazia (`confirmDisabled` + `disabledHint` do `ConflictDialog`). Ao confirmar, devolve só a lista de campos marcados (`onConfirmar(camposEscolhidos)`) — a aplicação de fato (`restaurarCampos`) e a persistência ficam com quem consome o modal (`emails.tsx`), mantendo o componente "burro" no mesmo espírito do `DeleteConflictContent` citado na doc do `ConflictDialog`.

Em `emails.tsx`: novo estado `conflitoRestaurarCampos` (registro pendente + campos disponíveis), preenchido por `handleAbrirConflitoRestaurarCampos` — agora finalmente conectado ao prop `onAbrirConflitoRestaurarCampos` da tabela (Etapa 6, que ficava sem handler até aqui). `handleConfirmarConflitoRestaurarCampos` aplica `restaurarCampos` (Etapa 5) só com os campos escolhidos e reaproveita `handleRestaurarCampos` (mesmo handler do caminho direto de 1 campo, Etapa 6) para persistir e recalcular status quando aplicável — os dois caminhos (direto e via modal) convergem no mesmo handler de persistência, evitando duplicar a lógica de "quando recalcular". `handleCancelarConflitoRestaurarCampos` fecha sem alterar nada, mesmo padrão dos demais modais de conflito (`ConflitoExclusaoModal`/`DuplicadosConflitoModal`).

**Cobre só o modo individual** (seção 5): a variante "em massa" foi deliberadamente adiada, conforme a decisão já registrada na própria seção 5 do planner — fica como pendência explícita, documentada no JSDoc do componente, e não como nova demanda. Não existe nenhum ponto de entrada de restauração em massa nesta implementação (nenhum botão na barra de seleção múltipla abre este modal).

Durante a implementação, uma edição anterior (Etapa 6) havia deixado um bloco de comentário órfão em `emails.tsx` (a abertura do JSDoc de `deletarRegistros` tinha sido cortada por engano ao inserir os handlers novos) — corrigido nesta sessão junto com o resto; sem isso o arquivo não compilava. Ajuste de rota registrado aqui por transparência, já que o erro foi introduzido numa etapa anterior desta mesma sessão de trabalho, não pré-existente ao início dela.

Sem tsconfig do projeto completo nesta sessão (mesma limitação das Etapas 3-6): checagem feita com `tsc --strict --noEmit` sobre `RestaurarCamposModal.tsx`, `EmailTable.tsx` e `emails.tsx` juntos, com stubs locais para os módulos ausentes do ZIP (`Dialog.tsx`, `Icons.tsx`, `EmailToolbar.tsx`, etc.) — zero erros depois de corrigir um stub imprecis (tipo de `onAlternarFiltro`, sem relação com o código desta demanda). Recomendo `npm run build`/`npm run lint` no projeto completo para confirmação final, incluindo os Testes 1-7 da seção 9 (em especial o Teste 4, restauração via modal, e o Teste 7, build/lint) — critério de aprovação da Demanda 5 completa (seção 8). Busca por `status_alterado` em `src/` confirma zero ocorrências fora de comentários/changelog.

**Adendo — variante em massa (seção 5), implementada nesta mesma sessão a pedido do usuário, depois da nota acima:** o item unificado "Restaurar" no dropdown de ações do cabeçalho (`EmailTable.tsx`) abre o fluxo de restauração de campos quando ao menos 1 registro selecionado tem `backup_dados` com 1+ chave. A restauração antiga de status em massa foi removida do dropdown; o fluxo unificado cobre também registros com `backup_dados.status`. `handleAbrirRestaurarCamposEmMassa` filtra os selecionados com algo em `backup_dados` e calcula a união dos campos entre eles, repassando via novo prop `onAbrirConflitoRestaurarCamposEmMassa`. `RestaurarCamposModal` generalizado com prop `quantidadeRegistros` (1 = individual, 2+ = massa) só para ajustar o texto — os checkboxes e o no-op por registro/campo continuam exatamente como já eram, sem lógica nova ali. Em `emails.tsx`, `conflitoRestaurarCampos` passou a guardar sempre um array de registros (`[registro]` no individual, N no massa) e ganhou um núcleo comum de persistência (`aplicarRestauracaoDeCampos`) reaproveitado pelos três caminhos (direto, modal individual, modal em massa). Corrigido também o gate que decide se o menu do cabeçalho aparece para incluir `onAbrirConflitoRestaurarCamposEmMassa`. Checado com `tsc --strict --noEmit` isolado (mesmos stubs) sobre os três arquivos juntos — zero erros. A pendência do CSS de hover do botão por linha foi resolvida posteriormente em `src/index.css`; a recomendação de `npm run build`/`npm run lint` + Testes 1-7 completos no projeto real continua de pé.

**O que fazer:** novo componente (`src/components/RestaurarCamposModal.tsx`), reaproveitando `ConflictDialog` como casco (mesmo padrão de `ConflitoExclusaoModal`/`DuplicadosConflitoModal`). Modo individual: lista os campos daquele registro específico. Modo em massa (ver seção 5 para a decisão de escopo): lista a união dos campos alterados entre os registros selecionados; aplica `restaurarCampos` em cada um, respeitando o no-op onde não se aplica.

**Por quê:** fecha o fluxo descrito na seção 5 — sem ele, um registro com 2+ campos protegidos não tem como ser restaurado pela interface.

## 7. Arquivos Necessários

**Arquivos Fonte** (usados como referência, não sofrem alteração):
- `src/components/EmailStatus.ts` — regex de validação de e-mail (`isValidEmail`), reaproveitada para revalidar o e-mail editado inline (Etapa 4).
- `src/components/ConflictDialog.tsx` — casco reaproveitado como base visual do novo modal de conflito de restauração (Etapa 7).
- `src/pages/emails.tsx` — pipeline `persistirRegistros` já existente, para onde a edição de célula precisa propagar o registro atualizado (Etapa 3).

**Arquivos Alterados:**
- `src/types/email.ts` — remove `status_alterado` de `EmailRecord`; adiciona `backup_dados?: { nome?: string; email?: string; status?: boolean }` (Etapa 1).
- `src/components/EmailStatus.ts` — `recalcularStatusAutomatico` passa a ler `backup_dados?.status` no lugar de `status_alterado` (Etapa 1).
- `src/scripts/sync.ts` — `applyStatusRules` passa a ler `backup_dados?.status` no lugar de `status_alterado` (Etapa 1).
- `src/components/EmailTable.tsx` — célula de nome/e-mail vira campo editável inline; captura em `backup_dados` na primeira edição; botão "Restaurar" na área `td-acoes` com a regra de visibilidade condicional; ação unificada de restauração no dropdown (Etapas 3, 4 e 6).
- `data/active/projeto-teste/emails.json` — migração dos registros com `status_alterado: true` para `backup_dados: { status: true }` (Etapa 2).
- `data/active/chamada-alunos-ibm/emails.json` — mesma migração do item acima (Etapa 2).

**Arquivos Criados:**
- `src/components/utils/restaurarCampos.ts` *(nome sugerido)* — função única `restaurarCampos(registro, camposEscolhidos)`, com a regra de restauração por campo (Etapa 5).
- `src/components/RestaurarCamposModal.tsx` *(nome sugerido, distinto de `ConflitoRestauracaoModal.tsx` já existente, que trata do conflito de slug na restauração da lixeira — não confundir os dois)* — modal de conflito de restauração de campos (individual e em massa), construído sobre `ConflictDialog` (Etapa 7).
- `src/scripts/migrarBackupDados.ts` *(nome sugerido, opcional — só se a Etapa 2 optar por script de migração em vez de leitura retrocompatível no carregamento)*.

## 8. Critérios de avaliação

A demanda será considerada **aprovada** quando todos os itens abaixo forem verdadeiros.

### 8.1 O que deve ser entregue

- Código-fonte com as 7 etapas implementadas, sem nenhuma referência remanescente a `status_alterado` em `src/` (busca deve retornar zero ocorrências fora de comentários históricos/changelog).
- `data/active/projeto-teste/emails.json` e `data/active/chamada-alunos-ibm/emails.json` migrados (Etapa 2 aplicada), sem nenhum registro com `status_alterado`.
- Um resumo curto (no corpo do commit/PR) listando quais das 7 etapas foram concluídas e se a variante "em massa" do modal (seção 5) entrou nesta leva ou ficou pendente.

### 8.2 O que o sistema deve fazer para ser aprovado

- **Build limpo:** `npm run build` (`tsc -b` + Vite) completa sem erros de tipo.
- **Lint limpo:** `npm run lint` não aponta erros novos.
- **Edição inline funciona:** clicar em `nome` ou `email` de um registro abre um campo editável; confirmar no blur/Enter persiste via `persistirRegistros`; Esc reverte sem persistir.
- **Captura "primeira vez vence":** editar o mesmo campo duas vezes mantém, em `backup_dados`, o valor da planilha original — nunca o valor da primeira edição.
- **Proteção por campo é independente:** editar só o e-mail de um registro grava `backup_dados.email` sem tocar em `backup_dados.nome`/`backup_dados.status`.
- **Botão "Restaurar" aparece só quando deveria:** some quando `backup_dados` está vazio; some quando a linha não está em hover/selecionada; aparece nas duas condições combinadas.
- **Restauração direta (1 campo):** clicar em "Restaurar" com só `backup_dados.email`, por exemplo, restaura o e-mail original sem abrir modal.
- **Restauração via modal (2+ campos):** clicar em "Restaurar" com 2+ chaves em `backup_dados` abre o modal, listando exatamente os campos daquele registro.
- **Restauração de `status` é recalculada, não literal:** restaurar o status de um registro cujo grupo de duplicados mudou desde a alteração manual reflete o estado atual do grupo, não o valor antigo.
- **`npm run sync` continua funcionando** sobre uma planilha de teste, sem erro, respeitando registros com `backup_dados` (não sobrescrevendo campos protegidos).

## 9. Como testar e validar manualmente

### 9.1 Preparar o ambiente

```bash
npm install
npm run dev
```

Abra o endereço local mostrado no terminal (por padrão, algo como `http://localhost:5173`).

### 9.2 Teste 1 — edição inline e captura

1. Abra um projeto existente (ex. "Projeto Teste") e localize um registro qualquer.
2. Clique no nome do registro, edite o texto e confirme com Enter.
3. **Verifique:** o novo nome aparece na tabela imediatamente, sem botão "Salvar", e o botão "Restaurar" passa a aparecer ao passar o mouse sobre a linha ou selecioná-la.
4. Edite o nome do mesmo registro uma segunda vez, para um valor diferente.
5. **Verifique (via inspeção do arquivo `data/active/<slug>/emails.json` ou de uma ferramenta de rede):** `backup_dados.nome` continua com o valor **original da planilha** (antes da primeira edição), não com o valor da edição anterior.

### 9.3 Teste 2 — revalidação de e-mail

1. Edite o e-mail de um registro para um valor sintaticamente inválido (ex. `sem-arroba`).
2. **Verifique:** o sistema recusa ou sinaliza o valor inválido, seguindo a mesma regra já usada em `isValidEmail`.
3. Edite para um e-mail válido e diferente do original.
4. **Verifique:** o status é recalculado conforme a prioridade existente, a menos que `backup_dados.status` já esteja presente (status alterado manualmente antes).

### 9.4 Teste 3 — restauração direta (1 campo)

1. Com um registro que tenha **apenas** `backup_dados.email` preenchido (edite só o e-mail dele), clique no botão "Restaurar" da linha.
2. **Verifique:** o e-mail volta ao valor original da planilha, sem nenhum modal aparecer, e o botão "Restaurar" some (já que `backup_dados` volta a ficar vazio).

### 9.5 Teste 4 — restauração via modal (2+ campos)

1. No mesmo registro (ou outro), edite **nome, e-mail e status**, para que as três chaves existam em `backup_dados`.
2. Clique em "Restaurar".
3. **Verifique:** abre um modal listando as três opções (nome, e-mail, status).
4. Escolha restaurar só nome e status (deixando o e-mail editado intacto) e confirme.
5. **Verifique:** nome volta ao original, status é recalculado (não necessariamente igual ao valor antigo, se o grupo de duplicados mudou), e-mail permanece com o valor editado, e `backup_dados` mantém só a chave `email`.

### 9.6 Teste 5 — status restaurado é recalculado, não literal

1. Crie um cenário com 2 registros de e-mails iguais (duplicados).
2. Altere manualmente o status de um deles (ex. para "inválido"), o que grava `backup_dados.status = true`.
3. Delete o outro registro do par (o que faz o grupo de duplicados "encolher").
4. Restaure o status do primeiro registro.
5. **Verifique:** o status resultante reflete o estado atual (sem duplicidade), não necessariamente o mesmo valor de antes da alteração manual.

### 9.7 Teste 6 — sincronização via terminal ainda respeita a proteção

1. Rode:
   ```bash
   npm run sync -- <caminho-da-planilha-de-teste>
   ```
2. **Verifique:** registros com `backup_dados` não vazio não têm `nome`/`email`/`status` sobrescritos pela planilha; registros sem `backup_dados` continuam sincronizando normalmente.

### 9.8 Teste 7 — build e checagem de tipos

```bash
npm run build
npm run lint
```

**Verifique:** ambos terminam sem erros — confirma que nenhuma referência solta a `status_alterado` ficou para trás.

Se todos os testes acima passarem, a Demanda 5 pode ser considerada validada e pronta para o registro de status ser atualizado em `DEMANDAS.md`.
