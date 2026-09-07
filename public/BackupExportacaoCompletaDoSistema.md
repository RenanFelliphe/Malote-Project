# Backup/Exportação Completa do Sistema

> Documento de implementação autocontido da **Demanda 11** (ver `DEMANDAS.md`, seção "Registro de Demandas"). Este ZIP corresponde à **Etapa 0 — Mapeamento**: reúne o contexto necessário (planner + todo arquivo Fonte/Alterado/Criado já identificado) para que as próximas trocas usem só este ZIP, nunca mais o projeto inteiro. Ao final da Etapa 0, o status da Demanda 11 passa de **Registrado** para **Mapeado** — atualizar a tabela "Registro de Demandas" e o campo `Status` desta demanda em `DEMANDAS.md` de acordo.

## Fluxo de entrega por etapas — leia antes de começar

Bloco reproduzido de `DEMANDAS.md` (obrigatório em todo planner individual):

A partir daqui, o usuário passa a enviar apenas o ZIP mais recente como referência — nunca mais o projeto inteiro. A cada etapa, a entrega é **um único ZIP, cumulativo**:

- **Contém todos os arquivos necessários até aqui, não só os da etapa atual.** Isso inclui (a) todo arquivo efetivamente alterado desde a Etapa 1 desta revisão, e (b) todo arquivo listado como Fonte, Alterado ou Criado em qualquer etapa já concluída — mesmo os que nunca chegaram a ser modificados. Uma vez que um arquivo apareceu em algum ZIP, ele continua aparecendo em todos os ZIPs seguintes até o fim da implementação.
- **Sempre inclui o planner da demanda** (este arquivo), atualizado a cada entrega: etapas concluídas marcadas com "✅ concluída" no título, notas de execução preenchidas, e qualquer ajuste de rota registrado.

## 1. Contexto

Hoje existe exportação por projeto (planilha/CSV, via `ExportarModal.tsx`) e exportação do histórico de logs por mês/intervalo (`ExportarLogsModal.tsx` + `GET /api/logs/export`, Demanda 9), mas nenhum jeito de exportar — ou restaurar — o sistema inteiro. Todos os dados vivem só em `data/active/`, `data/trash/` e `data/logs/`, em arquivos locais sem nenhuma cópia de segurança: se essa pasta for perdida (disco, exclusão acidental, reinstalação da máquina), não há como recuperar nada.

## 2. Escopo

**Cobre:**
- Exportar um pacote único (`.zip`) contendo `data/active/`, `data/trash/` e `data/logs/` inteiros, com timestamp no nome do arquivo, baixável pela interface.
- Restaurar o sistema a partir de um pacote gerado pelo próprio Malote — com um passo de confirmação explícito no frontend, já que é uma operação destrutiva (substitui o `data/` atual).
- Validação básica do pacote antes de aplicar a restauração (estrutura mínima esperada, mensagem de erro clara se o arquivo não for um backup válido do sistema).

**Não cobre nesta fase:**
- Backup automático/agendado — esta demanda é só sob demanda (botão "Exportar backup"), não um cron.
- Armazenamento remoto/nuvem — só download local, o mesmo modelo do restante do sistema.
- Merge entre um backup restaurado e os dados atuais — restaurar é substituição total do `data/`, não uma mesclagem seletiva.

## 3. Achados desta Etapa 0 (mapeamento)

O rastreio do código antes de destrinchar as etapas revelou 3 pontos que corrigem ou completam o que `DEMANDAS.md` já registrava:

- **A "dependência nova" de `.zip` não existe — já está resolvida.** `jszip` já é dependência do projeto (`package.json`) e já é usada nos dois lados: client-side em `exportarPlanilha.ts` (`exportarRegistrosEmLote`, import dinâmico) e server-side em `vite.config.ts` (`logsApiPlugin` → `handleExportarLogs`, `GET /api/logs/export`, import estático). A Demanda 11 reaproveita a mesma lib, sem instalar nada novo — os dois arquivos foram incluídos neste ZIP como Fonte por causa disso.
- **Padrão de escrita atômica já existe e é reaproveitável para a restauração.** `vite.config.ts` já usa `fs.renameSync` em vários handlers (`projetosApiPlugin`, mover/restaurar pasta de projeto) para nunca deixar o sistema num estado parcialmente escrito. A Etapa 3 (endpoint de importação) deve seguir o mesmo critério: extrair o `.zip` recebido para um diretório temporário, validar, e só então `fs.renameSync` sobre `data/` (provavelmente renomeando o `data/` atual para um `data.bak-<timestamp>` antes, para poder reverter se o `renameSync` final falhar no meio).
- **`ConfirmDialog.tsx` já é o componente genérico certo para a Etapa 4** (confirmação da restauração) — extraído justamente para esse tipo de ação destrutiva, sem precisar de UI nova.
- **Convenção de `src/services/*Api.ts` não estava no "Arquivos Necessários" original.** Toda outra área do sistema (`emailsApi.ts`, `lixeiraApi.ts`, `logsApi.ts`, `projetosApi.ts`) tem um wrapper client-side próprio para as chamadas HTTP — `logsApi.ts` foi incluído neste ZIP como referência direta de padrão (download de blob disparado a partir de uma resposta de API). `backupApi.ts` foi adicionado à lista de "Arquivos Criados" (seção 6) por consistência, mesmo sem estar no texto original da demanda em `DEMANDAS.md`.
- **Sobre "onde fica o botão" (decisão ainda aberta, seção 4):** existe um precedente direto no projeto. Ações de escopo *por projeto* (Editar e-mail, Atualizar planilha, Exportar planilha, Deletar planilha) vivem no dropdown "Configurações" do `Header.tsx`, condicionadas a haver um projeto aberto. Já a exportação de logs — que, como o backup, é uma ação de escopo *do sistema inteiro*, não de um projeto — não está nesse dropdown: tem página própria (`/logs`, `pages/logs.tsx`) com botão dedicado na toolbar, abrindo `ExportarLogsModal`. Isso pesa a favor da opção "tela própria" sobre "dentro do dropdown de Configurações" cogitada em `DEMANDAS.md` — mas a decisão continua em aberto para a Etapa 2, só documentando o precedente encontrado.

## 4. Decisões em aberto

Herdadas de `DEMANDAS.md`, ainda sem resposta (a decisão de lib de `.zip` foi removida daqui por já estar resolvida — ver seção 3):

- **Formato do pacote:** `.zip` simples (mais direto) vs. um pacote com `manifest.json` próprio (versão do schema de dados, hash de integridade) — o segundo facilita detectar backups de versões antigas/incompatíveis do sistema, se o modelo de dados mudar no futuro (ex.: depois da Demanda 10).
- **Onde fica o botão na interface:** dentro do dropdown "Configurações" do `Header.tsx` (mesmo lugar cogitado para o histórico da Demanda 4, se ela for retomada) ou uma tela própria, no espírito de `/logs` — ver achado na seção 3.
- **Granularidade da restauração:** o pacote sempre substitui `data/` inteiro, ou o usuário pode escolher restaurar só alguns projetos específicos de dentro do pacote?

## 5. Etapas de Implementação `[Inicial]`

> Quebra preliminar — revisar ao iniciar, principalmente a decisão de formato do pacote (zip simples vs. manifest com versão/hash), que muda a Etapa 4, e a decisão de local do botão, que muda a Etapa 2.

**Etapa 1 — Endpoint de exportação**
- Novo endpoint (`GET /api/backup`, seguindo o padrão de `logsApiPlugin`/`handleExportarLogs` em `vite.config.ts`) que lê `data/active/`, `data/trash/` e `data/logs/` e monta um `.zip` via `JSZip`, devolvido como download (`Content-Disposition: attachment`, nome com timestamp).
- Lógica de leitura/empacotamento extraída para `src/scripts/utils/backup.ts` (novo), no mesmo espírito de `identifyColumns.ts`/`calcularMerge.ts`/`registrarLog.ts` — utilitários server-side importados por `vite.config.ts`, em vez de inline no plugin.

**Etapa 2 — Botão de exportar na interface**
- UI que dispara o download do backup — local a decidir (ver "Decisões em aberto"); `src/services/backupApi.ts` (novo) encapsula a chamada, seguindo o padrão de `logsApi.ts`.

**Etapa 3 — Endpoint de importação**
- Novo endpoint (`POST /api/backup`) que recebe o `.zip`, valida a estrutura mínima esperada, e substitui `data/` — extraindo primeiro para um diretório temporário e só então usando `fs.renameSync` para o destino final (mesmo padrão já usado em `projetosApiPlugin`), para não deixar o sistema num estado parcialmente restaurado se a operação falhar no meio.

**Etapa 4 — Confirmação e validação na interface**
- Fluxo de confirmação explícito antes de restaurar (é destrutivo) — reaproveitando `ConfirmDialog.tsx`, sem precisar de um dialog novo.
- Mensagens de erro claras quando o arquivo enviado não é um backup válido do Malote.
- `BackupModal.tsx` (novo) concentra exportar + importar + confirmação, no mesmo espírito de `ExportarLogsModal.tsx`.

**Etapa 5 — Teste manual**
- Gerar um backup, mover/apagar `data/`, restaurar, e confirmar que projetos, lixeira e logs voltam idênticos ao estado original.

## 6. Arquivos Necessários

**Arquivos Fonte** (usados como referência, não sofrem alteração):
- `src/components/utils/exportarPlanilha.ts` — uso client-side de `JSZip` (import dinâmico) já estabelecido no projeto.
- `vite.config.ts` (também Alterado — ver abaixo) — `logsApiPlugin`/`handleExportarLogs` é o padrão mais próximo de endpoint que gera `.zip` no server, e `projetosApiPlugin` é o padrão de escrita atômica (`fs.renameSync`) a reaproveitar na restauração.
- `src/components/ConfirmDialog.tsx` e `src/components/Dialog.tsx` — componentes reaproveitados sem alteração na Etapa 4.
- `src/components/ExportarLogsModal.tsx` e `src/pages/logs.tsx` — padrão mais próximo já existente de "ação de escopo do sistema, com modal de exportar próprio e botão fora do dropdown de Configurações".
- `src/services/logsApi.ts` — padrão de wrapper client-side (`src/services/*Api.ts`) a seguir em `backupApi.ts`.
- `src/components/Header.tsx` e `src/pages/home.tsx` — contexto para a decisão em aberto de onde fica o botão (dropdown de Configurações vs. tela própria).
- `package.json` — confirma `jszip`/`@types/jszip` já presentes (achado da seção 3).

**Arquivos Alterados:**
- `vite.config.ts` — dois novos endpoints (`GET /api/backup`, `POST /api/backup`), registrados em um novo `backupApiPlugin` (mesmo padrão dos demais plugins do arquivo).

**Arquivos Criados** (incluídos vazios neste ZIP):
- `src/scripts/utils/backup.ts` — utilitário server-side de empacotamento/leitura do `.zip` (lido por `vite.config.ts`).
- `src/components/BackupModal.tsx` — componente de UI para exportar/restaurar.
- `src/services/backupApi.ts` — wrapper client-side das chamadas a `GET /api/backup` e `POST /api/backup` (achado da seção 3, não listado no texto original da demanda).

**Dependência nova:** nenhuma — `jszip` já está no projeto (achado da seção 3, contradiz a nota original em `DEMANDAS.md`).