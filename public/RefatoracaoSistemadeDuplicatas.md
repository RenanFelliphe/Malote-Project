# Refatoração do Sistema de Duplicatas

## 1. Contexto do projeto

O **Sistema de Organização e Envio de E-mails** é uma aplicação React/TypeScript que permite importar planilhas de contatos, validar e-mails, identificar duplicatas, marcar registros como enviados/deletados manualmente e exportar o resultado. Os dados vivem em `data/emails.json`, que é a fonte oficial e é atualizado de duas formas:

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
- Duplicidade passa a ser um dado derivado (`Set` de e-mails normalizados que aparecem mais de uma vez entre registros ativos), calculado em runtime — nunca persistido como campo novo no JSON — e usado para exibir um indicador visual (badge "⚠ duplicado") em qualquer registro, independente do seu status.
- Um registro pode agora ser `válido` **e** duplicado, `inválido` **e** duplicado, ou `enviado` **e** duplicado, simultaneamente. `deletado` fica de fora dessa combinação: um registro deletado já é ignorado no cálculo do grupo de duplicados e não tem ação além de "Restaurar", então o indicador não se aplica a ele.
- A trava de `status_alterado` **não muda** — continua garantindo que nenhum status definido manualmente seja sobrescrito sozinho. O que muda é que essa trava deixa de decidir também se o registro "pode ser visto como duplicado".

## 3. Divisão em etapas

A refatoração está dividida em 15 etapas, pensadas para serem executadas nesta ordem. As etapas 0 a 3 são estritamente sequenciais (cada uma depende da anterior); a partir da etapa 4, várias podem ser feitas em qualquer ordem entre si. As etapas 5 e 8 são pontos de checkpoint: mudam algo perceptível para quem usa o sistema, não só a estrutura interna do código.

### Etapa 0 — Migração dos dados existentes

**O que fazer:** escrever e rodar um script único que percorre `data/emails.json` e, para todo registro com `status === 'duplicado'`, recalcula qual seria o status real dele (`válido` ou `inválido`, via `isValidEmail`) e regrava esse valor no campo `status`.

**Por quê:** hoje `status: 'duplicado'` sobrescreve o status real — não existe, em nenhum lugar do JSON, o registro de "esse era válido antes de virar duplicado". Migrar o tipo sem migrar os dados deixaria todo registro hoje duplicado com um valor que deixará de existir no novo schema.

**O que adianta:** é pré-requisito das demais etapas — sem ela, os dados de produção quebram silenciosamente assim que o tipo mudar.

### Etapa 1 — Modelo de dados (`types/email.ts` + `EmailStatus.ts`)

**O que fazer:**
- Remover `'duplicado'` de `TStatus` (passa a ter 4 valores) e de `STATUS_PRIORIDADE`.
- Extrair a lógica de agrupamento por e-mail (hoje presa dentro de `recalcularStatusAutomatico`) para uma função própria e exportada, ex. `calcularEmailsDuplicados(records): Set<string>`, reutilizável por qualquer parte do sistema.
- Ajustar `recalcularStatusAutomatico` para decidir apenas entre `válido`/`inválido` (a trava de `status_alterado` permanece idêntica).

**Por quê:** é a mudança de modelo em si. Feita isolada e primeiro, o próprio compilador TypeScript passa a listar, como erro de build, todo lugar que ainda trata `'duplicado'` como status — funcionando como checklist automático das etapas seguintes.

**Decisão registrada aqui:** duplicidade não vira um campo novo persistido no JSON — continua sendo sempre calculada em runtime, tanto pela interface quanto pelo `sync.ts`, do mesmo jeito que já acontece hoje.

### Etapa 2 — Script de sincronização (`sync.ts`)

**O que fazer:** `applyStatusRules` deixa de atribuir `'duplicado'`; o resumo final impresso no terminal (contagem de duplicados) passa a usar `calcularEmailsDuplicados` em vez de filtrar por `status === 'duplicado'`.

**Por quê:** este é o segundo lugar do sistema (junto com `EmailStatus.ts`) que implementa a mesma regra de negócio — mantê-los sincronizados é o que a própria documentação do código já pede.

### Etapa 3 — Estado derivado central (`emails.tsx`)

**O que fazer:** calcular `emailsDuplicados` uma única vez, no componente de página (via `useMemo`), e repassar como propriedade para quem precisar (tabela, contadores, filtros, exportação) — em vez de cada consumidor recalcular por conta própria.

**Por quê:** evita que a limpeza feita nas etapas 1 e 2 seja anulada por uma nova duplicação de lógica, agora espalhada pela interface.

### Etapa 4 — Contadores (`EmailCounters.tsx`, `emailData.ts`)

**O que fazer:** `calcularContadores` passa a receber `emailsDuplicados` e contar "Duplicados" como o número de registros ativos (não deletados) cujo e-mail aparece mais de uma vez — independente do status real de cada um.

**O que melhora:** hoje o contador de duplicados subestima o total sempre que há registros manuais duplicados; a partir desta etapa ele passa a bater exatamente com o que a tabela exibe.

### Etapa 5 — Filtros (`emailData.ts`, `EmailToolbar.tsx`) — checkpoint de produto

**O que fazer:** o filtro "Duplicados" passa a filtrar pela flag em vez de pelo status. Como os filtros de status são switches independentes (união), marcar "Válidos" + "Duplicados" passará a mostrar todo registro que seja válido **ou** duplicado — incluindo os que forem os dois ao mesmo tempo.

**Por quê é um checkpoint:** é a primeira mudança que altera o que o usuário vê ao combinar filtros — antes um registro só podia satisfazer um filtro de status por vez; agora pode satisfazer dois simultaneamente.

### Etapa 6 — Ordenação por status (`STATUS_ORDEM_EXIBICAO`)

**O que fazer:** remover `'duplicado'` da lista de ordenação por status (sobram 4 posições). Registros duplicados passam a aparecer intercalados dentro da ordem do seu status real.

**Por quê:** consequência direta da etapa 1; sem ajuste, a ordenação por "Status" ficaria referenciando um valor que não existe mais.

### Etapa 7 — Tabela principal (`EmailTable.tsx`)

**O que fazer:** remover o caso especial `status === 'duplicado'` de `renderStatus`. Todo registro passa a exibir seu status real (badge fixo para `deletado`, select para `válido`/`inválido`/`enviado`) e, ao lado, um badge "⚠ duplicado" clicável sempre que o e-mail dele estiver no `Set` calculado na etapa 3 — reaproveitando o mesmo modal de conflito que já existe hoje.

**Por quê:** esta é a etapa que resolve, na prática, o problema relatado na seção 2 — o dado fica consistente na origem, em vez de depender de um workaround visual.

### Etapa 8 — Handlers de edição manual (`emails.tsx`) — checkpoint de produto

**O que fazer:** remover, de `handleAtualizarStatus` e `handleAtualizarStatusIndividual`, a checagem que hoje bloqueia edição de registros com `status === 'duplicado'`. Como duplicidade deixa de ser status, um registro duplicado passa a poder ser editado normalmente para válido/inválido/enviado — a flag de duplicidade continua sendo recalculada de forma independente da escolha manual.

**Por quê é um checkpoint:** muda uma restrição que hoje existe na interface (campos de status travados para duplicados) — precisa de validação explícita de que esse é o comportamento desejado.

### Etapa 9 — Remoção de código morto (`StatusUpdateConflict.tsx`)

**O que fazer:** remover este componente. Ele foi criado para tratar um conflito ("tentei editar manualmente um registro duplicado") que nunca chegou a ser conectado a nenhum fluxo real, e que deixa de existir com a etapa 8.

**Por quê:** menos código não utilizado para manter e para confundir o próximo desenvolvedor.

### Etapa 10 — Revisão de `DuplicadosModal.tsx` / `DuplicadosConflitoModal.tsx`

**O que fazer:** conferir que nenhuma lógica desses componentes dependia implicitamente do valor `'duplicado'` existir como status (eles já filtram por `enviado`/`deletado`, então a expectativa é de que quase nada mude).

**Por quê:** etapa de baixo risco, mas necessária para fechar a cobertura antes de considerar a refatoração completa.

### Etapa 11 — Exportação (`ExportarModal.tsx`, `exportarPlanilha.ts`)

**O que fazer:** o checkbox "Duplicados" da exportação passa a filtrar pela flag em vez de pelo status. Como agora um registro pode satisfazer dois checkboxes ao mesmo tempo (ex.: "Válidos" + "Duplicados"), a exportação passa a precisar de deduplicação para não exportar o mesmo registro duas vezes.

**Por quê:** mesma decisão de UX da etapa 5, agora aplicada ao arquivo exportado.

### Etapa 12 — Conferência do assistente de importação

**O que fazer:** verificar `statsPreliminares.ts`, `EtapaRevisao.tsx` e `EtapaInformacoes.tsx`. Esses arquivos calculam duplicados a partir da planilha sendo importada (antes de qualquer gravação), sem depender do tipo `TStatus` — a expectativa é de que não precisem de alteração. Esta etapa é só de confirmação.

### Etapa 13 — QA do cenário original e regressão

**O que fazer:** reproduzir o cenário completo descrito na seção 2.1 (3 registros → deletar 2 → restaurar 1 → marcar o outro como inválido manualmente) e confirmar que ambos aparecem com o badge de duplicado ao mesmo tempo, cada um com seu status real e editável. Rodar `npm run sync` sobre uma planilha de teste e conferir que o JSON gerado não contém mais `'duplicado'` como valor de `status`.

### Etapa 14 — Atualização da especificação (`Especificacao_Sistema_Emails_v3.md`)

**O que fazer:** reescrever as seções que descrevem `duplicado` como um dos 5 status com prioridade, refletindo o novo modelo.

**Por quê:** dezenas de comentários no código citam essa especificação como fonte da verdade; se ela ficar desatualizada, o próximo desenvolvedor (ou você mesmo, meses depois) pode reintroduzir o problema original por confiar no documento antigo.

## 4. Critérios de avaliação da refatoração

A refatoração será considerada **aprovada** quando todos os itens abaixo forem verdadeiros.

### 4.1 O que deve ser entregue

- Código-fonte com as 15 etapas implementadas, sem a checagem `status === 'duplicado'` remanescente em nenhum arquivo de `src/` (busca por `'duplicado'` deve retornar apenas: rótulos de UI, nomes de componentes/CSS relacionados ao modal de conflito, e comentários/documentação — nunca uma comparação de status).
- `data/emails.json` migrado (etapa 0 aplicada), sem nenhum registro com `status: "duplicado"`.
- `Especificacao_Sistema_Emails_v3.md` atualizado, sem contradizer o comportamento do código.
- Um resumo curto (pode ser no corpo do PR ou commit) listando quais das 15 etapas foram concluídas.

### 4.2 O que o sistema deve fazer para ser aprovado

- **Build limpo:** `npm run build` (que roda `tsc -b` antes do Vite) completa sem erros de tipo.
- **Lint limpo:** `npm run lint` não aponta erros novos introduzidos pela refatoração.
- **Cenário original resolvido:** reproduzindo os passos da seção 2.1, os dois registros com o mesmo e-mail (um "inválido" manual, um restaurado) aparecem **ambos** com o indicador de duplicado, e ambos continuam com seu status real (não "inválido" travado ao lado de "duplicado" incoerente).
- **Nenhuma regressão nos fluxos que não mudaram de propósito:**
  - restrição de deletar registros "enviado" continua exigindo o modal de conflito;
  - restaurar continua zerando `status_alterado` e recalculando válido/inválido corretamente;
  - seleção continua impedindo misturar registros deletados com não deletados;
  - exportação continua gerando arquivo sem registros duplicados na saída (mesmo com checkboxes sobrepostos marcados).
- **Contadores e filtros consistentes entre si:** o número mostrado no card "Duplicados" bate com a quantidade de registros que exibem o badge na tabela, e o filtro "Duplicados" traz exatamente esses mesmos registros.
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
2. Selecione 2 deles e clique em "Deletar". O terceiro deve virar `válido` (ou `inválido`, dependendo do e-mail) automaticamente, sem badge de duplicado.
3. Ainda no terceiro registro, use o select de status na tabela e mude manualmente para `inválido`.
4. Selecione um dos dois registros deletados e clique em "Restaurar".
5. **Verifique:** os dois registros ativos (o que ficou `inválido` manualmente e o que voltou da exclusão) devem mostrar, cada um, seu status real **junto com** o badge "⚠ duplicado" ao lado — os dois clicáveis, os dois abrindo o mesmo modal de conflito ao clicar no badge.
6. Isso é o sinal de que o problema relatado no início desta demanda foi resolvido.

### 5.3 Teste 2 — edição manual de um registro duplicado

1. Com o grupo de duplicados do teste 1 ainda visível, tente mudar o status de um deles direto pelo select da tabela (ex.: de `inválido` para `válido`).
2. **Verifique:** a mudança deve ser aceita normalmente, e o badge de duplicado deve continuar aparecendo — a edição do status não deve fazer o badge sumir nem travar.

### 5.4 Teste 3 — contadores e filtros

1. Anote o número mostrado no card "Duplicados" no topo da página.
2. Conte manualmente, na tabela (com o filtro "Todos" ativo), quantos registros exibem o badge "⚠ duplicado".
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
   npm run sync -- data/tabela_exemplo.csv
   ```
   (ou outra planilha de teste disponível em `data/`).
2. **Verifique no terminal:** o resumo final não deve travar nem gerar erro, e o número de "duplicado" impresso deve bater com o que você confere depois na interface.
3. Abra `data/emails.json` num editor de texto e confirme que nenhum registro tem `"status": "duplicado"`.

### 5.7 Teste 6 — build e checagem de tipos

```bash
npm run build
npm run lint
```

**Verifique:** ambos os comandos devem terminar sem erros. Isso confirma que a refatoração não deixou nenhuma referência solta ao antigo status `'duplicado'`.

Se todos os testes acima passarem, a refatoração pode ser considerada validada e pronta para uso.
