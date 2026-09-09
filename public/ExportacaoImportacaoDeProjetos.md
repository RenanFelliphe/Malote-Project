# Exportação e Importação de Projetos (Portabilidade) — ex-"Backup/Exportação Completa do Sistema"

> Documento de implementação autocontido da **Demanda 11** (ver `DEMANDAS.md`, seção "Registro de Demandas"). O escopo original (disaster recovery do sistema inteiro) foi **substituído** por uma funcionalidade de portabilidade de projetos entre pacotes exportáveis/importáveis — ver seção 1 para o histórico da mudança.
>
> **Nota de nomenclatura (resolvida na Etapa 1):** o arquivo foi renomeado de `BackupExportacaoCompletaDoSistema.md` para o nome atual, já usado como referência em `DEMANDAS.md`. Os arquivos de código correspondentes também foram renomeados nesta entrega — ver "Notas de execução" na Etapa 1 (seção 8) e a lista atualizada na seção 9.

## Fluxo de entrega por etapas — leia antes de começar

Bloco reproduzido de `DEMANDAS.md` (obrigatório em todo planner individual):

A partir daqui, o usuário passa a enviar apenas o ZIP mais recente como referência — nunca mais o projeto inteiro. A cada etapa, a entrega é **um único ZIP, cumulativo**:

- **Contém todos os arquivos necessários até aqui, não só os da etapa atual.** Isso inclui (a) todo arquivo efetivamente alterado desde a Etapa 1 desta revisão, e (b) todo arquivo listado como Fonte, Alterado ou Criado em qualquer etapa já concluída — mesmo os que nunca chegaram a ser modificados. Uma vez que um arquivo apareceu em algum ZIP, ele continua aparecendo em todos os ZIPs seguintes até o fim da implementação.
- **Sempre inclui o planner da demanda** (este arquivo), atualizado a cada entrega: etapas concluídas marcadas com "✅ concluída" no título, notas de execução preenchidas, e qualquer ajuste de rota registrado.

## 1. Contexto e histórico da mudança de escopo

**Motivação original (mantida como registro histórico, não mais coberta por esta demanda):** hoje existe exportação por projeto (planilha/CSV, via `ExportarModal.tsx`) e exportação do histórico de logs por mês/intervalo (`ExportarLogsModal.tsx` + `GET /api/logs/export`, Demanda 9), mas nenhum jeito de exportar — ou restaurar — o sistema inteiro. Se `data/active/`, `data/trash/` ou `data/logs/` forem perdidos (disco, exclusão acidental, reinstalação da máquina), não há como recuperar nada. Essa era a motivação original da Demanda 11.

**Decisão tomada em conversa (fecha as pontas soltas da Etapa 0):** a Demanda 11 deixa de cobrir esse disaster recovery. Em vez de um backup/restore destrutivo do `data/` inteiro, a demanda passa a ser uma funcionalidade de **portabilidade de projetos**: exportar um ou mais projetos completos (`data/active/<slug>/`) como um pacote `.zip`, e importar esse pacote em outra instância (ou na mesma, mais tarde), **sem nunca sobrescrever projetos existentes automaticamente** — é uma operação aditiva, não uma restauração.

Consequência explícita: `data/trash/` e `data/logs/` continuam sem nenhuma cópia de segurança depois desta demanda. Se isso for um problema, é uma demanda nova a levantar depois — não está coberto aqui.

## 2. Escopo

**Cobre:**

- **Exportar Projetos:** empacota um ou mais projetos (`emails.json` + `sheet.<ext>` de cada um, mais um `manifest.json` com metadados — ver seção 3) num único `.zip`, baixável pela interface, com timestamp no nome.
  - **1 projeto**, disparado a partir do dropdown de "Exportar Planilha" (submenu) na página do próprio projeto aberto.
  - **N projetos**, disparado a partir do mesmo submenu na Home, que ativa o modo de seleção múltipla já existente (mesmo padrão de `onAtivarSelecaoExportacao`) para escolher quais projetos entram no pacote.
- **Importar Projetos:** novo item no dropdown "Importar" da Home (ao lado de "Importar planilha"), que abre um seletor de arquivo `.zip`, valida a estrutura mínima esperada (manifest + pastas de projeto), e mostra um resumo dos projetos contidos antes de confirmar.
- **Importação é sempre aditiva:** projetos do pacote sem conflito de slug/nome são adicionados diretamente a `data/active/`, mantendo todos os projetos já existentes intocados.
- **Conflito de slug/nome:** quando um projeto do pacote colide com um projeto já existente, abre um modal de conflito **por projeto conflitante** (não em lote), com 3 opções — ver seção 4 para o detalhe e a ressalva de que é uma sugestão desta revisão.
- **Estilização do dropdown "Importar" na Home:** botão + ícone `[i]` de informação ao lado de cada uma das 2 opções (Importar Planilha / Importar Projetos), que no hover ou clique resume o que cada importação faz. Texto sugerido (ajustar tom se necessário):
  - *Importar Planilha:* "Importa uma única planilha (CSV/XLSX) e cria um projeto novo."
  - *Importar Projetos:* "Importa um pacote com um ou mais projetos completos, exportados anteriormente. Não afeta os projetos que já existem."
- **Registro em log (Demanda 9):** ambas as ações (`importar_projetos`, `exportar_projetos`) passam a existir na whitelist de `acao` do sistema de logs — ver seção 7 para o ajuste cruzado na Demanda 9.

**Não cobre nesta fase:**

- Disaster recovery do sistema inteiro (backup/restore de `data/active`+`trash`+`logs`, substituindo tudo) — escopo removido, ver seção 1.
- Backup automático/agendado — continua sendo só sob demanda (botão), não um cron.
- Armazenamento remoto/nuvem — só download/upload local, mesmo modelo do resto do sistema.
- Exportar/importar projetos da lixeira (`data/trash/`) — o pacote cobre só `data/active/`. Um projeto na lixeira não aparece como opção de seleção para exportação.
- Transferir o histórico de logs (`data/logs/`) junto do pacote de um projeto — as linhas de log de um projeto ficam na máquina de origem; a importação em outra instância não recria esse histórico.
- Merge de conteúdo entre um projeto importado e um projeto existente de mesmo slug (ex.: unir registros dos dois) — as 3 opções do modal de conflito (seção 4) são todas "tudo ou nada" por projeto, nunca uma fusão de registros.

## 3. Modelo do pacote (`.zip`)

```
pacote-projetos-<timestamp>.zip
  manifest.json
  projetos/
    <slug-1>/
      emails.json
      sheet.<ext>
    <slug-2>/
      emails.json
      sheet.<ext>
    ...
```

`manifest.json` — necessário porque a importação precisa detectar conflito de slug **antes** de extrair qualquer coisa em `data/active/`, e precisa de um mínimo de metadados pra validar que o arquivo é de fato um pacote deste sistema (mensagem de erro clara se não for):

```json
{
  "versao": 1,
  "geradoEm": "2026-09-07T14:00:00.000Z",
  "projetos": [
    { "slug": "campanha-outubro", "nome": "Campanha Outubro", "totalRegistros": 312 },
    { "slug": "turma-2026", "nome": "Turma 2026", "totalRegistros": 87 }
  ]
}
```

`versao` existe para permitir, no futuro, mudar o formato do pacote sem quebrar a leitura de pacotes antigos — sem exigir isso agora, só deixando o campo presente desde o início (mais barato que adicionar depois).

## 4. Modal de conflito — sugestão desta revisão, confirmar

Quando um `slug` do pacote já existe em `data/active/`, o modal mostra o nome do projeto conflitante (dos dois lados: o existente e o do pacote) e oferece 3 opções:

1. **Manter o atual** — ignora o projeto do pacote, o existente não é tocado (no-op silencioso pra esse projeto específico).
2. **Substituir pelo do pacote** — sobrescreve o projeto existente com o conteúdo do pacote (única opção da lista que é destrutiva; vale reaproveitar `ConfirmDialog.tsx` como uma segunda confirmação só pra esta opção, dado o precedente do projeto de nunca destruir dado sem confirmação explícita).
3. **Importar como novo** — grava o projeto do pacote com um slug novo (mesmo mecanismo de unicidade de `ConflitoRestauracaoModal.tsx`/`slugify`, referenciado na Demanda 3), preservando os dois projetos lado a lado.

Isso é uma sugestão baseada no padrão já existente no projeto para conflito de slug (Demanda 3, `ConflitoRestauracaoModal.tsx`) — não foi confirmado por você ainda. Se as 3 opções não forem o que você imaginou, é só ajustar aqui antes da Etapa 1 começar.

Quando o pacote tem mais de um projeto conflitante, os modais aparecem em sequência (um projeto por vez, mesma lógica de cascata já usada nos wizards de "Atualizar Planilha" da Demanda 3) — não em lote, conforme fechado na conversa.

## 5. Achados de código relevantes (herdados da Etapa 0 original, ainda válidos)

- **`jszip` já é dependência do projeto** — usado client-side em `exportarPlanilha.ts` (import dinâmico) e server-side em `vite.config.ts` (`logsApiPlugin`/`handleExportarLogs`, import estático). Reaproveitável sem instalar nada novo.
- **Padrão de escrita atômica já existe** — `vite.config.ts` usa `fs.renameSync` em vários handlers (`projetosApiPlugin`) pra nunca deixar o sistema num estado parcialmente escrito. A extração de cada projeto do pacote pra `data/active/<slug>/` deve seguir o mesmo critério: extrair pra um diretório temporário, validar, e só então `fs.renameSync` — agora **por projeto**, não mais para o `data/` inteiro de uma vez (mudança em relação ao mapeamento original).
- **`ConfirmDialog.tsx`** é o componente genérico certo pra confirmar a opção destrutiva "Substituir pelo do pacote" (seção 4).
- **Convenção `src/services/*Api.ts`** — todo outro fluxo do sistema tem um wrapper client-side próprio (`emailsApi.ts`, `lixeiraApi.ts`, `logsApi.ts`, `projetosApi.ts`); o novo fluxo segue o mesmo padrão.
- **Dualidade de contexto Home vs. projeto aberto já existe** — `Header.tsx` já resolve isso pra "Exportar Planilha" (`onAtivarSelecaoExportacao` presente = Home/lote; ausente = projeto aberto/direto) e pra "Deletar Planilha" (`onAtivarSelecaoDelecao`). "Exportar Projetos" replica exatamente esse padrão, só que abrindo o fluxo novo em vez do `ExportarModal` existente.
- **Submenu inline sem fechar o dropdown principal já existe** — "Atualizar Planilha" usa `submenuAtualizarAberto`, independente de `menuAberto`. "Exportar Planilha" precisa do mesmo tratamento (novo estado `submenuExportarAberto`) pra abrir o submenu com as 2 opções.

## 6. Decisões

- ~~Disaster recovery do sistema inteiro faz parte desta demanda?~~ → **Não.** Removido do escopo (seção 1). `data/trash/` e `data/logs/` continuam sem cópia de segurança.
- ~~Onde fica o botão de Importar?~~ → **Dropdown "Importar" na Home**, com "Importar Planilha" (atual) e "Importar Projetos" (novo), cada um com ícone `[i]` de resumo (seção 2).
- ~~Granularidade da restauração?~~ → **Sempre aditiva.** Nunca substitui `data/` inteiro; projetos sem conflito são adicionados, mantendo os existentes intocados.
- ~~Onde fica o botão de Exportar?~~ → **Submenu "Exportar Planilha" no dropdown de Configurações do `Header.tsx`**, mesmo padrão visual de "Atualizar Planilha": "Exportar Planilha" (atual) e "Exportar Projetos" (novo).
- ~~"Exportar Projetos" funciona em lote pela Home?~~ → **Sim**, mesma dualidade que "Exportar Planilha" já tem hoje (1 projeto na página do projeto, N projetos via seleção múltipla na Home).
- ~~Conflito de slug/nome na importação?~~ → **Modal de conflito por projeto**, decisão caso a caso (não em lote). Opções do modal listadas na seção 4 são sugestão desta revisão, a confirmar.

## 7. Ajuste cruzado necessário na Demanda 9 (Logs de Alterações)

A taxonomia fechada de `acao` (`DEMANDAS.md`, seção "Demanda 9") precisa de 2 novos tipos, seguindo o mesmo espírito de "adicionável" já previsto lá (mudança de código, não de interface):

| Tipo | Gatilho |
|---|---|
| `exportar_projetos` | Empacotamento de 1+ projetos num `.zip` de portabilidade (distinto de `exportar_planilha`, que é a exportação CSV/XLSX/PDF de uma planilha) |
| `importar_projetos` | Extração de 1+ projetos de um pacote pra `data/active/` — uma linha por projeto efetivamente gravado (adicionado, substituído ou importado como novo), seguindo o mesmo critério de "uma linha por mutação real" já usado por `alterar_planilha` |

Ações "vazias" (ex.: pacote importado onde todos os projetos foram resolvidos como "Manter o atual") não geram log, mesmo critério já usado em toda a Demanda 9.

## 8. Etapas de Implementação `[Inicial]`

> Quebra preliminar — revisar ao iniciar.

**Etapa 1 — Modelo de pacote e utilitário de empacotamento ✅ concluída**
- Definir o schema do `manifest.json` (seção 3) em `src/types/` (nome a definir, ex. `types/pacoteProjetos.ts`).
- `src/scripts/utils/backup.ts` (renomear para `pacoteProjetos.ts`? — a confirmar, ver nota de nomenclatura) — funções de empacotar (ler `emails.json`+`sheet.<ext>` de N slugs, montar manifest, gerar `.zip` via `JSZip`) e desempacotar (ler `.zip`, validar manifest, listar conflitos contra os slugs existentes).

**Notas de execução (Etapa 1):**
- `src/types/pacoteProjetos.ts` criado: `VERSAO_PACOTE_PROJETOS`, `ProjetoDoManifesto`, `ManifestoPacoteProjetos` e o type guard `ehManifestoPacoteProjetosValido` (mesmo padrão de tipo+validador junto já usado em `types/log.ts`).
- `src/scripts/utils/backup.ts` → renomeado para `src/scripts/utils/pacoteProjetos.ts` (nomenclatura confirmada, sem mais pendência). Exporta `empacotarProjetos`, `desempacotarProjetos`, `detectarConflitos`, `nomeArquivoPacote` e a classe `PacoteInvalidoError`.
- `desempacotarProjetos` foi implementado **em memória** (via `JSZip.loadAsync`), sem gravar em diretório temporário — a extração/gravação atômica em `data/active/` citada na seção 5 ("Achados de código") fica a cargo do endpoint de importação (Etapa 3), que decide quando e onde tocar o disco. Ajuste de rota em relação à leitura literal da seção 5: aqui a função só valida e devolve os bytes já extraídos do `.zip`.
- Pequeno aproveitamento de escopo, sem mudar comportamento: os placeholders vazios criados na Etapa 0 com os nomes antigos (`backupApi.ts`, `BackupModal.tsx`) foram renomeados para os nomes já decididos (`pacoteProjetosApi.ts`, `ImportarProjetosModal.tsx`), e o placeholder vazio de `ConflitoImportacaoProjetoModal.tsx` (que faltava) foi criado — nenhum dos três tem conteúdo ainda, ficam para as Etapas 2/3/5/6.
- `slugEhSeguro`/`encontrarArquivoSheetExistente` de `vite.config.ts` foram duplicados localmente (`slugSeguro`/`encontrarArquivoSheet`) em vez de extraídos para um módulo compartilhado — não existe hoje um módulo comum entre o servidor de dev e os scripts para esse tipo de checagem, e criar um agora seria refatoração fora do escopo desta etapa.

**Etapa 2 — Endpoint de exportação ✅ concluída**
- Novo endpoint (`GET /api/projetos/pacote?slugs=a,b,c`, seguindo o padrão de `logsApiPlugin`/`handleExportarLogs`) que monta o `.zip` a partir dos slugs pedidos e devolve como download.

**Notas de execução (Etapa 2):**
- `handleExportarPacoteProjetos` adicionado a `vite.config.ts`, roteado dentro do já existente `projetosApiPlugin` (mesmo plugin de `POST`/`PATCH`/`DELETE /api/projetos`) — novo `GET` com `caminho === '/pacote'`, checado antes dos ramos de `PATCH`/`DELETE`/`POST` já existentes, já que é o único caso deste plugin com subcaminho fixo em vez de slug de projeto na URL.
- `slugs` lido de `URL.searchParams`, separado por vírgula, aparado e filtrado — mesmo critério de parsing simples já usado em `mesInicio`/`mesFim`/`formato` de `handleExportarLogs`.
- Resposta de erro mapeia `PacoteInvalidoError` (slug inválido, projeto inexistente ou sem planilha bruta) para 400 — `registrarErroServidor` foi ajustado para ignorar `PacoteInvalidoError` do mesmo jeito que já ignora `ApiError` (é uma resposta esperada, não uma falha real do servidor).
- Não chama `registrarLog` ainda — a instrumentação de `exportar_projetos`/`importar_projetos` na whitelist de `acao` é Etapa 7, feita junto do endpoint de importação (Etapa 3), para não duplicar a decisão de "uma linha por quê" antes das duas pontas existirem.
- `nomeArquivoPacote()` (Etapa 1) é reaproveitado sem alteração para o nome do arquivo baixado.

**Etapa 3 — Endpoint de importação (2 fases: preview + confirmação) ✅ concluída**
- `POST /api/projetos/pacote/preview` — recebe o `.zip`, valida estrutura mínima, extrai pra um diretório temporário, devolve a lista de projetos do manifest + quais colidem com slugs existentes. Não escreve nada em `data/active/` ainda.
- `POST /api/projetos/pacote/confirmar` — recebe as decisões por projeto conflitante (manter/substituir/novo slug) + a lista de não-conflitantes, e aplica cada gravação com escrita atômica por projeto (`fs.renameSync`, seção 5).

**Notas de execução (Etapa 3):**
- Diretório de estágio novo, `data/tmp/<pacoteId>/` (`tmpDirectory`, `vite.config.ts`) — irmão de `data/active/` e `data/trash/`, mas efêmero: `handlePreviewImportacaoPacote` grava (`estagiarPacote`), `handleConfirmarImportacaoPacote` sempre limpa ao final (`finally`, sucesso ou erro). `pacoteId` é um `crypto.randomUUID()`, validado no `confirmar` contra o formato esperado (`REGEX_PACOTE_ID`) antes de virar caminho no disco.
- Pacotes em estágio não confirmados expiram sozinhos: expurgo oportunista (`limparPacotesTemporariosExpirados`, TTL de 2h) no início de cada novo preview — mesmo critério já usado pela lixeira (30 dias, `handleListarLixeira`), só que aqui a limpeza acontece na rota de *criação* do próximo estágio, não na de listagem (não existe uma rota de "listar pacotes em estágio").
- **Novo diretório em runtime:** `data/tmp/` é criado sob demanda (`fs.mkdirSync(..., { recursive: true })`), mesmo padrão de `data/trash/`. Se o projeto tiver um `.gitignore` cobrindo `data/`, nada a fazer; caso cubra `data/active`/`data/trash` explicitamente em vez de `data/*`, `data/tmp/` precisa ser adicionado — arquivo não incluído neste ZIP para eu confirmar.
- **Ajuste de rota em relação à seção 4 do planner:** a opção "Importar como novo" não usa `slugify.ts`/o mecanismo de `ConflitoRestauracaoModal.tsx` (Demanda 3) como a seção 4 sugeria — esse arquivo não veio no ZIP de Etapa 0 desta demanda (não estava listado como Fonte). Em vez disso, o **client** (Etapa 6, `ConflitoImportacaoProjetoModal.tsx`) vai decidir/sugerir o `novoSlug` da forma que fizer sentido na UI, e o **servidor** só valida: `slugEhSeguro` + checagem real contra o disco (409 se já existir) — mesmo critério de "conveniência de UX no client, garantia real no servidor" já usado em `POST /api/projetos` e `PATCH /api/projetos/:slug`. Sem dependência de um gerador de slug único específico.
- `substituirProjetoAtivo` (opção "Substituir pelo do pacote") move o projeto ativo pra um nome temporário (`<slug>.substituido-tmp`) antes de mover o estagiado pro lugar, só apagando o temporário depois — evita uma janela sem nenhuma das duas versões caso o processo seja interrompido no meio. A operação continua destrutiva na ponta final (o planner já previa isso; a segunda confirmação via `ConfirmDialog.tsx` é responsabilidade do client, Etapa 6).
- `handleConfirmarImportacaoPacote` trata cada projeto do manifesto de forma independente (mesmo critério de `DELETE /api/projetos`): decisão faltando ou `novoSlug` colidindo falha só aquele projeto, resposta 207 se algum item falhar, 200 se todos passarem. Projetos sem conflito (slug não existe em `data/active/`) são sempre gravados direto, sem exigir entrada em `decisoes`.
- Nenhuma chamada a `registrarLog` ainda (mesma decisão da Etapa 2) — `exportar_projetos`/`importar_projetos` na whitelist de `acao` é Etapa 7, feita de uma vez para os dois endpoints agora que ambos existem.

**Etapa 4 — Submenu "Exportar Planilha" no `Header.tsx` ✅ concluída**
- Novo estado `submenuExportarAberto`, espelhando `submenuAtualizarAberto`.
- Novo item "Exportar Projetos"; na Home, ativa seleção múltipla com uma nova variante de `acaoPendente` (ex.: `'exportar-projetos'`, ao lado de `'exportar'`/`'deletar'` já existentes em `pages/home.tsx`); na página do projeto, abre o fluxo direto para o slug atual.

**Notas de execução (Etapa 4):**
- `src/services/pacoteProjetosApi.ts` deixou de estar vazio: `exportarProjetos(slugs)` implementado (consome `GET /api/projetos/pacote`, Etapa 2), com o mesmo trio local `extrairMensagemDeErro`/`nomeArquivoDeContentDisposition`/`baixarBlob` já duplicado em `logsApi.ts`/`exportarPlanilha.ts` — sem util compartilhado entre os módulos, mesmo critério do resto do projeto. Não chama `registrarLogCliente`: a instrumentação de `exportar_projetos` é responsabilidade do próprio endpoint (Etapa 7), diferente de `exportarPlanilha.ts`.
- `Header.tsx`: item "Exportar planilha" do dropdown principal virou um grupo (`app-header-config-item-grupo`) com submenu inline (`submenuExportarAberto`, mesmo padrão de `submenuAtualizarAberto`), reaproveitando as classes CSS já existentes do submenu de "Atualizar planilha" — nenhuma classe nova precisou ser criada. Duas opções: "Exportar Planilha" (fluxo já existente, sem mudança de comportamento) e "Exportar Projetos" (novo — `handleClicarExportarProjetos`/`exportarProjetoAtual`). Item do grupo agora habilitado por `onAtivarSelecaoExportacao || onAtivarSelecaoExportacaoProjetos || projetoAberto` (antes só considerava `onAtivarSelecaoExportacao`/`projetoAberto`), já que a Home passa a ter dois motivos possíveis para o grupo ficar habilitado. `fecharMenu()` passou a fechar os dois submenus (`submenuAtualizarAberto` e `submenuExportarAberto`) juntos com o dropdown principal — mesmo tratamento em todo ponto de saída (clique fora, Esc, escolha de item), sem efeito derivando um estado do outro.
- `handleClicarExportarProjetos`: mesma dualidade Home/projeto aberto de `handleClicarExportarPlanilha`/`handleClicarDeletarPlanilha` — com `onAtivarSelecaoExportacaoProjetos` presente (Home), delega e fecha o menu; sem ela (página do projeto), dispara `exportarProjetoAtual()` direto para o `slug` da tela. Erro de rede fica em `erroExportarProjetos` (estado novo, mesmo padrão de `erroDelecao`, exibido junto ao cabeçalho) — a exportação não navega nem recarrega a página, diferente da exclusão.
- `pages/home.tsx`: `acaoPendente` ganhou a variante `'exportar-projetos'`; `ativarSelecaoExportacaoProjetos` (passada ao Header) e `concluirExportacaoProjetosLote` (chamada por `handleConcluirSelecao` quando essa variante está ativa) seguem o mesmo par de funções já usado por `'exportar'`/`abrirExportacaoLote`. Diferença notada no código: como não há modal intermediário (o pacote baixa direto via `exportarProjetos`), sucesso já chama `cancelarModoSelecao()` dentro da própria função, em vez de esperar o fechamento de um modal (`fecharModalExportarLote`) — mesmo padrão do fluxo de exclusão em lote. Erro fica em `erroExportacaoProjetosLote` (estado novo, mesmo lugar/estilo de `erroDelecaoLote`), e mantém o modo de seleção aberto para nova tentativa. O rótulo do botão "Concluir" da barra de seleção não muda entre ações (confirmado na seção 2 do plano) — nenhuma mudança de texto condicional foi adicionada.
- Nenhuma dependência nova, nenhuma alteração em `vite.config.ts` (Etapa 4 é só client-side) nem em CSS (classes do submenu de "Atualizar planilha" reaproveitadas sem alteração).
- Pendência para a Etapa 8 (teste manual): confirmar visualmente o grupo/submenu novo no navegador — não foi possível rodar a aplicação nesta sessão.

**Etapa 5 — Dropdown "Importar" na Home ✅ concluída**
- `pages/home.tsx`: botão "Importar planilha" vira dropdown com as 2 opções + ícone `[i]` (textos da seção 2).
- "Importar Projetos" abre o seletor de arquivo `.zip`, chama o preview (Etapa 3), mostra o resumo dos projetos contidos.

**Notas de execução (Etapa 5):**
- A maior parte desta etapa já tinha chegado pronta no ZIP recebido no início desta sessão: dropdown "Importar" completo em `pages/home.tsx` (`dropdownImportarAberto`, abrir/fechar por clique fora e Esc — mesmo padrão de `submenuAtualizarAberto`/`submenuExportarAberto` do `Header.tsx`), `IconeInformacao`/`InfoTooltip` locais com os 2 textos da seção 2, input de arquivo `.zip` (`inputArquivoProjetosRef`/`arquivoProjetosSelecionado`/`handleArquivoProjetosEscolhido`), `previewImportacaoPacote` em `pacoteProjetosApi.ts` (consumindo `POST /api/projetos/pacote/preview`, Etapa 3) e o próprio `ImportarProjetosModal.tsx` (chama o preview ao montar, mostra contagem de registros por projeto e sinaliza conflitos via `resultado.conflitos`).
- **O que faltava de fato:** `ImportarProjetosModal` estava importado em `pages/home.tsx` mas nunca renderizado — `arquivoProjetosSelecionado` era setado pelo input mas nada consumia esse estado. Adicionado o bloco `{arquivoProjetosSelecionado && <ImportarProjetosModal ... />}` ao lado do bloco equivalente do `ImportWizardModal`, fechando com `fecharImportarProjetos` (já existente, mesmo papel de `fecharAssistenteImportacao`).
- Nenhuma mudança em `pacoteProjetosApi.ts`, `ImportarProjetosModal.tsx`, `Header.tsx` ou `vite.config.ts` — todos já corretos para o escopo desta etapa.
- Pendência já prevista (seção 9, `Icons.tsx`): `IconeInformacao` continua definida localmente em `pages/home.tsx` em vez de `components/Icons.tsx`, porque esse arquivo não veio nesta sessão (não listado como Fonte). Mover para lá quando o arquivo completo estiver disponível.
- Pendência para a Etapa 8 (teste manual): confirmar visualmente o dropdown "Importar" e o preview do pacote no navegador — não foi possível rodar a aplicação nesta sessão.
- Etapa 6 (`ConflitoImportacaoProjetoModal.tsx`) segue vazia — nada desta etapa a mais foi antecipado além do que já estava no ZIP recebido.

**Etapa 6 — Modal de conflito ✅ concluída**
- Novo componente (ex. `ConflitoImportacaoProjetoModal.tsx`), reaproveitando o casco visual dos modais de conflito já existentes (`ConflitoRestauracaoModal.tsx` como referência mais próxima).
- Exibido em cascata, um projeto conflitante por vez (seção 4).
- Opção "Substituir pelo do pacote" passa por uma segunda confirmação via `ConfirmDialog.tsx` antes de aplicar.

**Notas de execução (Etapa 6):**
- A implementação já veio pronta no ZIP recebido no início desta sessão (`ConflitoImportacaoProjetoModal.tsx` preenchido, `confirmarImportacaoPacote` em `pacoteProjetosApi.ts`, e a fase 2/3 completa em `ImportarProjetosModal.tsx`) — o trabalho desta sessão foi de auditoria/fechamento, não de escrita de código novo.
- **Conferido linha a linha contra o contrato do servidor** (`handleConfirmarImportacaoPacote`, `vite.config.ts`, Etapa 3): `DecisaoConflitoPacote` (client) e `DecisaoConflito` (server) têm o mesmo formato (`slug`/`acao`/`novoSlug?`); os 4 resultados possíveis (`adicionado`/`mantido`/`substituido`/`importado_como_novo`) batem nos dois lados, incluindo `novoSlug` só presente quando `resultado === 'importado_como_novo'`; tratamento de `207` (falha parcial, sem lançar exceção) em `confirmarImportacaoPacote` está correto e é consumido certo por `ImportarProjetosModal` (`resultadoConfirmacao.ok` distingue sucesso total de parcial, cada item mostra `error` quando `ok === false`).
- **Ajuste de rota confirmado (herdado da Etapa 3):** como `ConflitoRestauracaoModal.tsx`/`slugify.ts` (Demanda 3) nunca vieram no ZIP desta demanda, `ConflitoImportacaoProjetoModal.tsx` não reaproveita esse mecanismo — implementa sugestão própria de `novoSlug` (`sugerirNovoSlug`, sufixo `-importado`/`-importado-2`/...) e uma checagem client-side mínima (`slugPareceSeguro`), com a garantia real permanecendo no servidor (`slugEhSeguro` + checagem contra o disco, 409 em colisão). Documentado no próprio componente.
- Cascata de conflitos verificada em `ImportarProjetosModal.tsx`: `handleResolverConflito` acumula decisões e avança `indiceConflitoAtual`; no último conflito da fila, dispara `confirmarComDecisoes` diretamente (sem esperar fechamento de modal) — mesmo critério já usado por outros fluxos em lote deste projeto. "Cancelar importação" dentro do modal de conflito e "Cancelar" do resumo levam ao mesmo `handleCancelarImportacao` — correto, já que nada é gravado em `data/active/` antes da confirmação (só o estágio efêmero em `data/tmp/`).
- Segunda confirmação da opção "Substituir pelo do pacote" via `ConfirmDialog.tsx` confirmada como aninhada corretamente dentro do `Dialog` do conflito (`confirmandoSubstituicao`) — só chega a `onResolver` depois de confirmada, nunca direto do "Aplicar".
- **Pendência nova identificada nesta auditoria:** as classes CSS específicas deste modal (`modal-conflito-importacao-projeto`, `conflito-importacao-comparacao`, `conflito-importacao-lado`, `conflito-importacao-opcoes`, `conflito-importacao-opcao`, `conflito-importacao-novo-slug`) são inéditas — diferente das Etapas 4/5, que só reaproveitaram classes já existentes, esta etapa não tem nenhum estilo definido ainda porque o arquivo de CSS do projeto não veio em nenhum ZIP desta demanda (mesmo critério de `Icons.tsx`/`data/projetos.ts`, não listados como Fonte). O componente funciona, mas renderiza sem estilo até o CSS ser adicionado — precisa do arquivo de estilos atual para escrever as regras sem duplicar/colidir com convenções já existentes.
- Nenhuma mudança de código foi necessária nesta sessão — `ConflitoImportacaoProjetoModal.tsx`, `pacoteProjetosApi.ts` e `ImportarProjetosModal.tsx` já estavam corretos e consistentes com o planner e com o servidor.

**Etapa 7 — Instrumentação de logs (Demanda 9) ✅ concluída**
- Adicionar `exportar_projetos`/`importar_projetos` à whitelist de `registrarLog` (seção 7).
- Chamar `registrarLog` nos dois novos endpoints (Etapas 2 e 3).

**Notas de execução (Etapa 7):**
- Chamadas a `registrarLog` adicionadas em `vite.config.ts`: `handleExportarPacoteProjetos` grava **uma linha por empacotamento** (`registrarLog('exportar_projetos', { projetos: slugs })`, após o `.zip` já estar montado com sucesso — nunca antes), diferente de `importar_projetos`, que grava **uma linha por projeto efetivamente gravado**, dentro do `.map` de `handleConfirmarImportacaoPacote`: nos 3 ramos que escrevem em disco (`adicionado`, `substituido`, `importado_como_novo` — este último inclui `novoSlug` em `dados`), nunca no ramo `manter` (ação vazia, sem escrita real — mesmo critério de no-op já usado em toda a Demanda 9, seção 7).
- **Bloqueio anterior resolvido nesta sessão:** `src/types/log.ts` e `src/scripts/utils/registrarLog.ts` chegaram (fora do ZIP desta demanda, enviados avulsos). `'exportar_projetos'`/`'importar_projetos'` adicionados a `TIPOS_ACAO`; `DadosLog` ganhou `projetos?: string[] | null` (exportar), `resultado?: 'adicionado' | 'substituido' | 'importado_como_novo'` e `novoSlug?: string` (importar) — os três exatamente com o formato já usado pelas chamadas de `vite.config.ts`, nenhum ajuste de rota necessário do lado das chamadas.
- **Decisão de formato persistido:** `LinhaLogAcao` (o formato gravado em `data/logs/<AAAA-MM>.jsonl`) não ganhou campos novos — `projetos`/`resultado`/`novoSlug` são dobrados dentro de `atual` em `montarLinha` (`{ projetos }` para `exportar_projetos`; `{ resultado, novoSlug? }` para `importar_projetos`), reaproveitando o mesmo mecanismo genérico já usado pelo diff de `alterar_planilha`/`alterar_registro`, em vez de expandir a interface pra dois tipos de ação entre doze. `quantidade` de `exportar_projetos` é derivado de `projetos.length` (mesma semântica de `importar_planilha`/`reimportar_planilha`).
- Templates de `mensagem` adicionados em `montarMensagem`: `exportar_projetos` lista os slugs empacotados; `importar_projetos` varia por `resultado` (`adicionado`/`substituido`/`importado_como_novo`, este último citando o `novoSlug`).
- Ambas as ações entraram em `ACOES_SEMPRE_REAIS` — nem uma nem outra carrega um par `original`/`atual` comparável por valor, e a própria chamada (feita só depois do `.zip` montado, ou só nos ramos de `handleConfirmarImportacaoPacote` que de fato escrevem em disco) já é a confirmação de mudança real, mesmo critério de `restaurar_registro`.
- **Checagem de tipos:** como o restante da árvore (`node_modules`, resto de `src/`) não veio nesta sessão, não foi possível rodar o `build`/`tsc -b` completo do projeto. Em vez disso, isolei `types/log.ts` + `scripts/utils/registrarLog.ts` e typechequei contra réplicas literais das 4 chamadas reais de `vite.config.ts` (as 3 de `importar_projetos` com cada `resultado`, mais a de `exportar_projetos`) com `tsc --strict` — compilou limpo. Testei também o caminho negativo (`@ts-expect-error` num `acao` fora da whitelist e num `resultado` fora do union) pra confirmar que a validação de tipo de fato rejeita entrada inválida, não só "não reclamou por acaso". Ainda pendente: o `tsc -b`/`npm run build` real do projeto completo, quando a árvore inteira estiver disponível numa mesma sessão (mesma pendência já registrada nas Etapas 4/5 para teste manual no navegador).
- `DEMANDAS.md` continua não recebido nesta demanda (mesmo caso das etapas anteriores) — a seção revisada da taxonomia de `acao` da Demanda 9 segue em `DEMANDAS-Demanda9-SecaoRevisada.md`, pronta para colar no lugar certo quando o arquivo completo chegar.

**Etapa 8 — Teste manual**
- Exportar 1 projeto e um pacote com 3+ projetos; importar em uma instância sem nenhum dos slugs (caminho sem conflito) e em uma instância com slugs coincidentes (testar as 3 opções do modal de conflito).

## 9. Arquivos Necessários

**Arquivos Fonte** (referência, sem alteração):
- `src/components/utils/exportarPlanilha.ts` — uso client-side de `JSZip` já estabelecido.
- `vite.config.ts` — `logsApiPlugin`/`handleExportarLogs` (padrão de endpoint que gera `.zip`) e `projetosApiPlugin` (padrão de escrita atômica).
- `src/components/ConfirmDialog.tsx`, `src/components/Dialog.tsx` — reaproveitados sem alteração na Etapa 6.
- `src/components/ConflitoRestauracaoModal.tsx` — referência visual e de lógica (unicidade de slug) pro novo modal de conflito.
- `src/services/logsApi.ts` — padrão de wrapper client-side a seguir no novo service.
- `src/components/Header.tsx` — padrão de submenu inline (`submenuAtualizarAberto`) a replicar pra "Exportar Planilha".
- `src/pages/home.tsx` — padrão de dropdown/seleção múltipla (`acaoPendente`, `useSelecaoMultipla`) a estender.
- `package.json` — confirma `jszip` já presente.
- `src/types/log.ts` — ✅ recebido e atualizado (Etapa 7) — ver "Arquivos Alterados".
- `src/scripts/utils/registrarLog.ts` — ✅ recebido e atualizado (Etapa 7) — ver "Arquivos Alterados".

**Arquivos Alterados:**
- `vite.config.ts` ✅ **`GET /api/projetos/pacote` (Etapa 2), `POST /api/projetos/pacote/preview` e `POST /api/projetos/pacote/confirmar` (Etapa 3) implementados** *(ajuste de rota: todos entraram no `projetosApiPlugin` já existente, não um plugin novo — ver notas de execução da Etapa 2/3)*; ✅ **chamadas a `registrarLog('exportar_projetos'/'importar_projetos', ...)` (Etapa 7), agora validadas pela whitelist atualizada de `TipoAcao`**.
- `src/components/Header.tsx` ✅ **submenu "Exportar Planilha" com as 2 opções implementado (Etapa 4)**.
- `src/pages/home.tsx` ✅ **nova variante de `acaoPendente` (`'exportar-projetos'`) e disparo em lote implementados (Etapa 4)**; ✅ **dropdown "Importar" com as 2 opções + ícone `[i]`, e `ImportarProjetosModal` agora efetivamente renderizado ao escolher um `.zip` (Etapa 5)**.
- `src/types/log.ts` ✅ **`'exportar_projetos'`/`'importar_projetos'` adicionados a `TIPOS_ACAO`; `DadosLog` ganhou `projetos`/`resultado`/`novoSlug` (Etapa 7)**.
- `src/scripts/utils/registrarLog.ts` ✅ **templates de `mensagem`, montagem de `atual` e `ACOES_SEMPRE_REAIS` atualizados para `exportar_projetos`/`importar_projetos` (Etapa 7)**.
- `DEMANDAS.md` — seção da Demanda 9 (taxonomia de `acao`) ganha as 2 linhas novas (Etapa 7) — 🟡 **arquivo não recebido nesta demanda; trecho pronto para colar em `DEMANDAS-Demanda9-SecaoRevisada.md`**.

**Arquivos Criados:**
- `src/types/pacoteProjetos.ts` ✅ **implementado (Etapa 1)** — schema do manifest e type guard de validação.
- `src/scripts/utils/pacoteProjetos.ts` ✅ **implementado (Etapa 1)** *(renomeado de `backup.ts`)* — empacotar/desempacotar.
- `src/services/pacoteProjetosApi.ts` ✅ **`exportarProjetos` (Etapa 4), `previewImportacaoPacote` (Etapa 5) e `confirmarImportacaoPacote` (Etapa 6) implementados** *(renomeado de `backupApi.ts`)* — nada pendente neste arquivo.
- `src/components/ImportarProjetosModal.tsx` ✅ **implementado (Etapas 5-6)** *(renomeado de `BackupModal.tsx`, removido)* — preview, cascata de resolução de conflitos e confirmação, as 3 fases completas.
- `src/components/ConflitoImportacaoProjetoModal.tsx` ✅ **implementado (Etapa 6)** — modal de conflito por projeto, cascata + segunda confirmação para "Substituir pelo do pacote"; falta estilo CSS (ver notas de execução da Etapa 6).

**Dependência nova:** nenhuma — `jszip` já está no projeto.