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

### Etapa 1 — Migração para `data/active/` + ajuste de caminhos ✅ concluída

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

**Notas de execução:** o repositório enviado continha apenas
`data/projeto-teste/`; não havia pasta `ultima-chamada-multiverso/` para
mover (referência do plano original não se aplicou a este snapshot — sem
impacto na etapa, só um ajuste de fato observado, não de decisão). Todo o
conteúdo de `projeto-teste/` (`emails.json` e `sheet.csv`) foi movido
intacto para `data/active/projeto-teste/`. `data/trash/` foi criada vazia
(com um `.gitkeep` só para garantir que a pasta vazia sobreviva ao
versionamento/zip). `npx tsc -p tsconfig.app.json --noEmit` e
`npx vite build` rodaram limpos após a mudança, confirmando que o glob
novo (`../../data/active/*/emails.json`) descobre `projeto-teste`
corretamente e que o handler `PUT /api/emails/:slug` em `vite.config.ts`
resolve caminhos contra `activeDirectory` sem quebrar a validação de path
traversal existente.

### Etapa 2 — Atualizar `sync.ts` para o novo layout ✅ concluída

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

**Notas de execução:** o `src/scripts/sync.ts` recebido já continha, ao
ser conferido contra os arquivos-fonte desta etapa, a implementação
completa do que era pedido — `parseArgs` já resolve o slug via `--slug=`
ou via `slugFromSheetPath` (derivado do nome do arquivo), `outPath` já
aponta para `data/active/<slug>/emails.json`, e `writeJson` já cria o
diretório do projeto com `mkdirSync(..., { recursive: true })` quando ele
ainda não existe. Nenhuma alteração de código foi necessária. Verificação
feita em ambiente isolado: `npx tsc --noEmit` limpo contra os quatro
arquivos-fonte reais (`email.ts`, `readSheet.ts`, `identifyColumns.ts`,
`validateEmail.ts`) — confirmando as assinaturas de
`identifyColumns`/`pickFirstFilled`/`EMAIL_COLUMNS`/`isValidEmail`/
`normalizeEmail` e a forma de `EmailRecord`/`EmailsData` usadas em
`sync.ts` — e teste funcional com `tsx` rodando o script contra uma
planilha `.csv` de exemplo, cobrindo (a) slug derivado do nome do arquivo
com projeto novo e (b) `--slug=` explícito com projeto novo: em ambos os
casos o diretório `data/active/<slug>/` e o `emails.json` foram criados
corretamente, com os 3 registros de teste computados como `válido` e
`status_alterado: false`.

### Etapa 3 — Função de conversão `linhas → registros` (browser) ✅ concluída

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

**Notas de execução:** `construirRegistros` recebe as linhas já lidas por
`parsearPlanilha` e as colunas de nome/e-mail já mapeadas manualmente pelo
usuário (`colunasNome`/`colunasEmail`, arrays de cabeçalhos exatos — não
listas de candidatos a adivinhar). Cada registro nasce com `status:
'válido'` provisório e o array inteiro passa por
`recalcularStatusAutomatico` de uma vez só, mesmo padrão de
`syncRecords`/`applyStatusRules` em `sync.ts` — assim válido/inválido/
duplicado ficam corretos sem duplicar a regra de prioridade. A versão
local de "primeira coluna preenchida" não faz correspondência
case-insensitive por nome (diferente da de `identifyColumns.ts`): como
`colunasNome`/`colunasEmail` já são os cabeçalhos exatos do mapeamento
manual, não há necessidade de procurar por nomes candidatos, só de
indexar a linha diretamente. Import de `statsPreliminares.ts` corrigido de
`../../../scripts/utils/validateEmail` para `../../EmailStatus`, sem
nenhuma outra alteração no arquivo. Verificação feita em ambiente isolado:
`npx tsc --noEmit` limpo contra os quatro arquivos do lado browser
(`construirRegistros.ts`, `statsPreliminares.ts`, `EmailStatus.ts`,
`parseSheetBrowser.ts`); os únicos erros de `tsc` observados ao checar o
projeto inteiro (`import.meta.glob` sem os tipos de `vite/client` e
`csv-parse/sync` sem dependência instalada neste ambiente isolado) são
anteriores a esta etapa e não têm relação com os arquivos alterados aqui.

### Etapa 4 — Validação de slug único no client ✅ concluída

**O que fazer:** em `EtapaInformacoes.tsx`, o campo "Nome do arquivo" passa
a validar em tempo real se o slug já existe entre os projetos ativos
(`PROJETOS`), mostrando erro inline e bloqueando o avanço
(`ImportWizardModal.tsx`: `etapa1Valida` passa a considerar também a
ausência de colisão).

**Arquivos alterados:** `src/components/import/EtapaInformacoes.tsx`,
`src/components/import/ImportWizardModal.tsx`.

**Arquivos-fonte necessários:** `src/data/projetos.ts`,
`src/components/import/utils/slugify.ts`.

**Notas de execução:** a checagem em si (`slugJaExiste`) foi implementada
em `ImportWizardModal.tsx`, não em `EtapaInformacoes.tsx` — único lugar que
já tinha acesso a `estado.nomeArquivoSlug` e onde `etapa1Valida` já era
calculado, evitando levantar (`lift`) a comparação de volta do componente
filho. `PROJETOS.some(p => p.slug === slugAtual)` roda dentro de um
`useMemo` chaveado em `estado.nomeArquivoSlug`; `EtapaInformacoes` recebe
apenas o booleano resultante via nova prop `slugJaExiste`, sem
conhecimento de `PROJETOS`. Comparação é exata (sem `trim`/case-folding
extra) porque `nomeArquivoSlug` já chega normalizado por
`slugify`/`slugifyDigitando`; string vazia é tratada como "sem colisão"
para não bloquear o campo antes de qualquer digitação. `etapa1Valida`
passou a exigir também `!slugJaExiste`. No client, o erro substitui a
prévia da URL (`/projetos/<slug>`) no mesmo espaço abaixo do campo — texto
"Já existe um projeto com esse nome de arquivo. Escolha outro para
continuar." — com `aria-invalid`/`aria-describedby` ligando o input à
mensagem. Não foi adicionada nenhuma classe CSS nova ao design system
existente além de `campo-formulario-erro` (estilo ainda não definido,
nenhum arquivo `.css` foi enviado nesta etapa para revisão — sinalizar se
já existir um padrão de erro de campo em uso no restante do projeto).
Como no client não há checagem por segurança real de path traversal (isso
só existe no handler do servidor, Etapa 5), a comparação aqui é
propositalmente ingênua — só decoração de UX, confirmando a decisão já
registrada na seção 2.

### Etapa 5 — Endpoint `POST /api/projetos` ✅ concluída

**O que fazer:** novo handler no middleware de `vite.config.ts`, aceitando
`POST /api/projetos` com `{ slug, projeto, email, registros }`. Valida
slug seguro (mesma checagem de path traversal já usada em
`/api/emails/:slug`) e que `data/active/<slug>` ainda não existe (garantia
real de unicidade); em sucesso, cria a pasta e grava `emails.json` com
`criado_em`/`atualizado_em`. Resposta `409` em caso de colisão.

**Arquivos alterados:** `vite.config.ts`.

**Arquivos-fonte necessários:** `src/types/email.ts`.

**Notas de execução:** a checagem de path traversal foi extraída para uma
função só, `slugEhSeguro(slug)` (novo module-level helper em
`vite.config.ts`), e passou a ser reaproveitada tanto pelo handler novo
quanto pelo handler existente `PUT /api/emails/:slug` — que antes tinha a
mesma lógica escrita inline. Isso é literalmente "a mesma checagem já
usada", não uma reimplementação equivalente, e elimina a duplicação em vez
de repeti-la; o comportamento do handler existente não mudou (mesmas
strings vazias/`.`/`..`/barras rejeitadas), confirmado por teste de
regressão (ver abaixo). Erros agora carregam um status HTTP explícito via
uma classe `ApiError` nova (400 para corpo inválido ou slug inseguro, 409
para colisão de slug), em vez de todo erro cair em 500 como no handler de
`/api/emails/:slug` — `ApiError` não foi aplicada retroativamente a esse
handler existente por estar fora do escopo desta etapa (ele continua
respondendo 500 para tudo, como já fazia). A verificação de unicidade usa
`fs.statSync(diretorioProjeto, { throwIfNoEntry: false })` contra o
disco — não o array `PROJETOS` em memória do client, que só reflete a
realidade após reload (ver seção 2) — e roda depois da validação de slug
seguro, então um slug malicioso nunca chega a ser testado contra o disco.
Em sucesso, a resposta é `201` (criação), não `200`; o corpo devolvido é
`{ ok: true, slug }`, dado que a Etapa 6 (`criarProjeto`) vai precisar do
slug confirmado para o redirecionamento da Etapa 8. Verificação feita em
ambiente isolado: `npx tsc --noEmit` limpo contra `vite.config.ts` e
`src/types/email.ts` (com `moduleResolution: bundler`, replicando a
configuração real do projeto); teste funcional subindo `vite` de verdade
(`npx vite --strictPort`) e chamando os endpoints via `curl`, cobrindo (a)
criação nova → `201`, `emails.json` gravado com `criado_em`/`atualizado_em`
iguais e `registros` intactos; (b) mesmo slug de novo → `409`, sem
sobrescrever o arquivo existente; (c) slug `../fora-de-data` → `400`, e
confirmação de que nenhum diretório foi criado fora de `data/`; (d) corpo
sem `projeto`/`email`/`registros` → `400`; (e) `GET` no lugar de `POST` →
`405`. Teste de regressão separado confirmou que `PUT
/api/emails/projeto-existente` continua respondendo `200` e mesclando
`email`/`registros` corretamente após a extração de `slugEhSeguro`.

### Etapa 6 — Serviço HTTP (`projetosApi.ts`) ✅ concluída

**O que fazer:** novo `src/services/projetosApi.ts`, função
`criarProjeto(slug, projeto, email, registros)` fazendo o `POST` da Etapa
5 e lançando erro em resposta não-`ok` (com tratamento específico de
`409`), mesmo padrão de `emailsApi.ts` já existente.

**Arquivos alterados:** `src/services/projetosApi.ts` (novo).

**Arquivos-fonte necessários:** `src/services/emailsApi.ts`.

**Notas de execução:** `criarProjeto` segue a mesma forma de
`salvarEmails` (`fetch` + checagem de `resposta.ok` + `throw`), mas com
duas diferenças exigidas pelo contrato da Etapa 5: (1) retorna
`Promise<string>` — não `Promise<void>` — devolvendo o `slug` confirmado
pelo corpo `{ ok: true, slug }` da resposta `201`, já que a Etapa 8
precisa desse valor para o redirecionamento; (2) resposta `409` lança uma
classe dedicada, `ProjetoSlugDuplicadoError` (novo `export` em
`projetosApi.ts`), em vez do `Error` genérico usado para as demais
falhas — permitindo que a Etapa 7 distinga com `instanceof` a colisão de
slug (para, por ex., reabrir a Etapa 1 do wizard) de qualquer outro erro
(rede, 400, 500). Um helper interno, `extrairMensagemDeErro`, tenta ler
`{ error }` do corpo da resposta (sempre presente nas respostas de erro
do middleware, ver Etapa 5) para usar como mensagem do erro lançado,
com fallback para uma mensagem genérica caso o corpo não seja JSON válido
(ex. falha de rede antes de alcançar o middleware). Verificação feita em
ambiente isolado: `npx tsc --noEmit` limpo contra `projetosApi.ts` e
`emailsApi.ts` (com `moduleResolution: bundler`, replicando a
configuração real do projeto) — nenhuma alteração necessária em
`emailsApi.ts`, só usado como referência de padrão.

### Etapa 7 — Ligar em `confirmarImportacao` ✅ concluída

**O que fazer:** `confirmarImportacao` (em `ImportWizardModal.tsx`) vira
`async`: monta `EmailRecord[]` via `construirRegistros` (Etapa 3), chama
`criarProjeto` (Etapa 6), trata loading (`Importando…`, botão desabilitado
durante a chamada) e erro (mensagem inline, modal permanece aberto —
mesmo padrão de `EmailConteudoModal.tsx`/`ExportarModal.tsx`).

**Arquivos alterados:** `src/components/import/ImportWizardModal.tsx`.

**Arquivos-fonte necessários:**
`src/components/import/utils/construirRegistros.ts`,
`src/services/projetosApi.ts`, `src/components/EmailConteudoModal.tsx`.

**Notas de execução:** dois arquivos-fonte adicionais, não listados nas
etapas anteriores, foram necessários para implementar corretamente e
passaram a ser fonte necessária a partir de agora:
`src/components/import/types.ts` (definição de `EstadoImportacao` —
`titulo`/`conteudo`, preenchidos opcionalmente na Etapa 3 do wizard, são
os campos usados para montar o `EmailConteudo` enviado a `criarProjeto`)
e `src/components/import/EtapaDefinicao.tsx` (confirma que são esses os
únicos campos que gravam `titulo`/`conteudo` no estado). Título/corpo são
opcionais: se nenhum dos dois foi preenchido, o projeto nasce com
`EMAIL_CONTEUDO_VAZIO` (de `src/types/email.ts`, incluindo
`atualizado_em: ''`), em vez de um timestamp que sugeriria uma edição que
não aconteceu; só quando pelo menos um dos dois campos está preenchido é
que `atualizado_em` recebe `new Date().toISOString()`. Erros são
distinguidos por `instanceof ProjetoSlugDuplicadoError` (Etapa 6): colisão
de slug mostra uma mensagem apontando de volta para a Etapa 1 do wizard;
qualquer outra falha (rede, 400, 500) mostra uma mensagem genérica — ambas
via um novo estado `erroImportacao`, renderizado com a mesma classe
`erro-salvamento` usada por `EmailConteudoModal.tsx`. Um novo estado
`importando` desabilita os botões "Voltar" e "Confirmar Importação"
(trocando o rótulo deste último para "Importando…") e faz
`solicitarFechamento` retornar cedo — mesmo padrão do guard `if (salvando)
return` de `EmailConteudoModal.tsx` — para que Esc/clique fora/botão "X"
não interrompam uma persistência em andamento. Em sucesso, o modal apenas
fecha (`onFechar()`), como antes desta etapa — o redirecionamento para o
projeto recém-criado, usando o `slug` que `criarProjeto` devolve, é
implementado só na Etapa 8. Verificação feita em ambiente isolado: `npx
tsc --noEmit` limpo contra todos os arquivos reais do fluxo de importação
(`ImportWizardModal.tsx`, `EtapaInformacoes.tsx`, `EtapaDefinicao.tsx`,
`types.ts`, `construirRegistros.ts`, `projetosApi.ts`, `emailsApi.ts`,
`email.ts`, `EmailStatus.ts`, `parseSheetBrowser.ts`,
`statsPreliminares.ts`, `slugify.ts`), com stubs mínimos só para as peças
fora do escopo desta etapa (`Dialog`, `ConfirmDialog`, `Icons`,
`EtapaMapeamento.tsx`, `EtapaRevisao.tsx`, `data/projetos.ts`,
`formatBytes.ts`, tipos do pacote `xlsx`) — os únicos erros restantes
ficam dentro de `parseSheetBrowser.ts` e vêm do stub simplificado do
`xlsx` usado só para a checagem (o pacote real não está disponível neste
ambiente isolado), não têm relação com nenhum arquivo alterado ou
consultado nesta etapa.

### Etapa 8 — Redirecionamento pós-criação ✅ concluída

**O que fazer:** ao concluir com sucesso, redirecionar via reload completo
(`window.location.href = '/' + slug`) para o projeto recém-criado, em vez
de só fechar o modal — ver justificativa na seção 2.

**Arquivos alterados:** `src/components/import/ImportWizardModal.tsx`.

**Arquivos-fonte necessários:** nenhum adicional além do já listado na
Etapa 7.

**Notas de execução:** o `slug` usado no redirecionamento é o valor
devolvido por `criarProjeto` (`Promise<string>`, resolvido a partir de
`{ ok: true, slug }` no corpo da resposta `201` — ver Etapa 6), não
`estado.nomeArquivoSlug` diretamente; embora os dois sejam o mesmo valor
neste fluxo (o servidor não normaliza nem altera o slug recebido), usar o
retorno da chamada mantém a Etapa 7 como única fonte da verdade sobre "o
que o servidor de fato confirmou ter criado". `onFechar()` foi removido do
caminho de sucesso — ele continua em uso em `cancelarImportacao` e no
botão "Fechar" do estado de erro de leitura da planilha, então nenhuma
prop ficou sem uso. Como `window.location.href` dispara um reload
completo, o bloco `finally` (que zera `importando`) ainda executa antes de
a navegação de fato substituir a página — sem efeito perceptível, já que a
troca de página acontece em seguida. Verificação feita em ambiente
isolado: `npx tsc --noEmit` limpo contra o mesmo conjunto de arquivos
reais já validado na Etapa 7 (`ImportWizardModal.tsx` incluído), com os
mesmos stubs; os únicos erros restantes continuam isolados no stub
simplificado de `xlsx` dentro de `parseSheetBrowser.ts`, sem relação com
esta etapa.

### Etapa 9 — QA end-to-end (checkpoint, sem código novo) ✅ concluída

**O que fazer:** validar o fluxo completo com planilha real (`.csv` e
`.xlsx`): contadores/status calculados batendo com o que `sync.ts`
calcularia para os mesmos dados; projeto aparecendo na Home após reload;
reimportação com nome já usado bloqueada tanto no client (Etapa 4) quanto
no servidor (Etapa 5, forçando via chamada direta); confirmar que nenhum
arquivo em `src/components/` ainda importa de `src/scripts/`.

**Arquivos alterados:** nenhum (etapa de validação).

**Arquivos-fonte necessários:** todos os já listados nas etapas
anteriores.

**Notas de execução:** quatro checagens rodaram de fato, com dados reais,
em ambientes isolados; uma quinta não pôde ser executada por faltar
arquivo, registrada abaixo como pendência explícita.

1. **Import real ausente em `src/components/`:** `grep -rn "^import"
   src/components/ | grep scripts` não encontrou nenhuma ocorrência — as
   duas únicas menções a `src/scripts/` no diretório são comentários
   (`construirRegistros.ts` e `EmailStatus.ts`), não imports.

2. **Paridade de contadores/status `sync.ts` × wizard, `.csv` e `.xlsx`:**
   uma planilha de 8 linhas foi montada cobrindo os 3 casos (2 e-mails
   válidos únicos, 4 formando 2 pares duplicados — um deles com
   capitalização diferente, para confirmar a normalização por
   `normalizeEmail` — e 2 inválidos, um deles com e-mail vazio). Rodada
   via `sync.ts` de verdade (`npx tsx src/scripts/sync.ts`, com
   `csv-parse`/`xlsx` reais instalados) tanto no `.csv` quanto num `.xlsx`
   gerado a partir dos mesmos dados, e via `parsearPlanilha` +
   `construirRegistros` (o fluxo real do wizard, usando o `File` global do
   Node, disponível a partir do Node 20) com as colunas mapeadas
   manualmente para `['Nome']`/`['Email']` — resultado idêntico nos 4
   cruzamentos (csv×sync, csv×wizard, xlsx×sync, xlsx×wizard): contadores
   `{ total: 8, válido: 2, inválido: 2, duplicado: 4, deletado: 0, enviado:
   0 }`, e status idêntico registro a registro. Isso é esperado mesmo
   `applyStatusRules` (`sync.ts`) e `recalcularStatusAutomatico`
   (`EmailStatus.ts`, usada por `construirRegistros`) tendo uma diferença
   real de comportamento entre si — a segunda exclui da contagem de
   duplicados os registros `status === 'deletado' && status_alterado ===
   true`, a primeira não — porque essa diferença só se manifesta quando já
   existem registros deletados no projeto; numa importação nova (o caso
   desta etapa), nenhum registro nasce deletado, então as duas regras
   colapsam no mesmo resultado. Vale registrar para quem for mexer nessa
   área depois: as duas funções *não* são intercambiáveis em geral, só
   coincidem neste cenário específico.

3. **Endpoint `POST /api/projetos` de verdade (`npx vite --strictPort`
   real, não simulado):** (a) criação nova → `201`,
   `{ ok: true, slug }`, `emails.json` gravado com `criado_em`/
   `atualizado_em` e `registros` intactos; (b) mesmo slug de novo → `409`,
   arquivo não sobrescrito; (c) slug de um projeto que já existia *antes*
   desta chamada (`projeto-existente`, simulando o resultado da migração
   da Etapa 1) → `409` também, confirmando que a unicidade é checada
   contra o disco, não contra nenhum cache da chamada anterior; (d) slug
   `../fora-de-data` → `400`, e nenhum arquivo/diretório criado fora de
   `data/`; (e) corpo sem `projeto` → `400`; (f) `GET` → `405`. Teste de
   regressão do `PUT /api/emails/:slug` (existente antes da Etapa 5) no
   mesmo servidor: slug válido → `200` com merge correto de
   `email`/`registros` preservando `criado_em`; slug inexistente → `500`
   com a mesma mensagem de antes — confirma que a extração de
   `slugEhSeguro` (Etapa 5) não alterou esse handler.

4. **Bloqueio de slug duplicado no client (Etapa 4):** revisão de código
   (sem alteração desde a Etapa 4) confirma `slugJaExiste`
   (`PROJETOS.some(...)`) ainda alimentando `etapa1Valida` e o botão
   "Avançar" da Etapa 1 do wizard — nenhuma regressão introduzida pelas
   Etapas 7/8.

5. **Pendência — não verificada:** "projeto aparecendo na Home após
   reload" depende de `Home`/`App`/roteamento, que nunca foram enviados em
   nenhum ZIP desta revisão (só fragmentos de `src/components/import/` e
   `src/services/` chegaram até aqui). `src/data/projetos.ts` (o
   `import.meta.glob` que a Home consome) foi conferido e resolve
   `data/active/*/emails.json` corretamente — inclusive descobrindo o
   projeto criado no teste 3(a) acima, se essa pasta isolada fosse servida
   pelo Vite completo — mas a renderização da Home em si fica fora do
   que dá para validar com os arquivos disponíveis. Recomendo rodar esse
   passo manualmente no ambiente real assim que este ZIP for aplicado:
   importar uma planilha pelo wizard, recarregar a página e confirmar que
   o projeto aparece na Home.

Com isso, `implementacaoImportacao.md` está concluído — a única etapa sem
verificação automática ficou registrada acima como passo manual.
