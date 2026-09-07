# Refatoração do Sistema de Duplicatas

## 1. Contexto do projeto

O **Malote** é uma aplicação React/TypeScript que permite importar planilhas de contatos, validar e-mails, identificar duplicatas, marcar registros como enviados/deletados manualmente e exportar o resultado. Cada projeto tem seus próprios dados em `data/active/<slug>/emails.json`, que é a fonte oficial e é atualizado de duas formas:

- pela interface (`src/pages/emails.tsx`), a cada ação do usuário;
- pelo script de sincronização de terminal (`src/scripts/sync.ts`), quando uma nova planilha é importada.

Cada registro (`EmailRecord`, definido em `src/types/email.ts`) tem hoje um único campo `status`, que pode assumir 5 valores: `válido`, `inválido`, `duplicado`, `deletado` ou `enviado`. Um campo auxiliar, `status_alterado`, funciona como uma trava: quando `true`, indica que o status foi definido manualmente pelo usuário e **nunca deve ser recalculado automaticamente** pelo sistema (essa regra está implementada, de forma idêntica, em `src/components/EmailStatus.ts` e em `src/scripts/sync.ts`).

## 2. A demanda

### 2.1 O problema observado

O status `duplicado` é calculado automaticamente sempre que dois ou mais registros ativos compartilham o mesmo e-mail. Isso funciona bem enquanto nenhum dos registros do grupo foi alterado manualmente. O problema aparece quando um registro manual entra na equação. Passo a passo do cenário que expôs o bug:

1. Existem 3 registros com o mesmo e-mail → todos ficam automaticamente como `duplicado`.
2. Dois deles são deletados. Como o cálculo de duplicidade ignora registros deletados, o terceiro registro deixa de ter "irmãos" e passa a ser recalculado como `válido`.
3. Esse registro `válido` é alterado manualmente para `inválido`. Isso liga `status_alterado = true`, travando o status.
4. Um dos registros deletados é restaurado. Ele não tem a trava ligada, então é recalculado normalmente — como agora existem 2 registros ativos com o mesmo e-mail de novo, ele volta a ser `duplicado`.
5. Resultado final: dois registros com o **mesmo e-mail**, um mostrando `duplicado` e o outro mostrando `inválido` — sem nenhuma indicação visual de que estão relacionados, exceto que clicar no que ainda diz `duplicado` abre o modal de conflito e revela o outro.

### 2.2 Por que isso acontece (não é um bug de lógica)

O comportamento é consistente com a regra documentada do sistema: uma vez que o usuário decide manualmente o status de um registro, o sistema promete nunca mais tocar nele sozinho. `duplicado` é apenas mais um resultado de recálculo automático, então ele respeita a mesma trava — o registro manual (`inválido`) fica congelado, e o restaurado (sem trava) é recalculado normalmente.

### 2.3 A causa raiz

O problema de fundo é de **modelagem de dados**: hoje "duplicado" desempenha dois papéis ao mesmo tempo dentro de um único campo `status`:

- (a) é um dos 5 valores possíveis de status, mutuamente exclusivo com `válido`/`inválido`/`deletado`/`enviado`;
- (b) é, na prática, uma característica ortogonal — um fato sobre o conjunto de dados ("este e-mail aparece mais de uma vez"), que deveria poder coexistir com qualquer status real.

Como só existe um campo para as duas coisas, um registro nunca consegue ser, ao mesmo tempo, "inválido" **e** "clicável para ver os duplicados" — o sistema é forçado a escolher um dos dois rótulos.

### 2.4 A solução: desacoplar "duplicado" de "status"

A decisão tomada é migrar `duplicado` de **valor de status** para **flag calculada**, exibida ao lado do status real. Na prática:

- `status` passa a ter 4 valores possíveis: `válido`, `inválido`, `deletado`, `enviado`.
- Duplicidade passa a ser um dado derivado (`Set` de e-mails normalizados que aparecem mais de uma vez entre registros **ativos**), calculado em runtime — nunca persistido como campo novo no JSON. Deixa de existir um badge `duplicado` próprio; em vez disso, o registro exibe seu status real (badge/select normal) e, ao lado, um **ícone de alerta** sempre que o e-mail estiver no `Set` — com tooltip ("Este registro está duplicado") e clique para abrir o modal de duplicados. O status em si nunca mostra mais a palavra "duplicado".
- Um registro pode agora ser `válido` **e** duplicado, `inválido` **e** duplicado, ou `enviado` **e** duplicado, simultaneamente. `deletado` fica de fora dessa combinação: um registro deletado já é ignorado no cálculo do grupo de duplicados e não tem ação além de "Restaurar", então o indicador não se aplica a ele.
- A trava de `status_alterado` **não muda** — continua garantindo que nenhum status definido manualmente seja sobrescrito sozinho. O que muda é que essa trava deixa de decidir também se o registro "pode ser visto como duplicado".

## 3. Divisão em etapas

A refatoração está dividida em 15 etapas, pensadas para serem executadas nesta ordem. As etapas 0 a 3 são estritamente sequenciais (cada uma depende da anterior); a partir da etapa 4, várias podem ser feitas em qualquer ordem entre si. As etapas 5 e 8 são pontos de checkpoint: mudam algo perceptível para quem usa o sistema, não só a estrutura interna do código.

### Etapa 0 — Migração dos dados existentes

**Status: concluída.** Script `src/scripts/migrarStatusDuplicado.ts` (`npm run migrar-status-duplicado`), rodado sobre todos os projetos existentes — 368 registros migrados no total.

**Decisão registrada nesta execução:** o script varre `data/active/<slug>/emails.json` **e também** `data/trash/<pasta>/emails.json`, embora o texto original desta etapa citasse apenas `data/active`. Motivo: um projeto na lixeira pode ser restaurado a qualquer momento, e nenhum passo do fluxo de restauração recalcula status — sem migrar a lixeira também, um projeto excluído hoje com registros `'duplicado'` reintroduziria o valor legado no sistema, silenciosamente, ao ser restaurado depois do tipo já ter mudado.

**O que fazer:** escrever e rodar um script único que percorre `data/active/<slug>/emails.json` de **cada projeto existente** e, para todo registro com `status === 'duplicado'`, recalcula qual seria o status real dele (`válido` ou `inválido`, via `isValidEmail`) e regrava esse valor no campo `status`.

**Por quê:** hoje `status: 'duplicado'` sobrescreve o status real — não existe, em nenhum lugar do JSON, o registro de "esse era válido antes de virar duplicado". Migrar o tipo sem migrar os dados deixaria todo registro hoje duplicado com um valor que deixará de existir no novo schema.

**O que adianta:** é pré-requisito das demais etapas — sem ela, os dados de produção quebram silenciosamente assim que o tipo mudar.

**Correção de escopo registrada nesta sessão:** o ZIP entregue como "Etapa 0" continha apenas os arquivos da própria Etapa 0 (script de migração) e, por engano, os da Etapa 2 — sem seguir o modelo de mapeamento adotado desde a Demanda 5 (`EdicaoIndividualdeRegistro.md`), em que a Etapa 0 reúne, em um único ZIP, o conteúdo atual de **todos** os arquivos Fonte/Alterados/Criados das 15 etapas, para que os próximos envios só precisem trocar esse ZIP e nunca mais o projeto inteiro. O ZIP foi refeito para incluir também `types/email.ts`, `EmailStatus.ts`, `emails.tsx`, `EmailTable.tsx`, `EmailCounters.tsx`, `emailData.ts`, `EmailToolbar.tsx`, `ExportarModal.tsx`, `exportarPlanilha.ts`, `Icons.tsx`, `StatusUpdateConflict.tsx`, `DuplicadosConflitoModal.tsx`, `statsPreliminares.ts`, `EtapaRevisao.tsx`, `EtapaInformacoes.tsx` e `DEVME.md` — o "Arquivos Necessários" de cada etapa abaixo lista a partir de onde cada um entra.

### Etapa 1 — Modelo de dados (`types/email.ts` + `EmailStatus.ts`)

**Status: concluída.**

**O que fazer:**
- Remover `'duplicado'` de `TStatus` (passa a ter 4 valores) e de `STATUS_PRIORIDADE`.
- Extrair a lógica de agrupamento por e-mail (hoje presa dentro de `recalcularStatusAutomatico`) para uma função própria e exportada, ex. `calcularEmailsDuplicados(records): Set<string>`, reutilizável por qualquer parte do sistema.
- Ajustar `recalcularStatusAutomatico` para decidir apenas entre `válido`/`inválido` (a trava de `status_alterado` permanece idêntica).

**Por quê:** é a mudança de modelo em si. Feita isolada e primeiro, o próprio compilador TypeScript passa a listar, como erro de build, todo lugar que ainda trata `'duplicado'` como status — funcionando como checklist automático das etapas seguintes.

**Decisão registrada aqui:** duplicidade não vira um campo novo persistido no JSON — continua sendo sempre calculada em runtime, tanto pela interface quanto pelo `sync.ts`, do mesmo jeito que já acontece hoje.

### Etapa 2 — Script de sincronização (`sync.ts`)

**Status: concluída.**

**Arquivos Necessários — achado da Etapa 1, incorporado aqui:** `calcularMerge.ts` (a lógica de merge da Demanda 3, usada na reimportação de planilha) também produzia e comparava `'duplicado'` como status, propagando isso para `AtualizarDadosModal.tsx` e `AtualizarRegistrosModal.tsx`. Nenhum dos três estava na lista original desta demanda; tratados nesta etapa por decidirem status na sincronização/merge:
- `src/scripts/utils/calcularMerge.ts` — `recalcularStatusENotas` deixa de decidir `'duplicado'`, simplificada para só válido/inválido (mesma simplificação da Etapa 1).
- `src/components/atualizar/AtualizarDadosModal.tsx` e `AtualizarRegistrosModal.tsx` — a contagem "Duplicados" do resumo final passa a usar a flag calculada (`calcularEmailsDuplicados`, importada de `EmailStatus.ts`) em vez de `status === 'duplicado'`. A contagem de duplicados da planilha reimportada em si (`estatisticasPlanilha`, no resumo inicial) já não dependia de `TStatus` e não precisou de alteração.

**O que fazer:** `applyStatusRules` deixa de atribuir `'duplicado'`; o resumo final impresso no terminal (contagem de duplicados) passa a usar `calcularEmailsDuplicados` em vez de filtrar por `status === 'duplicado'`.

**Por quê:** este é o segundo lugar do sistema (junto com `EmailStatus.ts`) que implementa a mesma regra de negócio — mantê-los sincronizados é o que a própria documentação do código já pede.

### Etapa 3 — Estado derivado central (`emails.tsx`)

**Status: concluída.**

**Arquivos Necessários:**
- Alterado: `src/pages/emails.tsx`, `src/components/EmailTable.tsx`

**Correção de escopo registrada nesta execução:** a redação original ("repassar como propriedade para quem precisar: tabela, contadores, filtros, exportação") sugeria as 4 telas por igual, mas só `EmailTable.tsx` recebe `emailsDuplicados` como propriedade própria — e mesmo assim sem lê-lo ainda (só passa a fazer isso na Etapa 7, ao renderizar o ícone de alerta). Os outros três não precisam desse formato:
- **Contadores/filtros** (`EmailCounters.tsx`/`EmailToolbar.tsx`, Etapas 4/5): já recebem um `EmailCounters`/`Set<TStatus>` prontos, calculados em `emails.tsx` — quem vai receber `emailsDuplicados` diretamente é a função `calcularContadores` (`emailData.ts`), chamada de dentro do próprio `useMemo` de `contadores` em `emails.tsx`, não os componentes de exibição.
- **Exportação** (`ExportarModal.tsx`, Etapa 11): é usado tanto a partir desta página (projeto único, via `Header`) quanto de `pages/home.tsx` (múltiplos projetos ao mesmo tempo) — o `Set` calculado aqui não serve para o segundo caso. Etapa 11 calcula `emailsDuplicados` por planilha, dentro do próprio fluxo de exportação, em vez de receber um `Set` já pronto desta página.

**O que fazer:** calcular `emailsDuplicados` uma única vez, no componente de página (via `useMemo`), e repassar como propriedade para quem precisar (tabela, contadores, filtros, exportação) — em vez de cada consumidor recalcular por conta própria.

**Por quê:** evita que a limpeza feita nas etapas 1 e 2 seja anulada por uma nova duplicação de lógica, agora espalhada pela interface.

### Etapa 4 — Contadores (`EmailCounters.tsx`, `emailData.ts`)

**Status: concluída.**

**Arquivos Necessários:**
- Alterado: `src/components/EmailCounters.tsx`, `src/components/utils/emailData.ts`

**O que fazer:** `calcularContadores` passa a receber `emailsDuplicados` e contar "Duplicados" como o número de registros ativos (não deletados) cujo e-mail aparece mais de uma vez — independente do status real de cada um.

**O que melhora:** hoje o contador de duplicados subestima o total sempre que há registros manuais duplicados; a partir desta etapa ele passa a bater exatamente com o que a tabela exibe.

**Correção de escopo registrada nesta execução:**
- `calcularContadores(registros, emailsDuplicados)` — segundo parâmetro obrigatório. Continua incrementando os 4 contadores de status normalmente a partir de `registro.status`; `duplicado` agora é somado à parte, contando todo registro não-`deletado` cujo e-mail normalizado (`normalizeEmail`) está em `emailsDuplicados`.
- `calcularContadoresPorPlanilha` (não listado no texto original desta etapa, mas quebraria de compilar com a mudança de assinatura acima): cada planilha agora calcula seu próprio `Set` via `calcularEmailsDuplicados(registros)` antes de chamar `calcularContadores` — duplicidade nunca é calculada *entre* planilhas diferentes, só dentro de cada uma. Necessário porque `ExportarModal` (que consome esta função) também é usado com múltiplas planilhas ao mesmo tempo (seleção da Home), sem um `emailsDuplicados` único aplicável a todas.
- `src/pages/emails.tsx` (também não listado, pelo mesmo motivo): o único call site de `calcularContadores` fora de `emailData.ts` — passou a repassar o `emailsDuplicados` já calculado na Etapa 3 (`useMemo`), que precisou ser reordenado para ser computado antes do `useMemo` de `contadores`, já que este agora depende daquele.
- `EmailCounters.tsx` não precisou de nenhuma alteração de código: já lia `contadores[key]` genericamente, sem conhecer a regra de cálculo por trás de cada contador — só recebeu um comentário documentando a mudança de significado do card "Duplicados". O comportamento de switch de filtro do mesmo card (`onAlternarFiltro('duplicado')`) continua baseado em `status === 'duplicado'` dentro do `Set` de filtro (`TODOS_OS_STATUS` ainda lista `'duplicado'` como se fosse um `TStatus` válido, o que hoje é um erro de tipo pré-existente) — fica para a Etapa 5, que é quem trata filtros.

### Etapa 5 — Filtros (`emailData.ts`, `EmailToolbar.tsx`) — checkpoint de produto

**Status: concluída.**

**Arquivos Necessários:**
- Alterado: `src/components/utils/emailData.ts` (já incluso na Etapa 4), `src/components/EmailToolbar.tsx`

**O que fazer:** o filtro "Duplicados" passa a filtrar pela flag em vez de pelo status. Como os filtros de status são switches independentes (união), marcar "Válidos" + "Duplicados" passará a mostrar todo registro que seja válido **ou** duplicado — incluindo os que forem os dois ao mesmo tempo.

**Por quê é um checkpoint:** é a primeira mudança que altera o que o usuário vê ao combinar filtros — antes um registro só podia satisfazer um filtro de status por vez; agora pode satisfazer dois simultaneamente.

**Correção de escopo registrada nesta execução:** `EmailToolbar.tsx` não tem, hoje, nenhuma lógica de filtro por status — essa responsabilidade migrou para `EmailCounters.tsx` num refactor anterior (cada card de contador é o próprio switch de filtro; ver comentário em `EmailToolbar.tsx`, "Os filtros por status saíram daqui... e foram fundidos com os contadores"). O texto original desta etapa ainda cita o arquivo antigo. Nenhuma alteração foi feita em `EmailToolbar.tsx`; os arquivos realmente tocados foram:
- `src/components/utils/emailData.ts`: `TODOS_OS_STATUS` não lista mais `'duplicado'` (agora só os 4 `TStatus` reais — resolve a inconsistência de tipo já sinalizada como pendente na Etapa 4); `filtrarPorStatusMultiplo` ganhou um terceiro parâmetro (`{ ativo, emailsDuplicados }`) e passa a incluir, por união, todo registro não-deletado cujo e-mail esteja duplicado, independente do status; `processarRegistros` repassa esse novo parâmetro.
- `src/components/EmailCounters.tsx`: nova prop `duplicadosFiltroAtivo` — o switch do card "Duplicados" (e o cálculo de "Total marcado") passa a ler esse booleano em vez de `statusFiltrados.has('duplicado')`.
- `src/pages/emails.tsx` (não listado no texto original, mas é onde o estado dos filtros de fato vive): novo estado `duplicadosFiltroAtivo` (inicia `true`, junto com os 4 status, reproduzindo o "tudo marcado" de antes); `alternarFiltro` reescrita — `'duplicado'` agora alterna esse booleano em vez de entrar/sair do `Set` de status, e `'todos'` passa a marcar/desmarcar os 4 status **e** esse booleano juntos; `processarRegistros` e `rotulosStatusFiltrados` (mensagem de "sem resultados") atualizados para considerar o novo estado.

**Pendência conhecida, não é desta etapa:** `EmailTable.tsx`/`emails.tsx` ainda comparam `registro.status === 'duplicado'` em alguns handlers de edição (`handleAtualizarStatus`, `handleAtualizarStatusIndividual` e afins) — comparação hoje inválida (`'duplicado'` não é mais um `TStatus`), corrigida na Etapa 8. `STATUS_ORDEM_EXIBICAO` (`emailData.ts`) também continua listando `'duplicado'` — corrigida na Etapa 6.

### Etapa 6 — Ordenação por status (`STATUS_ORDEM_EXIBICAO`)

**Status: concluída.**

**Arquivos Necessários:**
- Alterado: `src/components/utils/emailData.ts` (já incluso na Etapa 4 — `STATUS_ORDEM_EXIBICAO` está neste arquivo, não em `EmailStatus.ts`)

**O que fazer:** remover `'duplicado'` da lista de ordenação por status (sobram 4 posições). Registros duplicados passam a aparecer intercalados dentro da ordem do seu status real.

**Por quê:** consequência direta da etapa 1; sem ajuste, a ordenação por "Status" ficaria referenciando um valor que não existe mais.

**Execução:** mudança direta, sem correção de escopo — `STATUS_ORDEM_EXIBICAO` só é lida em um único lugar (`compararPorCriterio`, no próprio `emailData.ts`), que já usa `indexOf` sobre a lista sem nenhuma outra referência a `'duplicado'`.

### Etapa 7 — Tabela principal (`EmailTable.tsx`)

**Status: concluída.**

**Arquivos Necessários:**
- Alterado: `src/components/EmailTable.tsx` (já incluso na Etapa 3)
- Fonte: `src/components/Icons.tsx` (`IconeAlerta`, reaproveitado sem alteração)

**O que fazer:** remover o caso especial `status === 'duplicado'` de `renderStatus` — deixa de existir um badge "duplicado". Todo registro passa a exibir só seu status real: badge fixo para `deletado`, select para `válido`/`inválido`/`enviado` (comportamento inalterado desses três). Ao lado do badge/select, renderizar condicionalmente o `IconeAlerta` sempre que o e-mail do registro estiver no `Set` calculado na etapa 3, com tooltip e `onClick` que abre o modal de conflito (`onClicarDuplicado`). Aplica a todos os status ativos, inclusive `enviado`; `deletado` nunca recebe o ícone.

**Por quê:** esta é a etapa que resolve, na prática, o problema relatado na seção 2 — o dado fica consistente na origem, em vez de depender de um workaround visual.

**Execução:**
- `renderStatus` perdeu o ramo `status === 'duplicado'` (o badge/botão "duplicado" que existia não existe mais); os dois casos restantes (`deletado` fixo, `válido`/`inválido`/`enviado` como select) ficaram inalterados.
- Nova função `renderIconeDuplicado(registro)`, chamada ao lado de `renderStatus` na mesma célula (`<td className="td-status">`): retorna `null` para `deletado` ou para registros fora de `emailsDuplicados`; caso contrário, um `<button>` (ou `<span>` sem `onClicarDuplicado`) com `title="Este registro está duplicado"` e `onClick` abrindo o modal. É o único elemento clicável da célula para esse fim.
- `emailsDuplicados` — prop já existia na interface desde a Etapa 3 e já era passada por `emails.tsx`, mas nunca tinha sido de fato desestruturada/usada dentro do componente (a própria Etapa 3 já registrava essa pendência). Passou a ser desestruturada dos props e consumida por `renderIconeDuplicado` via `normalizeEmail` (importado de `EmailStatus.ts`, mesmo módulo de `isValidEmail`).
- `Icons.tsx` não foi alterado, conforme o texto desta etapa — só importei `IconeAlerta` em `EmailTable.tsx`. Como o componente não aceita um `size` próprio (fixo em 20px), a redução para 14-16px sugerida pelo texto original só pode ser feita via CSS, na nova classe `icone-alerta-duplicado` — regra ainda não incluída neste pacote, porque o CSS real do projeto não faz parte dos uploads enviados (mesma pendência já registrada em `EdicaoIndividualdeRegistro.md` para `.botao-restaurar-linha-invisivel`).
- Comentários de `renderStatus`/props que citavam "duplicado" como um dos casos possíveis foram atualizados nesta etapa; os que citam "duplicado" no contexto dos handlers de atualização em massa/individual (`onAtualizarStatusIndividual`/`onAtualizarStatusEmMassa`) foram deixados como estavam — são a checagem de comportamento real, tratada na Etapa 8, não uma questão de renderização.

### Etapa 8 — Handlers de edição manual (`emails.tsx`) — checkpoint de produto

**Status: concluída.**

**Arquivos Necessários:**
- Alterado: `src/pages/emails.tsx` (já incluso na Etapa 3)

**O que fazer:** remover, de `handleAtualizarStatus` e `handleAtualizarStatusIndividual`, a checagem que hoje bloqueia edição de registros com `status === 'duplicado'`. Como duplicidade deixa de ser status, um registro duplicado passa a poder ser editado normalmente para válido/inválido/enviado — o ícone de alerta continua sendo recalculado de forma independente da escolha manual.

**Por quê é um checkpoint:** muda uma restrição que hoje existe na interface (campos de status travados para duplicados) — precisa de validação explícita de que esse é o comportamento desejado.

**Execução:**
- `handleAtualizarStatus`: removida a condição `&& registro.status !== 'duplicado'` do `.map` — agora todo registro selecionado é atualizado, esteja ele duplicado ou não (a única exclusão possível continua sendo por não estar selecionado).
- `handleAtualizarStatusIndividual`: removida a cláusula `registroAlvo.status === 'duplicado' ||` da guarda inicial — só `status === 'deletado'` continua bloqueando o handler (mantida como salvaguarda, já que a tabela não renderiza o select para registros deletados).
- Comentários de ambas as funções, e do `handleConfirmarEnvioClick` (que reaproveita `handleAtualizarStatus`), atualizados para não descreverem mais "duplicado" como um destino bloqueado — conforme registrado como pendência na Etapa 7.
- `deletarRegistros` (fluxo de exclusão lógica) não foi tocada: seu comentário sobre grupos de duplicados que "sobram com 1 registro" descreve uma mecânica anterior a esta demanda (recálculo de válido/inválido após deleção) e está fora do escopo desta etapa — os handlers de edição manual, não o de exclusão.

### Etapa 9 — Remoção de código morto (`StatusUpdateConflict.tsx`)

**Status: concluída.**

**Arquivos Necessários:**
- Removido: `src/components/StatusUpdateConflict.tsx`

**O que fazer:** remover este componente. Ele foi criado para tratar um conflito ("tentei editar manualmente um registro duplicado") que nunca chegou a ser conectado a nenhum fluxo real, e que deixa de existir com a etapa 8.

**Por quê:** menos código não utilizado para manter e para confundir o próximo desenvolvedor.

**Execução:** confirmado, antes de remover, que nenhum outro arquivo do projeto importa `StatusUpdateConflict` (as únicas ocorrências do nome eram dentro do próprio arquivo — a assinatura da função e o exemplo de uso comentado no JSDoc, nunca um `import` real em `emails.tsx` ou em qualquer outro componente). Arquivo excluído sem necessidade de tocar em mais nada.

### Etapa 10 — Revisão de `DuplicadosModal.tsx` / `DuplicadosConflitoModal.tsx`

**Status: concluída (só conferência, sem alteração de código).**

**Arquivos Necessários:**
- Fonte: `src/components/DuplicadosConflitoModal.tsx` (único dos dois nomes que existe hoje no projeto — o texto original desta etapa cita `DuplicadosModal.tsx` também, mas não há esse arquivo em `src/`)

**O que fazer:** conferir que nenhuma lógica desses componentes dependia implicitamente do valor `'duplicado'` existir como status (eles já filtram por `enviado`/`deletado`, então a expectativa é de que quase nada mude).

**Por quê:** etapa de baixo risco, mas necessária para fechar a cobertura antes de considerar a refatoração completa.

**Execução:**
- `particionarGrupoDuplicados` filtra o grupo por `status === 'enviado'` e `status !== 'enviado' && status !== 'deletado'` — nenhuma das duas comparações usa `'duplicado'`. Como confirmado, hipótese da etapa se confirmou: nada a alterar.
- O grupo em si (prop `registros`) é montado em `emails.tsx` (`handleClicarDuplicado`) filtrando por `normalizeEmail(r.email) === emailNormalizado` sobre todos os registros — nunca por `status === 'duplicado'`. Ou seja, mesmo antes desta etapa, a formação do grupo já independia do status; é coerente com a flag calculada da Etapa 1/3, e não precisou de nenhum ajuste retroativo.
- Nenhuma outra ocorrência de `'duplicado'` no arquivo é uma comparação de status — são todas texto de UI (título do modal, nome de classe CSS, comentários descrevendo o conceito de "grupo de duplicados").
- `DeleteConflictContent.tsx`/`ConflictDialog.tsx` (componentes reutilizados por este modal) não fazem parte deste pacote de arquivos e não foram alterados nesta etapa — não há indício, na leitura de `DuplicadosConflitoModal.tsx`, de que dependam de `'duplicado'` como status; ambos só recebem listas já particionadas via props.

### Etapa 11 — Exportação (`ExportarModal.tsx`, `exportarPlanilha.ts`)

**Status: concluída.**

**Arquivos Necessários:**
- Alterado: `src/components/ExportarModal.tsx` (já incluso na Etapa 3)
- Fonte (conferência, sem alteração): `src/components/utils/exportarPlanilha.ts`

**O que fazer:** o checkbox "Duplicados" da exportação passa a filtrar pela flag em vez de pelo status. Como agora um registro pode satisfazer dois checkboxes ao mesmo tempo (ex.: "Válidos" + "Duplicados"), a exportação passa a precisar de deduplicação para não exportar o mesmo registro duas vezes.

**Por quê:** mesma decisão de UX da etapa 5, agora aplicada ao arquivo exportado.

**Execução:**
- `ExportarModal.tsx`: `STATUS_EXPORTAVEIS` (`{ value: TStatus; label }[]`, com `'duplicado'` entre os valores) deixou de compilar depois da Etapa 1 — substituído por `STATUS_VALORES` (só os 4 `TStatus` reais, usado por `todosMarcados`/`alternarTodos`) e `ITENS_EXPORTAVEIS` (`{ chave: TStatus | 'duplicado'; label }[]`, a lista completa exibida no modal, na mesma ordem de antes).
- Novo estado `duplicadosSelecionado` (`useState(false)`), independente do `Set<TStatus>` — mesmo padrão de `duplicadosFiltroAtivo` em `emails.tsx` (Etapa 5). O checkbox "Duplicados" lê/escreve nele via `alternarDuplicados`, em vez de `statusSelecionados.has('duplicado')` (que nunca mais seria `true`).
- `todosMarcados`/`alternarTodos` passam a considerar os 4 status **e** `duplicadosSelecionado` juntos, mesmo critério de "tudo marcado" já usado em `EmailCounters.tsx`.
- **Deduplicação:** `planilhasFiltradas` deixou de filtrar só por `statusSelecionados.has(registro.status)` e passou a reaproveitar `filtrarPorStatusMultiplo` (`emailData.ts`, já usada pela tabela principal desde a Etapa 5) — um único `.filter` por união (status selecionado OU duplicado com o switch ativo). Por ser uma única passagem por `.filter`, cada registro só pode aparecer uma vez no array de saída mesmo quando satisfaz os dois critérios ao mesmo tempo; não há um passo de deduplicação à parte porque a fonte do problema (dois filtros somados/concatenados) nunca chega a existir na implementação. `emailsDuplicados` é recalculado por planilha (`calcularEmailsDuplicados`), nunca entre planilhas diferentes — mesma decisão já registrada para `calcularContadoresPorPlanilha` na Etapa 4.
- `exportarPlanilha.ts`: conferido, sem alterações — o módulo só serializa/baixa os registros que já chegam filtrados de `ExportarModal.tsx` (`registro.status`, usado como texto de uma coluna do arquivo exportado, continua sendo lido normalmente; nenhuma comparação com `'duplicado'` existia aqui antes desta demanda).

### Etapa 12 — Conferência do assistente de importação

**Status: concluída (só conferência, sem alteração de código).**

**Arquivos Necessários:**
- Fonte (só conferência, sem alteração esperada): `src/components/import/utils/statsPreliminares.ts`, `src/components/import/EtapaRevisao.tsx`, `src/components/import/EtapaInformacoes.tsx`

**O que fazer:** verificar `statsPreliminares.ts`, `EtapaRevisao.tsx` e `EtapaInformacoes.tsx`. Esses arquivos calculam duplicados a partir da planilha sendo importada (antes de qualquer gravação), sem depender do tipo `TStatus` — a expectativa é de que não precisem de alteração. Esta etapa é só de confirmação.

**Execução:**
- `statsPreliminares.ts` (`calcularEstatisticasPreliminares`): calcula `duplicados` percorrendo as linhas cruas da planilha (`LinhaPlanilha`) e testando todas as colunas com `isValidEmail`/`normalizeEmail` — nenhuma referência a `TStatus`, `EmailRecord` ou `'duplicado'` como valor de status. É uma contagem sobre a planilha, feita antes de qualquer `EmailRecord` existir.
- `EtapaRevisao.tsx` e `EtapaInformacoes.tsx`: ambos só exibem `estatisticas.duplicados` (tipo `EstatisticasPreliminares`, vindo de `statsPreliminares.ts`) num `<dd>` — nenhum dos dois importa `TStatus`/`EmailRecord`, confirmado pela lista de imports de cada arquivo.
- Hipótese da etapa confirmada: nenhum dos três arquivos precisou de alteração.

### Etapa 13 — QA do cenário original e regressão

**O que fazer:** reproduzir o cenário completo descrito na seção 2.1 (3 registros → deletar 2 → restaurar 1 → marcar o outro como inválido manualmente) e confirmar que ambos aparecem com o ícone de alerta ao mesmo tempo, cada um com seu status real e editável. Rodar `npm run sync -- data/planilha.csv --slug=<projeto-de-teste>` e conferir que o JSON gerado (`data/active/<projeto-de-teste>/emails.json`) não contém mais `'duplicado'` como valor de `status`.

### Etapa 14 — Atualização da especificação (`DEVME.md`)

**Status: concluída.**

**Arquivos Necessários:**
- Alterado: `DEVME.md`

**O que fazer:** reescrever as seções que descrevem `duplicado` como um dos 5 status com prioridade, refletindo o novo modelo.

**Por quê:** dezenas de comentários no código citam essa especificação como fonte da verdade; se ela ficar desatualizada, o próximo desenvolvedor (ou você mesmo, meses depois) pode reintroduzir o problema original por confiar no documento antigo.

**Execução:** seguindo o padrão já usado no resto do `DEVME.md` (texto original da v3 preservado, com blocos `> **Atualização:**` documentando onde o comportamento real diverge — em vez de reescrever o texto original por cima), adicionadas atualizações em:
- Seção 3, fluxo de sincronização: nota de que "Identificar duplicados" e "Aplicar prioridades" deixaram de ser o mesmo passo.
- 5.1 (Validação/"Status inicial"): classificação automática pós-importação passa a ser só válido/inválido.
- 5.2 (Status/Prioridade): lista e prioridade passam a ter só os 4 status reais.
- 5.4 (Duplicados): reescrita mais extensa — o antigo aviso "⚠️ Inconsistência conhecida... ainda não implementada" virou "histórico — corrigida na Demanda 10", seguido de um bloco explicando o modelo atual (flag calculada, `calcularEmailsDuplicados`, ícone de alerta, coexistência com qualquer status real, `deletado` fora da combinação).
- 5.5 (Contadores): nota de que "Duplicados" é a exceção à regra "todo contador respeita o status efetivo" — conta por flag, não por status, podendo somar com outro contador para o mesmo registro.
- Seção 7 ("Atualizar Status"): a frase original sobre não poder alterar manualmente para `duplicado` continua tecnicamente verdadeira (nunca foi um destino manual), mas a atualização esclarece que a restrição real que existia — bloquear edição de registros duplicados — foi removida na Etapa 8.
- Nenhum texto da seção 8 (histórico das etapas 1-6 da fase local, v3) foi alterado — o próprio `DEVME.md` já registra que aquela seção é histórico, não descrição do comportamento atual.

## 4. Critérios de avaliação da refatoração

A refatoração será considerada **aprovada** quando todos os itens abaixo forem verdadeiros.

### 4.1 O que deve ser entregue

- Código-fonte com as 15 etapas implementadas, sem a checagem `status === 'duplicado'` remanescente em nenhum arquivo de `src/` (busca por `'duplicado'` deve retornar apenas: rótulos de UI, nomes de componentes/CSS relacionados ao modal de conflito, e comentários/documentação — nunca uma comparação de status).
- Todo `data/active/<slug>/emails.json` migrado (etapa 0 aplicada), sem nenhum registro com `status: "duplicado"`, em nenhum projeto.
- `DEVME.md` atualizado, sem contradizer o comportamento do código.
- Um resumo curto (pode ser no corpo do PR ou commit) listando quais das 15 etapas foram concluídas.

### 4.2 O que o sistema deve fazer para ser aprovado

- **Build limpo:** `npm run build` (que roda `tsc -b` antes do Vite) completa sem erros de tipo.
- **Lint limpo:** `npm run lint` não aponta erros novos introduzidos pela refatoração.
- **Cenário original resolvido:** reproduzindo os passos da seção 2.1, os dois registros com o mesmo e-mail (um "inválido" manual, um restaurado) aparecem **ambos** com o ícone de alerta, e ambos continuam com seu status real (não "inválido" travado ao lado de "duplicado" incoerente).
- **Nenhuma regressão nos fluxos que não mudaram de propósito:**
  - restrição de deletar registros "enviado" continua exigindo o modal de conflito;
  - restaurar continua zerando `status_alterado`/`backup_dados` e recalculando válido/inválido corretamente;
  - seleção continua impedindo misturar registros deletados com não deletados;
  - exportação continua gerando arquivo sem registros duplicados na saída (mesmo com checkboxes sobrepostos marcados).
- **Contadores e filtros consistentes entre si:** o número mostrado no card "Duplicados" bate com a quantidade de registros que exibem o ícone de alerta na tabela, e o filtro "Duplicados" traz exatamente esses mesmos registros.
- **`npm run sync` gerando um JSON válido**, sem `'duplicado'` como status, com os contadores impressos no terminal batendo com o conteúdo do arquivo gerado.

## 5. Como testar e validar manualmente

Passo a passo para você validar o resultado por conta própria, sem depender de leitura de código.

### 5.1 Preparar o ambiente

```bash
npm install
npm run dev
```

Abra o endereço local mostrado no terminal (por padrão, algo como `http://localhost:5173`).

### 5.2 Teste 1 — o cenário original (o mais importante)

1. Localize (ou crie, via importação) 3 registros com o mesmo e-mail.
2. Selecione 2 deles e clique em "Deletar". O terceiro deve virar `válido` (ou `inválido`, dependendo do e-mail) automaticamente, sem ícone de alerta.
3. Ainda no terceiro registro, use o select de status na tabela e mude manualmente para `inválido`.
4. Selecione um dos dois registros deletados e clique em "Restaurar".
5. **Verifique:** os dois registros ativos (o que ficou `inválido` manualmente e o que voltou da exclusão) devem mostrar, cada um, seu status real **junto com** o ícone de alerta ao lado — os dois com tooltip "Este registro está duplicado" ao passar o mouse, os dois abrindo o mesmo modal de conflito ao clicar no ícone.
6. Isso é o sinal de que o problema relatado no início desta demanda foi resolvido.

### 5.3 Teste 2 — edição manual de um registro duplicado

1. Com o grupo de duplicados do teste 1 ainda visível, tente mudar o status de um deles direto pelo select da tabela (ex.: de `inválido` para `válido`).
2. **Verifique:** a mudança deve ser aceita normalmente, e o ícone de alerta deve continuar aparecendo — a edição do status não deve fazer o ícone sumir nem travar o select.

### 5.4 Teste 3 — contadores e filtros

1. Anote o número mostrado no card "Duplicados" no topo da página.
2. Conte manualmente, na tabela (com o filtro "Todos" ativo), quantos registros exibem o ícone de alerta.
3. **Verifique:** os dois números devem ser iguais.
4. Marque apenas o filtro "Duplicados" na barra de filtros.
5. **Verifique:** devem aparecer exatamente os registros com o badge, independentemente de estarem `válido`, `inválido` ou `enviado`.
6. Marque também o filtro "Válidos" junto com "Duplicados".
7. **Verifique:** a lista deve mostrar a união dos dois grupos (válidos + duplicados), sem registros repetidos.

### 5.5 Teste 4 — exportação

1. Abra o modal de exportação (menu de configurações → "Exportar planilha").
2. Marque "Válidos" e "Duplicados" ao mesmo tempo (garantindo que existam registros que sejam os dois simultaneamente).
3. Exporte em CSV e abra o arquivo gerado.
4. **Verifique:** nenhum registro deve aparecer duplicado dentro do arquivo exportado, mesmo estando marcado em dois checkboxes.

### 5.6 Teste 5 — sincronização via terminal

1. Rode:
   ```bash
   npm run sync -- data/tabela_exemplo.csv --slug=<projeto-de-teste>
   ```
   (ou outra planilha de teste disponível em `data/`, com um `--slug` de um projeto de teste à sua escolha).
2. **Verifique no terminal:** o resumo final não deve travar nem gerar erro, e o número de "duplicado" impresso deve bater com o que você confere depois na interface.
3. Abra `data/active/<projeto-de-teste>/emails.json` num editor de texto e confirme que nenhum registro tem `"status": "duplicado"`.

### 5.7 Teste 6 — build e checagem de tipos

```bash
npm run build
npm run lint
```

**Verifique:** ambos os comandos devem terminar sem erros. Isso confirma que a refatoração não deixou nenhuma referência solta ao antigo status `'duplicado'`.

Se todos os testes acima passarem, a refatoração pode ser considerada validada e pronta para uso.