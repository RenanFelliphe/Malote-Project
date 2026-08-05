# Implementação — Importação Real de Planilhas

## 1. Contexto desta revisão

O wizard de importação (`ImportWizardModal.tsx`) já existe por inteiro do
lado de interface — leitura de planilha (`parseSheetBrowser.ts`), prévia e
estatísticas (`EtapaInformacoes.tsx`), mapeamento de colunas
(`EtapaMapeamento.tsx`/`ColunaSeletora.tsx`), definição opcional de
título/corpo (`EtapaDefinicao.tsx`), revisão (`EtapaRevisao.tsx`) — mas a
etapa final é decorativa: `confirmarImportacao()` só fecha o modal, sem
persistir nada. A única forma real de trazer uma planilha nova para o
sistema hoje é rodar `sync.ts` manualmente pelo terminal.

**O que essa demanda resolve:** elimina a dependência de terminal para
importar uma planilha — funcionalidade que hoje é fricção real para o
único operador do sistema, toda vez que uma planilha nova precisa entrar.

**A solução**, resumida: uma função nova do lado browser converte as linhas
lidas + colunas mapeadas em `EmailRecord[]` (reaproveitando o cálculo de
status já existente em `EmailStatus.ts`, sem duplicar regra nova); um
endpoint novo no middleware do Vite persiste esse resultado em
`data/active/<slug>/emails.json`; o wizard passa a chamar esse endpoint de
verdade ao confirmar, com validação de slug único (client + servidor) e
redirecionamento para o projeto recém-criado ao final.

Esta revisão também é pré-requisito direto de `implementacaoDelecao.md`
(Deleção + Lixeira), que depende da reorganização `data/active/`
introduzida aqui na Etapa 1.

## 2. Decisões de escopo

- **Reorganização física primeiro, funcionalidade depois:** `data/` passa a
  ter uma subpasta `data/active/` para os projetos em uso — preparação
  necessária para a Lixeira (revisão seguinte) ter onde `data/trash/` viver
  como diretório irmão, sem misturar projetos ativos e removidos no mesmo
  nível.
- **`sync.ts` é atualizado, não desativado.** Continua sendo mantido nesta
  fase (desativação formal fica para uma decisão futura), só passa a
  escrever em `data/active/<slug>/emails.json` em vez do caminho fixo
  antigo.
- **Sem duplicar a lógica de `pickFirstFilled`/`identifyColumns.ts` do lado
  Node no browser.** O wizard já sabe exatamente quais colunas usar (o
  usuário mapeou manualmente em `EtapaMapeamento.tsx`) — não precisa das
  listas hardcoded de nomes candidatos que `identifyColumns.ts` usa para
  *adivinhar* colunas no `sync.ts`. A função nova de conversão implementa
  sua própria versão mínima de "primeira coluna preenchida, por
  prioridade" localmente, evitando importar qualquer coisa de
  `src/scripts/` — o que reforçaria a mesma violação de separação
  browser/Node já presente (fora do escopo desta revisão, mas não deve ser
  repetida) em `statsPreliminares.ts`.
- **Validação de slug único em duas camadas:** client (`PROJETOS` em
  memória, feedback imediato na Etapa 1 do wizard) e servidor (checagem
  real contra o disco no momento do `POST`) — o client nunca é a garantia
  final, só conveniência de UX.
- **Redirecionamento por reload completo, não navegação client-side.**
  `PROJETOS` é resolvido uma única vez via `import.meta.glob({ eager: true
  })` no carregamento do módulo; navegar sem reload para `/<slug>` de um
  projeto recém-criado cairia na rota fallback (`NotFound`), já que o slug
  novo não existe no array em memória até a página recarregar.

> ## ⚠️ Regra de entrega a cada etapa — leia antes de começar
>
> **A cada etapa implementada, a entrega deve ser um único ZIP contendo
> *todos* os arquivos alterados desde a Etapa 1 desta revisão até a etapa
> atual — não apenas os da etapa corrente.**
>
> **O ZIP também deve incluir todos os "Arquivos-fonte necessários"
> listados em qualquer etapa até aqui, mesmo os que nunca chegaram a ser
> alterados.** Uma vez que um arquivo apareceu em algum ZIP (seja como
> alterado, seja como fonte de referência), ele continua aparecendo em
> todos os ZIPs seguintes até o fim desta revisão — isso evita ter que
> reenviar manualmente o mesmo arquivo toda vez que ele volta a ser
> necessário, mas não foi modificado na etapa mais recente.
>
> **Este arquivo de plano (`implementacaoImportacao.md`) também deve ir
> dentro do ZIP de cada etapa**, atualizado para refletir o progresso
> (etapas concluídas marcadas com "✅ concluída" no título, notas de
> execução preenchidas, e qualquer ajuste de rota registrado caso um
> diagnóstico durante a implementação mude uma decisão já tomada aqui).

## 3. Divisão em etapas

A Etapa 1 é pré-requisito de todas as demais. As Etapas 2–8 têm dependência
majoritariamente sequencial (cada uma constrói sobre a anterior); a Etapa 9
é checkpoint final de validação, não implementação nova.

### Etapa 1 — Migração para `data/active/` + ajuste de caminhos

**O que fazer:** criar `data/active/` e mover as pastas de projeto já
existentes (`projeto-teste/`, `ultima-chamada-multiverso/`) para dentro
dela. Atualizar `src/data/projetos.ts` (`import.meta.glob` passa a apontar
para `data/active/*/emails.json`) e `vite.config.ts` (`dataDirectory` vira
`activeDirectory`, usado pelo handler `PUT /api/emails/:slug` já
existente). Criar também `data/trash/` vazia, antecipando a próxima
revisão.

**Por quê:** é a única etapa que não soma funcionalidade nova — só
reorganiza o que já existe. Isolada assim, dá para confirmar que nada
quebrou antes de empilhar código novo em cima.

**Arquivos alterados:** `src/data/projetos.ts`, `vite.config.ts`.

**Arquivos-fonte necessários:** nenhum arquivo de código adicional — só
reorganização de pastas dentro de `data/` (mover diretórios existentes).

### Etapa 2 — Atualizar `sync.ts` para o novo layout

**O que fazer:** `sync.ts` passa a aceitar um slug de destino (via
argumento `--slug=`, ou derivado do nome do arquivo quando omitido) e
gravar/atualizar em `data/active/<slug>/emails.json`, criando o projeto se
ainda não existir.

**Por quê:** mesma reorganização de caminho da Etapa 1, do lado do script
Node — faz sentido resolver junto, já que mexe exatamente na mesma
estrutura de pastas.

**Arquivos alterados:** `src/scripts/sync.ts`.

**Arquivos-fonte necessários:** `src/types/email.ts`,
`src/scripts/utils/readSheet.ts`, `src/scripts/utils/identifyColumns.ts`,
`src/scripts/utils/validateEmail.ts`.

### Etapa 3 — Função de conversão `linhas → registros` (browser)

**O que fazer:** nova função pura,
`src/components/import/utils/construirRegistros.ts`, recebendo `linhas`,
`colunasNome`, `colunasEmail` (já coletados pelo wizard) e devolvendo
`EmailRecord[]`. Usa uma versão local mínima de "primeira coluna
preenchida por prioridade" (ver seção 2) e reaproveita
`recalcularStatusAutomatico`/`isValidEmail` de
`src/components/EmailStatus.ts` para o cálculo de status. `id` sequencial
1-based; `status_alterado: false` em todos os registros novos.

Aproveitar esta etapa para corrigir também o import indevido em
`src/components/import/utils/statsPreliminares.ts` (hoje importa de
`scripts/utils/validateEmail.ts`), apontando para `EmailStatus.ts` — evita
que o código novo repita o mesmo atalho e resolve uma inconsistência já
existente no projeto.

**Arquivos alterados:**
`src/components/import/utils/construirRegistros.ts` (novo),
`src/components/import/utils/statsPreliminares.ts` (correção de import).

**Arquivos-fonte necessários:** `src/components/EmailStatus.ts`,
`src/types/email.ts`, `src/components/import/utils/parseSheetBrowser.ts`.

### Etapa 4 — Validação de slug único no client

**O que fazer:** em `EtapaInformacoes.tsx`, o campo "Nome do arquivo" passa
a validar em tempo real se o slug já existe entre os projetos ativos
(`PROJETOS`), mostrando erro inline e bloqueando o avanço
(`ImportWizardModal.tsx`: `etapa1Valida` passa a considerar também a
ausência de colisão).

**Arquivos alterados:** `src/components/import/EtapaInformacoes.tsx`,
`src/components/import/ImportWizardModal.tsx`.

**Arquivos-fonte necessários:** `src/data/projetos.ts`,
`src/components/import/utils/slugify.ts`.

### Etapa 5 — Endpoint `POST /api/projetos`

**O que fazer:** novo handler no middleware de `vite.config.ts`, aceitando
`POST /api/projetos` com `{ slug, projeto, email, registros }`. Valida
slug seguro (mesma checagem de path traversal já usada em
`/api/emails/:slug`) e que `data/active/<slug>` ainda não existe (garantia
real de unicidade); em sucesso, cria a pasta e grava `emails.json` com
`criado_em`/`atualizado_em`. Resposta `409` em caso de colisão.

**Arquivos alterados:** `vite.config.ts`.

**Arquivos-fonte necessários:** `src/types/email.ts`.

### Etapa 6 — Serviço HTTP (`projetosApi.ts`)

**O que fazer:** novo `src/services/projetosApi.ts`, função
`criarProjeto(slug, projeto, email, registros)` fazendo o `POST` da Etapa
5 e lançando erro em resposta não-`ok` (com tratamento específico de
`409`), mesmo padrão de `emailsApi.ts` já existente.

**Arquivos alterados:** `src/services/projetosApi.ts` (novo).

**Arquivos-fonte necessários:** `src/services/emailsApi.ts`.

### Etapa 7 — Ligar em `confirmarImportacao`

**O que fazer:** `confirmarImportacao` (em `ImportWizardModal.tsx`) vira
`async`: monta `EmailRecord[]` via `construirRegistros` (Etapa 3), chama
`criarProjeto` (Etapa 6), trata loading (`Importando…`, botão desabilitado
durante a chamada) e erro (mensagem inline, modal permanece aberto —
mesmo padrão de `EmailConteudoModal.tsx`/`ExportarModal.tsx`).

**Arquivos alterados:** `src/components/import/ImportWizardModal.tsx`.

**Arquivos-fonte necessários:**
`src/components/import/utils/construirRegistros.ts`,
`src/services/projetosApi.ts`, `src/components/EmailConteudoModal.tsx`.

### Etapa 8 — Redirecionamento pós-criação

**O que fazer:** ao concluir com sucesso, redirecionar via reload completo
(`window.location.href = '/' + slug`) para o projeto recém-criado, em vez
de só fechar o modal — ver justificativa na seção 2.

**Arquivos alterados:** `src/components/import/ImportWizardModal.tsx`.

**Arquivos-fonte necessários:** nenhum adicional além do já listado na
Etapa 7.

### Etapa 9 — QA end-to-end (checkpoint, sem código novo)

**O que fazer:** validar o fluxo completo com planilha real (`.csv` e
`.xlsx`): contadores/status calculados batendo com o que `sync.ts`
calcularia para os mesmos dados; projeto aparecendo na Home após reload;
reimportação com nome já usado bloqueada tanto no client (Etapa 4) quanto
no servidor (Etapa 5, forçando via chamada direta); confirmar que nenhum
arquivo em `src/components/` ainda importa de `src/scripts/`.

**Arquivos alterados:** nenhum (etapa de validação).

**Arquivos-fonte necessários:** todos os já listados nas etapas
anteriores.
