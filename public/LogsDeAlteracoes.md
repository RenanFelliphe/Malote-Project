# Logs de Alterações

> Documento de implementação autocontido da **Demanda 9** (ver `DEMANDAS.md`, seção "Registro de Demandas"). Ao final, sua execução completa deixa a Demanda 9 pronta para ser marcada como **Concluída** em `DEMANDAS.md`.

## 1. Contexto

O **Sistema de Organização e Envio de E-mails** não guarda hoje nenhum rastro de "o que aconteceu no sistema". Toda mutação — criar projeto, editar registro, restaurar da lixeira, reimportar planilha — acontece e não deixa vestígio nenhum além do estado final. Conforme a lógica de merge (`calcularMerge.ts`, Demanda 3), `backup_dados` (Demanda 5) e mapeamento de ID (Demanda 7) acumula complexidade, perguntas como "por que esse registro ficou com esse ID?" ou "quando essa planilha foi reimportada?" ficam cada vez mais frequentes e cada vez mais difíceis de responder sem um log.

Esta demanda nasceu como sucessora direta da **Demanda 4 (Histórico de Alterações)**, que ficou pausada: a Demanda 4 propunha snapshot completo do estado de um projeto a cada alteração, com restauração ("desfazer"). Este documento cobre algo deliberadamente mais simples — só rastro, sem capacidade de restauração — e mais abrangente: cobre o sistema inteiro (qualquer alteração feita via interface, em qualquer projeto ou configuração), não só os projetos individualmente.

Diferente da Demanda 3, este documento não parte de um botão já existente e desabilitado — a tela `/logs` e o botão "Visualizar Logs" no `Header` são inteiramente novos.

## 2. Escopo

**Cobre:**
- Uma linha em `data/logs/<AAAA-MM>.jsonl` para toda e qualquer alteração feita via interface — não só por projeto, mas do sistema como um todo.
- Ações que na prática disparam mais de uma mutação real a partir do mesmo clique (ex.: o modal "Atualizar Planilha" pode renomear o projeto **e** alterar dados/colunas ao mesmo tempo) emitem uma linha por mutação de fato ocorrida, todas com a mesma tag (`alterar_planilha`), diferenciadas pelos demais atributos (`mensagem`, `original`, `atual`).
- Ações em massa (ex.: reimportar planilha com milhares de registros) geram **uma única linha**, com a contagem refletida em `mensagem`/`quantidade` — sem detalhamento individual por registro nesta fase.
- Ações "vazias" (modal aberto e confirmado sem nenhuma mudança real, em qualquer tipo) **não** geram log — mesmo critério já usado por `restaurarCampos.ts`, que não grava `last_updated` quando nada muda de fato.
- Tela dedicada em `/logs`, acessível por um botão "Visualizar Logs" no dropdown de configurações/funções do `Header`, somente leitura — sem edição ou exclusão de log via interface, em nenhuma hipótese.
- Captura de erro não tratado, tanto no servidor quanto no cliente, sem ação de usuário por trás (`erro_servidor`/`erro_cliente`).
- Endpoint `POST /api/logs`, chamado pelo frontend, usado tanto para registrar a exportação de planilha (`exportarPlanilha.ts`, hoje 100% client-side) quanto para relatar erros do cliente.
- Exportação dos próprios logs, por mês ou intervalo de meses, em CSV ou JSON.
- Rotação mensal do arquivo de log, sem poda — nunca deleta arquivo antigo.
- Taxonomia fechada de `acao` (12 tipos, seção 4), pensada para ser "adicionável" no futuro (por código, nunca por interface) sem quebrar o que já existe.
- Flag de ambiente (`.env`, `LOGS_ATIVOS=false`) para desativar a escrita de logs durante desenvolvimento local, sem exposição na interface.

**Não cobre nesta fase:**
- Detalhamento individual de itens dentro de uma ação em massa (ex.: ver os 4000 registros de uma reimportação, um a um). Fica registrado como possível evolução futura (arquivo de detalhe separado por ação), não implementado agora.
- Log de troca de tema (Demanda 8) — puramente client-side, sem mutação no servidor.
- Autoria da alteração — sistema é single-user local, sem login, mesma ressalva já registrada na Demanda 4.
- Poda/expiração de logs antigos — nunca deve existir, dado que log não pode ser editado/deletado via interface.
- Qualquer forma de editar/deletar/restaurar um log pela interface.
- Ativar/desativar o registro de logs pela interface — controle fica só em variável de ambiente.
- Cache em memória ou índice de offsets para leitura — otimização prematura dado o volume esperado (uso local/pessoal).
- Restauração de estado a partir de um log (isso é a Demanda 4, pausada, não esta).
- Atalhos pré-filtrados a partir de outras telas (ex.: "ver logs deste projeto") — acesso só pelo botão genérico do `Header` nesta fase.

## 3. Modelo de dados e endpoints

**Armazenamento:**

```
data/logs/
  2026-08.jsonl   # rotação mensal, um arquivo por mês
  2026-09.jsonl   # mês corrente — criado automaticamente no primeiro appendFile
  ...
```

- `data/logs/` é criado automaticamente (`mkdir -p` equivalente) na primeira escrita — não precisa existir de antemão.
- Nunca há poda: todo arquivo mensal permanece para sempre.
- Ações e erros (`erro_servidor`/`erro_cliente`) ficam misturados no mesmo arquivo mensal — a separação em "Ações" vs "Erros" acontece só na leitura/exibição (seção 6), não no armazenamento.

**Endpoints:**

| Rota | Método | Uso | Status |
|---|---|---|---|
| `/api/logs` | `POST` | Recebe eventos que não nascem de um handler de mutação existente: confirmação de `exportar_planilha` e relatos de `erro_cliente` | Novo |
| `/api/logs` | `GET` | Lista logs com busca, filtro e paginação (seção 6) | Novo |
| `/api/logs/export` | `GET` | Gera o arquivo (ou `.zip`) de exportação de log por mês/intervalo (seção 6) | Novo |

Todos os handlers de mutação existentes (`vite.config.ts`) passam a chamar o utilitário central de log (seção 5) diretamente, em vez de precisar de um endpoint próprio — só o cliente (planilha exportada, erro de UI) precisa de um caminho de rede até o servidor, daí o `POST /api/logs`.

## 4. Taxonomia de `acao`

| Tipo | Gatilho |
|---|---|
| `importar_planilha` | Criação de projeto (upload inicial) |
| `alterar_planilha` | Renomear projeto e/ou remapear colunas/dados via modal "Atualizar Planilha" — pode emitir mais de uma linha por clique |
| `reimportar_planilha` | Reimportação/merge de uma nova planilha sobre um projeto existente |
| `deletar_projeto` | Soft delete (projeto vai pra lixeira) |
| `restaurar_projeto` | Projeto sai da lixeira |
| `deletar_projeto_permanente` | Exclusão definitiva a partir da lixeira |
| `exportar_planilha` | Exportação (CSV/XLSX/PDF), via `POST /api/logs` |
| `alterar_registro` | Qualquer alteração de campo em um registro — inclui marcar como deletado (`status → deletado`) e como enviado (`status → enviado`); a diferenciação vem de `original`/`atual`/`mensagem`, não de um tipo separado |
| `restaurar_registro` | Reverter campos protegidos (`nome`/`email`/`status`) a partir de `backup_dados` |
| `editar_email` | Qualquer alteração no conteúdo de e-mail do projeto (`EmailConteudo`): assunto, corpo, anexos (quando existir) e demais atributos futuros — sem exigir novo tipo a cada novo atributo |
| `erro_servidor` | Erro não tratado no servidor, incluindo falha ao gravar uma linha de log (tentativa única, sem loop) |
| `erro_cliente` | Exception não tratada na UI (`window.onerror`/error boundary) ou resposta de API 4xx/5xx |

A taxonomia é fixa no código (whitelist validada pelo utilitário central de log) — não existe interface para o usuário criar um tipo de log novo. "Adicionável" significa mudança de código, como a inclusão dos dois tipos de erro acima.

**Formato da linha (ação normal):**

```json
{
  "id": "20260903-153042-a1b2",
  "data": "2026-09-03T15:30:42.123Z",
  "acao": "alterar_registro",
  "projeto": "campanha-outubro",
  "registroId": "reg-0231",
  "quantidade": null,
  "original": { "status": "pendente" },
  "atual": { "status": "enviado" },
  "mensagem": "Status alterado: pendente → enviado"
}
```

- Ações em massa: `original`/`atual` ficam `null`, resumo vai só em `mensagem`/`quantidade` (ex.: `"4000 registros inseridos"`).
- `editar_email`: `original`/`atual` sempre indicam qual campo foi tocado (ex.: `{"campo": "assunto", "de": "...", "para": "..."}`).
- `id` no formato `AAAAMMDD-HHMMSS-xxxx` — ordena naturalmente por data sem precisar ler o arquivo inteiro.
- `mensagem` é sempre montada por um template fixo por `acao`, nunca texto livre escrito por um handler.

**Formato da linha (erro, sem ação de usuário por trás):**

```json
{
  "id": "20260904-101512-e5f6",
  "data": "2026-09-04T10:15:12.000Z",
  "acao": "erro_servidor",
  "origem": "servidor",
  "projeto": null,
  "registroId": null,
  "quantidade": null,
  "original": null,
  "atual": null,
  "mensagem": "Falha ao gravar log de alterar_registro: EACCES",
  "detalhe": "Error: EACCES: permission denied\n    at Object.appendFileSync (node:fs:...)\n    at registrarLog (registrarLog.ts:42)\n    ..."
}
```

`origem` é `"servidor"` ou `"cliente"`. `detalhe` guarda o stack trace completo quando existir (erro JS não tratado) ou o corpo da resposta de erro quando for um 4xx/5xx sem exception por trás.

## 5. Utilitário central de log

Função única, chamada por todo handler de mutação e por todo ponto de captura de erro — nenhum outro lugar do código escreve em `data/logs/` diretamente. Responsabilidades:

1. **Valida `acao`** contra a whitelist fixa da seção 4 — rejeita qualquer valor fora dela.
2. **Checa o flag de ambiente `LOGS_ATIVOS`** logo no início — se `false`, retorna sem escrever nada. Nenhum handler precisa saber disso; a decisão fica centralizada aqui.
3. **Monta `mensagem`** a partir de um template fixo por `acao` e dos parâmetros estruturados recebidos.
4. **Resolve o arquivo mensal correto** (`data/logs/<AAAA-MM>.jsonl`, com base na data atual), criando `data/logs/` automaticamente se ainda não existir.
5. **Não grava nada quando a ação não resultou em mudança real** — mesmo critério de `restaurarCampos.ts` para `last_updated`.
6. **`appendFile`**, envolvido em `try/catch`: se falhar, tenta gravar uma única linha `erro_servidor` sobre essa falha; se essa segunda gravação também falhar, só `console.error`, sem nova tentativa — evita loop infinito de "log tentando logar sua própria falha".

Assinatura conceitual (nome/local exatos a definir na Etapa 1):

```ts
function registrarLog(
  acao: TipoAcao,              // whitelist da seção 4
  dados: {
    projeto?: string | null;
    registroId?: string | null;
    quantidade?: number | null;
    original?: Record<string, unknown> | null;
    atual?: Record<string, unknown> | null;
    origem?: 'servidor' | 'cliente';  // só para erro_servidor/erro_cliente
    detalhe?: string;                  // só para erro_servidor/erro_cliente
  },
): void
```

## 6. Interface (tela `/logs`)

- **Acesso:** botão "Visualizar Logs" no dropdown de configurações/funções do `Header`, mesmo padrão visual dos outros itens do dropdown — sem atalhos a partir de outras telas nesta fase.
- **Layout:** tabela, com colunas `data`, `acao`, `projeto`, `mensagem` — as demais (`id`, `registroId`, `quantidade`, `original`, `atual`, `origem`/`detalhe`) ficam reservadas ao clicar numa linha, que abre um modal com o log completo.
- **Paginação:** fixa em 50 por página, sem opção de o usuário mudar o tamanho. Leitura sequencial por arquivo mensal (mês mais recente → mais antigo), com early-exit ao preencher a página pedida, em vez de ler todo o histórico a cada request — consistente com o padrão do resto do `vite.config.ts` (nenhum handler mantém cache em memória).
- **Busca/filtros:** sempre acima da tabela. Busca por nome, tipo, projeto, registroId ou id da alteração; filtro de data suporta dia único **e** intervalo (de/até). `data` sempre convertida do UTC gravado pro fuso horário local de quem está vendo.
- **Abas:** "Ações" e "Erros" separadas, alternadas por um switch. Trocar de aba mantém os filtros/busca/página aplicados (não reseta).
- **Estado vazio:** "Nenhum log encontrado".
- **Estado de erro** (falha real do `GET /api/logs`): mensagem distinta do estado vazio (ex.: "Erro ao carregar logs").
- **Indicador de ambiente:** banner somente-leitura quando `LOGS_ATIVOS=false` no ambiente atual — nunca um controle clicável.
- **Exportação:** botão "Exportar Logs" sempre visível. Exporta **por mês ou intervalo de meses** — nunca por resultado de busca/filtro, nunca um log específico. Seletor de formato (CSV ou JSON): JSON exporta a estrutura como está; CSV usa colunas fixas (`id, data, acao, projeto, registroId, quantidade, mensagem`) mais `alteracoes_de`/`alteracoes_para` (o `JSON.stringify` de `original`/`atual`), evitando achatar em colunas por campo. 1 mês selecionado → arquivo direto; mais de 1 mês → `.zip` com um arquivo por mês. A exportação em si **não gera log** — é leitura sobre o próprio log, mesmo raciocínio de `GET /api/lixeira` não ser logado.

## 7. Divisão em etapas

As Etapas 1–5 preparam a base (utilitário, instrumentação, endpoints de leitura/recepção); as Etapas 6–7 são a UI e a exportação, que dependem da base pronta.

---

## ⚠️ Fluxo de entrega por etapas — leia antes de começar

Para toda demanda implementada, o processo segue duas partes: uma etapa preliminar de mapeamento (Etapa 0) e a regra de entrega cumulativa que vale a partir da Etapa 1.

### Etapa 0 — Mapeamento ✅ concluída

Etapa preliminar, que roda antes da Etapa 1 de qualquer demanda. Único objetivo: reunir de uma vez o contexto necessário, para que as etapas seguintes não dependam mais do projeto inteiro sendo reenviado a cada troca.

1. A partir do planner da demanda (este arquivo), identificar todos os arquivos envolvidos na implementação — Fontes, Alterados e Criados — mesmo os que ainda não existem, mas estão previstos para etapas futuras.
2. Retornar um único ZIP contendo o planner da demanda + todos esses arquivos. Os "Criados" que ainda não foram implementados devem ser criados e guardados vazios.

A partir daqui, o usuário passa a enviar apenas o ZIP mais recente como referência — nunca mais o projeto inteiro.

**Nota de execução (Etapa 0):** ZIP montado com 22 arquivos — 5 Fonte (`restaurarCampos.ts`, `ExportarModal.tsx`, `Dialog.tsx`, `Paginacao.tsx`, `variables.css`) + 10 Alterados (`vite.config.ts`, `main.tsx`, `emailsApi.ts`, `lixeiraApi.ts`, `projetosApi.ts`, `exportarPlanilha.ts`, `Header.tsx`, `Icons.tsx`, `App.tsx`, `index.css`) já existentes, e 6 Criados (`registrarLog.ts`, `types/log.ts`, `services/logsApi.ts`, `pages/logs.tsx`, `.env`, `.env.example`, todos vazios — nenhuma etapa de implementação foi iniciada ainda), além deste planner. Detalhe e racional de cada arquivo na nova seção "Arquivos Necessários" (logo antes dos Critérios de Aceite).

Duas decisões de mapeamento que vale registrar: (1) `calcularMerge.ts` e os modais `AtualizarRegistrosModal.tsx`/`AtualizarDadosModal.tsx` **não** entraram na lista — a instrumentação de `alterar_planilha`/`reimportar_planilha` (Etapa 2) é feita inteiramente no servidor, comparando `dadosAtuais` (lido do disco) com `dados` (corpo da requisição) dentro dos handlers já existentes em `vite.config.ts`, sem precisar de nenhum dado adicional vindo do motor de merge client-side; (2) criei `src/services/logsApi.ts` como novo arquivo (não pedido explicitamente pelo planner original) seguindo a mesma convenção já usada por `emailsApi.ts`/`lixeiraApi.ts`/`projetosApi.ts` — um serviço dedicado por domínio — para centralizar as três chamadas de rede que o cliente precisa fazer (`POST /api/logs` na Etapa 3, `GET /api/logs` na Etapa 5, `GET /api/logs/export` na Etapa 7). Nenhum ajuste de rota necessário nesta etapa: nada do que foi encontrado no projeto diverge do que este planner já descrevia.

### Regra de entrega (Etapa 1 em diante)

A cada etapa, a entrega é **um único ZIP, cumulativo**:

- **Contém todos os arquivos necessários até aqui, não só os da etapa atual.** Isso inclui (a) todo arquivo efetivamente alterado desde a Etapa 1 desta revisão, e (b) todo arquivo listado como Fonte, Alterado ou Criado em qualquer etapa já concluída — mesmo os que nunca chegaram a ser modificados. Uma vez que um arquivo apareceu em algum ZIP, ele continua aparecendo em todos os ZIPs seguintes até o fim da implementação.
- **Sempre inclui o planner da demanda** (este arquivo), atualizado a cada entrega: etapas concluídas marcadas com "✅ concluída" no título, notas de execução preenchidas, e qualquer ajuste de rota registrado.

---

### Etapa 1 — Utilitário central de log ✅ concluída

**O que fazer:**
- Criar `registrarLog(acao, dados)` (seção 5): valida `acao`, checa `LOGS_ATIVOS`, monta `mensagem` por template fixo, resolve `data/logs/<AAAA-MM>.jsonl`, cria `data/logs/` se preciso, `appendFile` envolvido em `try/catch` com o guard anti-loop para `erro_servidor`.
- Adicionar `LOGS_ATIVOS` ao `.env`/`.env.example`.

**Por quê:** é a base de tudo o resto — nenhum handler deve escrever no arquivo de log diretamente.

**Nota de execução:** `TIPOS_ACAO`/`TipoAcao`/`DadosLog`/`LinhaLog` implementados em `src/types/log.ts` (novo); `registrarLog(acao, dados)` implementado em `src/scripts/utils/registrarLog.ts` (novo), seguindo a ordem exata da seção 5. Pontos de destaque:
- `LOGS_ATIVOS`: só o valor literal `"false"` desativa — ausência da variável (ou qualquer outro valor) mantém o registro ativo, conforme a seção 2 ("desativar durante desenvolvimento local").
- `houveMudancaReal`: ações com `quantidade` só gravam se `> 0`; ações com `original`/`atual` só gravam se algo de fato mudou (`JSON.stringify` dos dois lados); ações sem nenhum dos dois (`deletar_projeto`, `restaurar_projeto`, `deletar_projeto_permanente`, `importar_planilha`) sempre gravam — não têm noção de "no-op". `erro_servidor`/`erro_cliente` sempre gravam, sem passar por essa checagem.
- `montarMensagem`: implementei um helper `descreverDiferencas` compartilhado entre `alterar_planilha`, `alterar_registro`, `restaurar_registro` e `editar_email`, cobrindo os dois formatos da seção 4 (diff genérico por chave, e a forma dedicada `{ campo, de }`/`{ campo, para }` de `editar_email`). Para `erro_servidor`/`erro_cliente`, adicionei um campo `mensagem?: string` em `DadosLog` — única exceção à regra de "nunca texto livre", documentada no tipo, já que o conteúdo de um erro é inerentemente dinâmico (é assim que o próprio guard anti-loop constrói a mensagem "Falha ao gravar log de X: erro").
- Guard anti-loop implementado via recursão de profundidade máxima 1 (`gravarLinha(..., tentativaDeRecuperacao)`): na falha do `appendFileSync`, monta e tenta gravar uma linha `erro_servidor` sobre a própria falha; se essa segunda gravação falhar, só `console.error`, sem terceira tentativa.
- `data/logs/` resolvido via `path.resolve(process.cwd(), 'data', 'logs')` — mesma convenção já usada por `sync.ts` para `data/active/` (`resolve('data/active', slug, ...)`), assumindo que o processo sempre roda a partir da raiz do repositório.
- **Ajuste de rota:** `.gitignore` não estava na lista de "Arquivos Necessários" da Etapa 0 — adicionei `.env` a ele nesta etapa (mantendo `.env.example` versionado), já que o projeto não tinha nenhum padrão de `.env` antes desta demanda. Passa a fazer parte da lista cumulativa de Alterados a partir de agora.

Validado nesta sessão: `npm install` (projeto não tinha `node_modules`), `npx tsc -b` limpo (as 3 tsconfigs), `npm run lint` sem nenhum erro novo (os 4 arquivos com erro pré-existente — `LixeiraSidebar.tsx`, `Paginacao.tsx`, `QuantidadeInput.tsx`, `ThemeContext.tsx` — continuam com exatamente os mesmos erros de antes). Também rodei `registrarLog` manualmente via `ts-node/esm` (mesmo `TS_NODE_PROJECT=tsconfig.scripts.json` de `npm run sync`) cobrindo: ação simples, diff genérico, no-op (corretamente não gravado), `editar_email` (forma `campo`/`de`/`para`), ação em massa com `quantidade: 0` (corretamente não gravada) e com `quantidade: 4000`, tipo de ação inválido (corretamente rejeitado só com `console.error`) e `erro_cliente` com `mensagem` customizada — todas as linhas gravadas em `data/logs/2026-09.jsonl` bateram com o esperado. Não consegui validar de fato o guard anti-loop de falha de escrita nesta sessão: o sandbox roda como root, que ignora permissões de arquivo (`chmod 000` em `data/logs/` não bloqueou a escrita) — a lógica foi conferida por inspeção de código, recomendo um teste manual real (usuário sem privilégio, ou apontando para um caminho realmente inválido) antes de considerar o critério de aceite 8.2 ("falha simulada de escrita não trava a ação real") fechado de ponta a ponta. Arquivo/pasta de teste (`__testeRegistrarLog.ts`, `data/logs/`) removidos antes desta entrega — nenhum dos dois faz parte do ZIP.

### Etapa 2 — Instrumentar os handlers existentes ✅ concluída

**O que fazer:**
- `vite.config.ts`: `POST /api/projetos` (`importar_planilha`), `PATCH /api/projetos/:slug` + a parte de colunas/dados do fluxo "Atualizar Planilha" (`alterar_planilha`, possivelmente 2 chamadas no mesmo request), `POST /api/emails/:slug/sheet` (`reimportar_planilha`), `DELETE /api/projetos` (`deletar_projeto`), `POST /api/lixeira/restaurar` (`restaurar_projeto`), `DELETE /api/lixeira` (`deletar_projeto_permanente`).
- Handler de `PUT /api/emails/:slug`: `alterar_registro`, `restaurar_registro`, `editar_email`, conforme o que de fato mudou no payload.

**Por quê:** cobre a maior parte da taxonomia (9 dos 12 tipos) reaproveitando os pontos de mutação que já existem.

**Nota de execução:** todos os 9 tipos cobertos por esta etapa foram instrumentados em `vite.config.ts`, cada um chamando `registrarLog` (`registrarLog.ts`, Etapa 1) diretamente no ponto de mutação já existente, depois que a escrita em disco (`fs.writeFileSync`/`renameSync`/`rmSync`) já foi concluída — nenhuma chamada de log pode travar a resposta real. `deletar_projeto`, `restaurar_projeto` e `deletar_projeto_permanente` logam `{ projeto: slug }` direto, sem `original`/`atual` (não fazem sentido para esses três). `importar_planilha` loga `{ projeto: slug, quantidade: registros.length }`.

`alterar_planilha` acabou tendo **três** pontos de disparo, não um: (1) `handleRenomearProjeto` (`PATCH /api/projetos/:slug`, ambos os ramos `origem`), logado sob o `novoSlug` resultante; (2) a seção "Projeto" de `PUT /api/emails/:slug`, quando `dados.projeto` recebido difere do `projeto` já persistido; (3) a mudança de `colunaId` no mesmo `PUT`, quando o valor final difere do persistido. Os três geram linhas independentes (planner, seção 2: "uma linha por mutação de fato ocorrida") — uma mesma chamada a "Atualizar Planilha" que renomeia e remapeia coluna ao mesmo tempo gera duas linhas `alterar_planilha`, exatamente o exemplo da seção 2.

O handler de `PUT /api/emails/:slug` ganhou três funções auxiliares novas em `vite.config.ts` (`registrarMutacoesDoPutEmails`, `registrarEdicoesDeEmail`, `registrarMutacoesDeRegistros`), chamadas depois do `fs.writeFileSync`, comparando `dadosAtuais` (lido do disco antes do merge) com o corpo recebido — exatamente a abordagem decidida na Etapa 0 ("Duas decisões de mapeamento"), sem depender de `calcularMerge.ts`. `editar_email` gera uma linha por campo do `email` que mudou de valor (formato dedicado `{campo, de}`/`{campo, para}`); `registros` são casados por `id` — para cada um, chaves de `backup_dados` removidas viram `restaurar_registro` (uma linha por registro, todas as chaves restauradas agrupadas), e qualquer outra alteração de campo vira `alterar_registro` (diff genérico agrupado, uma linha por registro).

**Ajuste de rota (`registrarLog.ts`, Etapa 1):** ao ligar os call sites de verdade, `houveMudancaReal` provou estar errada para `restaurar_registro` — restaurar `status` não escreve nenhum valor novo (só remove a chave de `backup_dados`, seção 3 de `restaurarCampos.ts`), então `original`/`atual` podem ser idênticos mesmo numa restauração real, e o diff genérico de valor descartaria a linha como no-op incorretamente. Também valia só parcialmente para `importar_planilha`: passar `quantidade` (para a mensagem) reintroduzia sem querer uma noção de no-op (`quantidade === 0`) num tipo que a seção 4 diz não ter uma. Corrigido com um conjunto `ACOES_SEMPRE_REAIS` (`deletar_projeto`, `restaurar_projeto`, `deletar_projeto_permanente`, `importar_planilha` — os quatro já citados na seção 4 — mais `restaurar_registro`, descoberto agora) que `houveMudancaReal` checa antes de qualquer diff de valor. `registrarLog.ts` ganhou também dois rótulos novos em `ROTULOS_CAMPO` (`slug`, `colunaId`) para as mensagens de `alterar_planilha`.

**Limitação conhecida, não fechada nesta etapa:** `POST /api/emails/:slug/sheet` (`reimportar_planilha`) recebe só `{ nomeArquivo, conteudoBase64 }` — os bytes brutos da planilha, sem a contagem de registros reimportados. A linha é gravada sem `quantidade` (mensagem cai no fallback "Planilha reimportada.", sem contagem). Fechar isso exigiria `AtualizarRegistrosModal.tsx` (ou o que quer que chame `enviarSheet`, `emailsApi.ts`) passar a contagem no corpo — nenhum desses arquivos está mapeado nas "Arquivos Necessários" desta demanda (Etapa 0), então não alterei nenhum deles. Também não implementei nenhuma heurística para diferenciar, dentro de `PUT /api/emails/:slug`, uma edição manual de um registro de um remapeamento de colunas em massa (`AtualizarDadosModal.tsx`/`calcularMerge.ts`, também fora do escopo mapeado) — ambos chegam como o mesmo array `registros` completo e são tratados registro a registro por `registrarMutacoesDeRegistros`, o que pode gerar uma linha `alterar_registro` por registro afetado num remapeamento grande, em vez de uma única linha agregada como acontece com `reimportar_planilha`. Se isso for um problema na prática (volume de linhas), fica como candidato a ajuste de rota numa etapa futura, quando/se `calcularMerge.ts` entrar no escopo.

Não validado nesta sessão com `npm run dev`/fluxo real (sandbox sem `package.json`/`tsconfig`/`node_modules` do projeto, que não fazem parte do ZIP mapeado na Etapa 0): validei a sintaxe e os tipos de `vite.config.ts` e `registrarLog.ts` isoladamente com `tsc --noEmit` (`strict`, `skipLibCheck`) contra um stub local de `src/types/email.ts` (descartado depois — esse arquivo real não está neste ZIP e não foi meu para criar). Recomendo rodar os Testes 1, 2, 4 e 5 da seção 9 (`npm run dev` + inspecionar `data/logs/<AAAA-MM>.jsonl`) antes de considerar esta etapa validada de ponta a ponta.

### Etapa 3 — Endpoint de recepção client-side (`POST /api/logs`) ✅ concluída

**O que fazer:**
- Novo endpoint que recebe eventos que não nascem de um handler existente: `exportar_planilha` (chamado por `exportarPlanilha.ts`) e, a partir da Etapa 4, `erro_cliente`.

**Por quê:** exportação de planilha e erros de UI são 100% client-side hoje — não têm handler de servidor prévio ao qual se anexar.

**Nota de execução:** `logsApiPlugin` (novo, `vite.config.ts`) monta `/api/logs`, só `POST /` por enquanto (`GET /` e `GET /export` ficam reservados para as Etapas 5 e 7— método errado responde 405, sub-rota errada responde 404). O handler (`handleReceberLogCliente`) valida o corpo `{ acao, dados? }` contra uma whitelist restrita (`ACOES_ACEITAS_POST_LOGS`, hoje `exportar_planilha`/`erro_cliente` — subconjunto da taxonomia completa de `types/log.ts`, já que todo handler de mutação real da Etapa 2 chama `registrarLog` direto, sem passar por este endpoint) e repassa para `registrarLog` sem duplicar nenhuma das regras da Etapa 1 (whitelist completa, `LOGS_ATIVOS`, no-op, guard anti-loop).

`src/services/logsApi.ts` (criado vazio na Etapa 0) ganhou `registrarLogCliente(acao, dados)`, espelhando a whitelist do servidor em `AcaoLogCliente`. Nunca lança — falha de rede ou resposta não-OK viram só `console.error`, mesmo princípio do guard anti-loop do servidor: registrar o log é incidental à ação real do usuário, uma falha aqui não pode se propagar.

`exportarPlanilha.ts` chama `registrarLogCliente('exportar_planilha', { projeto, quantidade })` depois que o download já foi disparado (nunca antes): uma vez em `exportarRegistros` (planilha avulsa; foi preciso trocar os `return` antecipados de cada `case` do switch por `break`, para o log rodar depois de qualquer um dos quatro formatos) e uma vez por planilha dentro do laço de `exportarRegistrosEmLote` quando há 2+ planilhas no `.zip` (o caso de 1 planilha já delega para `exportarRegistros`, que loga sozinho) — decisão registrada aqui porque o planner não é explícito sobre lote: o template de mensagem da seção 4 ("Planilha exportada do projeto X (N registros)") é por planilha, então uma linha por planilha no lote é a leitura mais direta, não uma única linha agregada como em `reimportar_planilha`.

Validado só com `tsc --noEmit` isolado (`strict`, `skipLibCheck`) contra o mesmo stub local de `src/types/email.ts` da Etapa 2 (descartado depois) — sem erros nos arquivos tocados; os três erros de módulo ausente (`xlsx`/`jspdf`/`jszip`) são das dependências reais do projeto, não instaladas neste sandbox de verificação, e não têm relação com esta etapa. Recomendo rodar o Teste 1 da seção 9 e uma exportação avulsa + uma em lote (2+ planilhas) com `npm run dev`, inspecionando `data/logs/<AAAA-MM>.jsonl`, antes de considerar esta etapa validada de ponta a ponta.

### Etapa 4 — Instrumentar logs de erro ✅ concluída

**O que fazer:**
- Servidor: captura de exceptions não tratadas nos handlers do `vite.config.ts` (`erro_servidor`, via `registrarLog`).
- Cliente: `window.onerror`/error boundary do React (`erro_cliente`, `origem: "cliente"`) e interceptação de respostas 4xx/5xx nas chamadas de API existentes (`src/services/*Api.ts`), ambos enviados via `POST /api/logs` (Etapa 3).

**Por quê:** fecha os 3 tipos restantes da taxonomia e dá visibilidade a falhas que hoje só aparecem (e desaparecem) num toast ou no console do navegador.

**Nota de execução:** novo helper `registrarErroServidor(err, contexto)` em `vite.config.ts` (logo após a classe `ApiError`) — só grava `erro_servidor` quando `err` **não** é um `ApiError`, já que um `ApiError` já é uma resposta esperada (validação/conflito, 400/404/409), não uma falha real do servidor; um erro "não tratado", pela definição da seção 4, é justamente o que não tem esse tratamento explícito. Chamado nos 13 catches do arquivo que respondem a uma requisição ou contabilizam um item de lote: `GET`/`POST /api/emails/:slug/sheet`, `PUT /api/emails/:slug`, `DELETE /api/projetos` (outer + item), `PATCH /api/projetos/:slug`, `POST /api/projetos`, `GET /api/lixeira`, `POST /api/lixeira/restaurar` (outer + item), `DELETE /api/lixeira` (outer + item) e `POST /api/logs`. `contexto` é só descritivo (nome da rota), sem função na whitelist de `registrarLog` (`acao` continua sempre `'erro_servidor'`). Os dois handlers que já respondiam sempre com 500 antes desta etapa (`PUT /api/emails/:slug`, que nunca usava `ApiError`, e `handleListarLixeira`) também ganharam a chamada — nesses dois todo catch já era, por construção, um erro "não tratado" (nenhum usa `ApiError`/400/404), então a regra "loga quando não é `ApiError`" se aplica sem exceção. Os `catch { continue }` que já existiam para pular pastas corrompidas da lixeira (`handleRenomearProjeto`, `handleRestaurarProjetos`, `handleExcluirPermanentemente`, `handleListarLixeira`) foram deixados como estavam — decisão de mapeamento, não ajuste de rota: eles não propagam a exceção (o item só é ignorado da listagem/varredura), então não há "resposta 500" nem exceção não tratada ali para capturar; logar cada pasta corrompida encontrada geraria ruído a cada leitura da lixeira, sem relação com uma ação real do usuário.

Cliente: `src/services/logsApi.ts` ganhou `reportarErroApi(metodo, rota, status, mensagem?)` — chamado nos 10 pontos de `emailsApi.ts` (3: `salvarEmails`, `enviarSheet`, `obterSheet`), `lixeiraApi.ts` (4: `listarLixeira`, `restaurarProjetos`, `renomearProjeto`, `excluirPermanentemente`) e `projetosApi.ts` (3: `criarProjeto`, `renomearProjeto`, `deletarProjetos`) onde cada serviço já detectava uma resposta não-`ok`/fora do intervalo 200-207 — a chamada acontece logo antes do `throw` já existente, nunca substituindo ou atrasando esse tratamento (não é `await`ada pelos chamadores, mesmo princípio de "nunca lança" de `registrarLogCliente`).

`window.onerror`/`unhandledrejection` (`main.tsx`) e um error boundary React novo (`src/components/ErrorBoundary.tsx`) cobrem os dois caminhos que `reportarErroApi` não alcança: erro síncrono/assíncrono fora do ciclo de requisição (`window.addEventListener('error'/'unhandledrejection', ...)`) e erro de render/lifecycle da árvore de componentes (`componentDidCatch`/`getDerivedStateFromError`, únicas APIs do React para isso — sem equivalente em hooks, por isso um componente de classe novo, não uma função). O boundary embrulha toda a árvore em `main.tsx` (acima de `ThemeProvider`/`BrowserRouter`), com um fallback mínimo (`.error-boundary-fallback`, novo em `index.css`, reaproveitando a paleta de `.erro-salvamento` já existente) — sem tentativa de "recuperação" automática, só orienta a recarregar a página, já que o estado da árvore quebrada não é confiável para continuar renderizando.

**Ajuste de rota:** `src/components/ErrorBoundary.tsx` é um arquivo novo, não mapeado na Etapa 0 desta demanda — passa a fazer parte da lista cumulativa de Criados a partir de agora (seção "Arquivos Necessários" abaixo). `src/index.css` ganhou a classe `.error-boundary-fallback` (fallback do boundary) além do já mapeado para a Etapa 6.

**Limitação conhecida, não fechada nesta etapa:** `reportarErroApi`/`window.onerror`/o error boundary sempre relatam `erro_cliente` mesmo quando `LOGS_ATIVOS=false` no servidor — o corpo chega a `POST /api/logs`, mas `registrarLog` descarta a gravação no primeiro passo (checagem do flag), então não há log de fato; só um `POST` de rede a mais, sem efeito colateral. Não implementei nenhum corte no lado cliente para evitar esse `POST` supérfluo quando o flag está desligado, porque o cliente não tem hoje nenhuma forma de saber o valor de `LOGS_ATIVOS` do servidor sem um novo endpoint/consulta — fora do escopo desta etapa; a tela `/logs` (Etapa 6) já vai expor esse estado via banner, mas só para leitura, não para o cliente decidir se chama `registrarLogCliente`.

Validado nesta sessão: `npx tsc --noEmit` isolado (`strict`, `skipLibCheck`, mais `noUnusedLocals`/`noUnusedParameters` para `vite.config.ts`) contra os mesmos stubs locais das Etapas 2/3 (`src/types/email.ts`, mais `contexts/ThemeContext.tsx`/`pages/*`/`data/projetos.ts` para resolver a cadeia de imports de `main.tsx` — todos descartados depois, não fazem parte deste ZIP) — sem erros em nenhum dos arquivos tocados (`vite.config.ts`, `main.tsx`, `ErrorBoundary.tsx`, `logsApi.ts`, `emailsApi.ts`, `lixeiraApi.ts`, `projetosApi.ts`). Também rodei `registrarLog('erro_servidor', ...)`/`registrarLog('erro_cliente', ...)` manualmente via `tsx` (mesmo princípio de validação isolada das etapas anteriores), incluindo o filtro de `registrarErroServidor` contra um `ApiError` simulado — confirmado que um erro de validação (400) não gera linha, enquanto um erro genuinamente inesperado gera `erro_servidor` com `mensagem`/`detalhe` corretos. Não consegui validar de ponta a ponta com `npm run dev` (sandbox sem `package.json`/`node_modules` reais do projeto, fora do ZIP mapeado) nem o comportamento real de `window.onerror`/error boundary no navegador — recomendo rodar o Teste 7 da seção 9 (forçar erro 4xx/5xx e erro de render) antes de considerar esta etapa validada de ponta a ponta.

### Etapa 5 — Leitura com filtro/busca/paginação ✅ concluída

**O que fazer:**
- Novo `GET /api/logs`, com query params de busca (nome/data/tipo/projeto/registroId/id da alteração), filtro e paginação.
- Leitura sequencial por arquivo mensal (mês mais recente → mais antigo), com early-exit ao preencher a página pedida.

**Por quê:** é o que a tela da Etapa 6 consome — sem isso não há como listar nada.

**Nota de execução:** o lado servidor já estava pronto em `vite.config.ts` ao iniciar esta etapa — `handleListarLogs`, `RespostaListagemLogs`, `TAMANHO_PAGINA_LOGS` (50, fixo), `listarArquivosMensaisDeLogs` (mês mais recente → mais antigo, via ordenação reversa do nome `<AAAA-MM>.jsonl`) e os três predicados de filtro (`linhaCorrespondeAba`, `linhaCorrespondeData`, `linhaCorrespondeBusca`), registrados em `logsApiPlugin` como `GET /` ao lado do `POST /` da Etapa 3. Nomes de query param (`aba`, `pagina`, `busca`, `dataInicio`, `dataFim`) não são especificados literalmente pelo planner — a interpretação adotada já estava documentada em comentário acima de `handleListarLogs`, incluindo a decisão de mapear "nome" (seção 6) para busca em `mensagem` (já que não existe campo `nome` dedicado no formato gravado da seção 4). O early-exit da leitura sequencial funciona como descrito: para assim que a página pedida está cheia e mais um item correspondente aparece, sem contar o restante do histórico.

O que faltava — e é o trabalho desta entrega — era o lado cliente: `logsApi.ts` só tinha o comentário de cabeçalho citando a Etapa 5 como pendente, sem nenhuma função de fato. Adicionei `listarLogs(filtros?)`, no mesmo padrão de `listarLixeira` (`lixeiraApi.ts`): monta a query string só com os filtros informados (`FiltrosLogs`, todos opcionais — omitir um campo deixa o servidor aplicar seu próprio padrão em vez de mandar um valor vazio), usa `extrairMensagemDeErro`/`reportarErroApi` no caminho de erro (mesma cópia local do helper que os outros três serviços já duplicam, sem util compartilhado) e devolve `RespostaListagemLogs` — interface nova em `logsApi.ts`, espelhando a de `vite.config.ts` campo a campo (`itens: LinhaLog[]`, `pagina`, `temProximaPagina`), já que o cliente não pode importar tipos de `vite.config.ts` diretamente.

**Ajuste de rota:** nenhum — a assinatura de `handleListarLogs` (query params, formato de resposta) já estava fechada antes desta entrega; `listarLogs`/`FiltrosLogs`/`RespostaListagemLogs` só espelham o que já existia, sem exigir mudança no servidor.

Validado com `npx tsc --noEmit` isolado (`strict`, `skipLibCheck`) contra `src/types/log.ts` real (único import de `logsApi.ts`) — sem erros. Não validei de ponta a ponta com `npm run dev` (sandbox sem `package.json`/`node_modules` reais do projeto) — recomendo, antes de considerar esta etapa fechada, um teste manual rápido de `listarLogs` (ex.: chamar no console do navegador com `npm run dev` rodando) cobrindo paginação (`pagina` 1 e 2 com mais de 50 linhas no mês), cada filtro (`aba`, `busca`, `dataInicio`/`dataFim`) isoladamente, e o caminho de erro (`GET /api/logs` fora do ar) confirmando que `reportarErroApi` dispara e a função rejeita com mensagem legível — nenhum desses casos tem um teste dedicado na seção 9 hoje (o Teste 8, seção 9.9, testa a via a tela `/logs`, que só existe a partir da Etapa 6).

### Etapa 6 — Tela `/logs` ✅ concluída

**O que fazer:**
- Nova rota (`App.tsx`); botão "Visualizar Logs" no dropdown de configurações/funções do `Header`.
- Tabela paginada (50/página) + modal de detalhe ao clicar na linha; busca/filtro acima da tabela; abas "Ações"/"Erros" com switch, preservando filtros ao trocar; estados vazio e de erro distintos; banner somente-leitura quando `LOGS_ATIVOS=false`.

**Por quê:** é o ponto de entrega visível de toda a demanda — sem ela, o log existe mas ninguém consegue ver.

**Nota de execução:** rota `/logs` (`App.tsx`) e botão "Visualizar Logs" no dropdown do `Header` já tinham sido resolvidos como ajuste de rota nas Etapas 4/5 (import `Logs`/`Link` já presentes) — nenhuma mudança nova em nenhum dos dois nesta entrega. O trabalho desta etapa foi inteiramente `src/pages/logs.tsx` (vazio até aqui) + `src/index.css` (nova seção "Tela /logs").

`logs.tsx` consome `listarLogs` (`services/logsApi.ts`, Etapa 5) com um único estado de filtros (`aba`/`pagina`/`busca`/`dataInicio`/`dataFim`) recalculado via `useMemo` a cada mudança, e uma única `useEffect` de leitura que descarta respostas fora de ordem (`requisicaoAtualRef`, guard contra a resposta de uma requisição antiga sobrescrever um estado mais novo já carregado — ex.: trocar de aba rápido demais). Pontos de destaque:
- **Busca com debounce** (350ms): `buscaInput` (a cada tecla) só vira `buscaAplicada` (o que de fato vai pro `GET /api/logs`) depois do atraso — evita um request por caractere. Toda mudança de busca ou de data volta a paginação para 1 (resultado diferente, página anterior pode não existir mais); **trocar de aba não**, propositalmente (seção 6: "trocar de aba mantém os filtros/busca/página aplicados").
- **Filtro de data (dia único e intervalo)**: dois `<input type="date">` ("De"/"Até"), convertidos de fuso local para ISO/UTC (`inicioDoDiaLocalParaIso`/`fimDoDiaLocalParaIso`) antes de ir para a query — responsabilidade que o próprio handler do servidor (`linhaCorrespondeData`, Etapa 5) deixa explicitamente para quem monta a query. "Até" ausente com "De" presente é tratado como dia único, usando o fim do próprio dia de "De" como limite superior — não exige os dois campos preenchidos para consultar um único dia.
- **Paginação própria, não o componente `Paginacao` já existente no projeto**: `Paginacao.tsx` espera `totalPaginas` conhecido (botão de última página, campo "ir para"), mas `GET /api/logs` (Etapa 5) deliberadamente não conta o total — só devolve `temProximaPagina` via early-exit, para não precisar ler `data/logs/` inteiro a cada request. A tela usa só Anterior/Próxima + número da página atual, a navegação possível sem esse total. Registrado aqui como decisão de mapeamento, não ajuste de rota — nenhum arquivo fora dos já mapeados na Etapa 0 precisou mudar por causa disso.
- **Abas "Ações"/"Erros"**: switch simples (`.logs-abas`/`.logs-aba-btn`, novo em `index.css`), sem componente prévio no projeto para isso.
- **Banner somente-leitura**: exibido quando `resposta.logsAtivos` (campo já adicionado a `RespostaListagemLogs` na Etapa 5) é `false` — nunca um controle clicável, só texto informativo.
- **Modal de detalhe**: reaproveita o `Dialog` genérico (`components/Dialog.tsx`) com uma lista de definição (`dl`/`dt`/`dd`) cobrindo todos os campos de `LinhaLog` (`id`, `data`, `acao`, `projeto`, `registroId`, `quantidade`, `mensagem`, `original`/`atual` como JSON formatado, e `origem`/`detalhe` quando a linha é de erro). O acesso a `origem`/`detalhe` exigiu um narrowing explícito por comparação direta (`logSelecionado.acao === 'erro_servidor' || ... === 'erro_cliente'`) em vez de delegar a `ehTipoAcaoErro` (`types/log.ts`) — o TypeScript não propaga o estreitamento de união discriminada de um type guard aplicado sobre uma sub-propriedade (`logSelecionado.acao`) de volta para o objeto que a contém.
- **Estados vazio/erro distintos**: "Nenhum log encontrado" (sem itens, sem erro) vs. "Erro ao carregar logs." (falha real do `GET /api/logs`, nova classe `.logs-tabela-erro`) — nunca a mesma mensagem para os dois casos.
- **Rótulos de exibição** (`ROTULOS_ACAO`, novo em `logs.tsx`): mapa `TipoAcao` → texto legível para a coluna "Ação"/modal de detalhe — não substitui nem duplica `mensagem` (que continua vindo pronta de `registrarLog`), é só apresentação da própria tela.

**Fora do escopo desta etapa, propositalmente:** botão "Exportar Logs" e qualquer chamada a `GET /api/logs/export` — não implementados aqui (Etapa 7, servidor ainda não tem essa rota).

Validado com `tsc --noEmit` isolado (`strict`, `skipLibCheck`) contra uma cópia descartável de `src/` com stubs locais para as dependências de `Header.tsx` fora do escopo desta demanda (`types/email.ts`, `ThemeSelectorModal`, `EmailConteudoModal`, `ConfirmDialog`, `atualizar/AtualizarRegistrosModal`/`AtualizarDadosModal`, `utils/clipboard`, `utils/emailData` — nenhum deles é meu para criar, todos descartados depois) e as dependências reais instaladas (`react`, `react-dom`, `react-router-dom`, `react-icons`) — sem nenhum erro em `pages/logs.tsx`, `services/logsApi.ts` ou `types/log.ts`. Os erros remanescentes do projeto completo (`App.tsx`/`main.tsx` apontando para páginas/contexto fora do ZIP mapeado, `xlsx`/`jspdf`/`jszip` não instalados, `registrarLog.ts` sem `@types/node`) são todos pré-existentes e não relacionados a esta etapa. Não validei com `npm run dev`/fluxo real no navegador (sandbox sem `package.json`/`node_modules` reais do projeto) — recomendo rodar o Teste 8 da seção 9 (paginação, modal de detalhe, busca/filtro por tipo e por data em dia único e intervalo, abas preservando filtro/página, estado vazio) antes de considerar esta etapa validada de ponta a ponta.

### Etapa 7 — Exportar logs por mês ✅ concluída

**O que fazer:**
- Novo `GET /api/logs/export` (query params: meses/intervalo + formato), já que a exportação lê `data/logs/` diretamente no servidor.
- Botão "Exportar Logs" na tela `/logs`; seletor de mês/intervalo; seleção de formato (CSV com o esquema de achatamento da seção 6, ou JSON); 1 mês = arquivo direto, mais de 1 mês = `.zip`.

**Por quê:** fecha o ciclo de "log serve pra debug" com uma forma de levar esse rastro pra fora do sistema (anexar num chamado, compartilhar, arquivar).

**Nota de execução:** `handleExportarLogs` (novo, `vite.config.ts`) registrado em `logsApiPlugin` como `GET /export`, ao lado do `POST /`/`GET /` já existentes. Query params (nomes definidos nesta etapa, não especificados literalmente pelo planner, mesmo critério da Etapa 5): `mesInicio` (obrigatório, `AAAA-MM`), `mesFim` (opcional — ausente equivale a mês único, mesmo critério de "Até" ausente = dia único da Etapa 6) e `formato` (`csv`/`json`, obrigatório). `sequenciaDeMeses` monta a lista de meses do intervalo; `lerLinhasDoMes` lê e faz parse de `data/logs/<mes>.jsonl`, devolvendo `[]` sem erro para um mês sem arquivo (nenhum log gravado ainda naquele mês) ou com todas as linhas corrompidas — mesmo critério de descarte de linha inválida já usado por `handleListarLogs` (Etapa 5). `gerarCsvDoMes` monta o CSV com as colunas fixas da seção 6 (`id, data, acao, projeto, registroId, quantidade, mensagem, alteracoes_de, alteracoes_para`), reaproveitando o critério de escape (`;` como separador, aspas duplicadas, RFC 4180) já usado por `escaparCampoCsv` em `exportarPlanilha.ts` (client-side) — cópia local em `escaparCampoCsvLog`, sem util compartilhado entre os dois. 1 mês → resposta direta com `Content-Disposition: attachment`; 2+ meses → `.zip` via `JSZip` (mesma dependência já usada por `exportarPlanilha.ts`, aqui com import estático no topo do arquivo, sem motivo para code-splitting no processo do dev server), um arquivo por mês, nunca achatado num único arquivo agregado. A exportação não chama `registrarLog` em nenhum ponto — é leitura sobre o próprio log, mesmo raciocínio de `GET /api/lixeira` não ser logado (seção 6, última frase).

Cliente: `src/services/logsApi.ts` ganhou `exportarLogs(filtros)` e a interface `FiltrosExportacaoLogs` (`mesInicio`, `mesFim?`, `formato`), espelhando os query params do servidor. Nome do arquivo baixado vem do header `Content-Disposition` da resposta (`nomeArquivoDeContentDisposition`), com fallback só por segurança de tipo — o servidor sempre define o header. `baixarBlob` é uma cópia local do mesmo padrão de download via `<a>` temporário já usado por `exportarPlanilha.ts`, sem util compartilhado entre os dois módulos (mesma decisão já registrada para `extrairMensagemDeErro` na Etapa 5). Diferente de `exportarRegistros`/`exportarRegistrosEmLote` (exportação de planilha), `exportarLogs` nunca chama `registrarLogCliente` — segue a mesma regra de "exportação de log não gera log" do servidor.

Interface: novo componente `src/components/ExportarLogsModal.tsx`, aberto pelo botão "Exportar Logs" — sempre visível no cabeçalho da tela `/logs` (`.logs-exportar-btn`, novo em `index.css`), nunca dentro de uma linha ou resultado filtrado (seção 6: "nunca por resultado de busca/filtro, nunca um log específico"), por isso não recebe nenhum filtro da tela como prop. Reaproveita o `Dialog` genérico e as classes já existentes de `ExportarModal` (exportação de planilha) — `.modal-exportar`, `.exportar-secao`, `.modal-campo-label`, `.exportar-grade-formatos`/`.formato-card` (aqui só com dois cartões, CSV/JSON, em vez dos quatro formatos de planilha) e `.dialog-botao-copiar` no rodapé — sem duplicar CSS novo para essa parte. Dois campos novos `<input type="month">` ("De"/"Até (opcional)"), com a mesma classe `.logs-filtro-data-campo` já usada pelo filtro de data da própria tela (Etapa 6) — a regra CSS foi estendida para cobrir `input[type='month']` além de `input[type='date']`. Um texto de apoio (`.logs-exportar-dica`, novo) informa dinamicamente se o resultado será um arquivo direto (mês único) ou um `.zip` (intervalo), sem exigir que o usuário abra a documentação para entender essa regra do servidor.

**Ajuste de rota:** nenhum — `logsApi.ts` (Etapa 0) já reservava `GET /api/logs/export` para esta etapa, e `logs.tsx` (Etapa 6) já documentava o botão como propositalmente fora do escopo até aqui.

**Limitação conhecida, não fechada nesta etapa:** o CSV de exportação não inclui `origem`/`detalhe` (campos exclusivos de linhas de erro) — o planner (seção 6) fixa as colunas do CSV sem mencionar esses dois campos. Quem precisar desses dados numa exportação de erros hoje precisa usar o formato JSON, que exporta a linha completa. Fechar isso exigiria decidir uma convenção não especificada pelo planner (duas colunas extras sempre vazias para linhas de ação, ou um CSV com esquema diferente por aba) — fica como candidato a ajuste de rota numa etapa futura, se isso for um problema na prática.

Validado nesta sessão: `npx tsc --noEmit` isolado (`strict`, `skipLibCheck`) contra um stub local de `src/types/email.ts` (mesmo princípio das Etapas 2/3/4, descartado depois) — sem erros em nenhuma das funções novas de `vite.config.ts` (`sequenciaDeMeses`, `lerLinhasDoMes`, `escaparCampoCsvLog`, `gerarCsvDoMes`, `conteudoExportacaoDoMes`, `handleExportarLogs`, `logsApiPlugin`); o único erro remanescente do arquivo completo é pré-existente, em `handleListarLixeira` (fora do escopo desta demanda), causado só pela imprecisão do stub de `email.ts` usado para a validação isolada, não pelo código real. Também validei `pages/logs.tsx`, `components/ExportarLogsModal.tsx`, `services/logsApi.ts` e `types/log.ts` isoladamente (mesmos stubs de dependências de `Header.tsx` já usados na Etapa 6, descartados depois) — sem erros em nenhum dos quatro arquivos tocados/criados por esta etapa. Não validei com `npm run dev`/fluxo real no navegador (sandbox sem `package.json`/`node_modules` reais do projeto) — recomendo rodar o Teste 10 da seção 9 (exportação de 1 mês em CSV, intervalo de 2+ meses em JSON) antes de considerar esta etapa validada de ponta a ponta.

Com a Etapa 7 concluída, as 7 etapas da Demanda 9 estão implementadas — falta só a validação manual de ponta a ponta (seção 9) para marcar a Demanda 9 como Concluída em `DEMANDAS.md`.

## Arquivos Necessários

Mapeados na Etapa 0. A partir daqui, todo ZIP de entrega é cumulativo sobre esta lista (ver "Fluxo de entrega por etapas" acima).

**Fonte** (contexto — não alterados por esta demanda):
- `src/components/utils/restaurarCampos.ts` — dono do critério "ação sem mudança real não grava nada" (seção 2/5 reaproveitam exatamente esse critério) e gatilho client-side de `restaurar_registro`.
- `src/components/ExportarModal.tsx` — convenção visual de modal com seletor de formato de exportação, reaproveitada por `ExportarLogsModal.tsx` (Etapa 7).
- `src/components/Dialog.tsx` — casco usado por praticamente todo modal do projeto; base do modal de detalhe de log (Etapa 6) e do modal de exportação (Etapa 7).
- `src/components/Paginacao.tsx` — componente de paginação já existente; não reaproveitado na tabela de `/logs` (Etapa 6, ver nota de execução: paginação própria por não haver `totalPaginas`).
- `src/variables.css` — variáveis de cor/tema existentes, para estilizar a tela nova sem inventar paleta.

**Alterados:**
- `vite.config.ts` — Etapas 1 (se a leitura do flag precisar de algo aqui), 2 (instrumentar os 9 handlers existentes), 3 (`POST /api/logs`), 4 (captura de `erro_servidor`), 5 (`GET /api/logs`), 7 (`GET /api/logs/export`). O arquivo que mais muda em toda a demanda.
- `src/main.tsx` — Etapa 4, captura de erro não tratado no cliente (`window.onerror`/rejection).
- `src/services/emailsApi.ts` — Etapa 4, interceptar respostas 4xx/5xx e reportar `erro_cliente`.
- `src/services/lixeiraApi.ts` — idem.
- `src/services/projetosApi.ts` — idem.
- `src/components/utils/exportarPlanilha.ts` — Etapa 3, registrar `exportar_planilha` via `POST /api/logs` ao concluir uma exportação.
- `src/components/Header.tsx` — Etapa 6, novo botão "Visualizar Logs" no dropdown de configurações.
- `src/components/Icons.tsx` — Etapa 6, novo ícone para o botão/tela de logs.
- `src/App.tsx` — Etapa 6, nova rota `/logs` (fora do `PROJETOS.map`, já que não é uma página de projeto).
- `src/index.css` — Etapas 4 (`.error-boundary-fallback`, fallback do error boundary), 6 (estilos da tabela, modal de detalhe, abas e banner da tela `/logs`) e 7 (`.logs-exportar-btn`, `.logs-exportar-meses`, `.logs-exportar-dica`, e extensão das regras de `input[type='date']` para cobrir também `input[type='month']`).
- `.gitignore` — identificado na Etapa 1 (ajuste de rota, não estava mapeado na Etapa 0): passou a ignorar `.env`.

**Criados:**
- `src/scripts/utils/registrarLog.ts` — utilitário central de log (seção 5), Etapa 1.
- `src/types/log.ts` — `TipoAcao` (whitelist da seção 4) e os tipos de linha de log (ação normal / erro), Etapa 1.
- `src/services/logsApi.ts` — serviço client-side para `POST`/`GET /api/logs` e `GET /api/logs/export`, no mesmo padrão de `emailsApi.ts`/`lixeiraApi.ts`/`projetosApi.ts`; Etapas 3, 5 e 7.
- `src/pages/logs.tsx` — tela `/logs` (seção 6), Etapa 6; botão "Exportar Logs" na Etapa 7.
- `.env` — flag `LOGS_ATIVOS`, Etapa 1.
- `.env.example` — mesma flag, versão de exemplo versionada, Etapa 1.
- `src/components/ErrorBoundary.tsx` — error boundary React (`componentDidCatch`/`getDerivedStateFromError`), reporta erro de render/lifecycle como `erro_cliente`; identificado na Etapa 4 (ajuste de rota, não estava mapeado na Etapa 0) — ver nota de execução da Etapa 4.
- `src/components/ExportarLogsModal.tsx` — modal de exportação de logs (mês/intervalo + formato, seção 6); identificado na Etapa 7 (ajuste de rota, não estava mapeado na Etapa 0) — ver nota de execução da Etapa 7.

## 8. Critérios de aceite (Definition of Done)

A demanda será considerada **aprovada** quando todos os itens abaixo forem verdadeiros.

### 8.1 O que deve ser entregue

- Código-fonte com as 7 etapas implementadas.
- `data/logs/<AAAA-MM>.jsonl` presente e crescendo a cada mutação real feita via interface, a partir da conclusão da Etapa 2.
- Um resumo curto (no corpo do commit/PR) listando quais das 7 etapas foram concluídas.

### 8.2 O que o sistema deve fazer para ser aprovado

- **Build limpo:** `npm run build` (`tsc -b` + Vite) completa sem erros de tipo.
- **Lint limpo:** `npm run lint` não aponta erros novos.
- **Cobertura de tipos:** cada um dos 12 tipos de `acao` (seção 4) é gerado corretamente pelo fluxo correspondente pelo menos uma vez.
- **Ação sem mudança real não gera log:** confirmar em pelo menos um fluxo (ex.: "Atualizar Dados" sem alterar nada).
- **Falha simulada de escrita não trava a ação real:** a mutação do usuário é concluída mesmo se o `appendFile` falhar (ex.: apontando `data/logs/` para um caminho sem permissão em teste local).
- **`LOGS_ATIVOS=false` desativa a escrita** sem quebrar nenhum fluxo do sistema, e a tela `/logs` mostra o banner correspondente.
- **Tela `/logs` funciona:** tabela paginada em 50, modal de detalhe ao clicar, busca/filtro (nome/data/tipo/projeto/registroId/id), abas Ações/Erros preservando filtro ao trocar, estados vazio e de erro distintos.
- **Exportação funciona:** 1 mês baixa um arquivo direto; mais de 1 mês baixa um `.zip`; CSV e JSON geram arquivos válidos e abríveis.
- **Nenhuma forma de editar, deletar ou desativar logs pela interface** — confirmar que não existe nenhum controle desse tipo na tela `/logs`.

## 9. Como testar e validar manualmente

### 9.1 Preparar o ambiente

```bash
npm install
npm run dev
```

Abra o endereço local mostrado no terminal (por padrão, algo como `http://localhost:5173`).

### 9.2 Teste 1 — geração básica de log

1. Crie um projeto novo importando uma planilha.
2. **Verifique (inspecionando `data/logs/<AAAA-MM>.jsonl`):** uma linha `importar_planilha` foi adicionada, com `projeto` preenchido.
3. Edite manualmente o nome de um registro.
4. **Verifique:** uma linha `alterar_registro` foi adicionada, com `original`/`atual` mostrando o campo que mudou.

### 9.3 Teste 2 — ação em massa

1. Reimporte uma planilha com centenas/milhares de registros sobre um projeto existente.
2. **Verifique:** uma única linha `reimportar_planilha` foi adicionada, com `quantidade` refletindo o total e `original`/`atual` nulos.

### 9.4 Teste 3 — ação sem mudança real

1. Abra "Atualizar Planilha > Atualizar Dados" e confirme sem alterar nada.
2. **Verifique:** nenhuma linha nova foi adicionada ao arquivo do mês.

### 9.5 Teste 4 — ação com múltiplas mutações

1. No modal "Atualizar Planilha > Atualizar Dados", altere tanto o nome do projeto quanto o mapeamento de colunas na mesma confirmação.
2. **Verifique:** duas linhas `alterar_planilha` foram adicionadas, uma para cada mutação, com `mensagem` distinguindo as duas.

### 9.6 Teste 5 — erro do servidor não trava a ação

1. Torne `data/logs/` temporariamente sem permissão de escrita (ou aponte para um caminho inválido em teste local).
2. Realize qualquer ação (ex.: deletar um projeto).
3. **Verifique:** a ação real é concluída normalmente (projeto vai pra lixeira); uma linha `erro_servidor` é gravada assim que a permissão for restaurada e uma nova ação disparar (ou verifique o `console.error` do servidor durante a falha).

### 9.7 Teste 6 — erro do cliente

1. Force um erro não tratado na UI (ex.: temporariamente, via devtools) ou provoque uma resposta 4xx/5xx de alguma chamada de API.
2. **Verifique:** uma linha `erro_cliente` aparece no arquivo do mês, com `origem: "cliente"` e `detalhe` preenchido.

### 9.8 Teste 7 — flag de ambiente

1. Defina `LOGS_ATIVOS=false` no `.env` e reinicie `npm run dev`.
2. Realize qualquer ação mutável.
3. **Verifique:** nenhuma linha nova é adicionada; a tela `/logs` mostra o banner de "registro desativado".
4. Reverta o flag e reinicie — confirme que voltou a gravar normalmente.

### 9.9 Teste 8 — tela `/logs`

1. Abra o dropdown de configurações do `Header` e clique em "Visualizar Logs".
2. **Verifique:** tabela paginada, 50 linhas por página; clicar numa linha abre o modal com todos os campos.
3. Use a busca/filtro por tipo e por data (dia único e intervalo).
4. **Verifique:** alternar entre as abas "Ações" e "Erros" preserva o filtro e a página aplicados.
5. Filtre por algo que não existe. **Verifique:** aparece "Nenhum log encontrado".

### 9.10 Teste 9 — exportação

1. Na tela `/logs`, clique em "Exportar Logs" e selecione um único mês em CSV.
2. **Verifique:** baixa um arquivo `.csv` direto, com `alteracoes_de`/`alteracoes_para` como texto JSON nas colunas.
3. Repita selecionando um intervalo de 2+ meses em JSON.
4. **Verifique:** baixa um `.zip` contendo um `.json` por mês, cada um preservando a estrutura original das linhas.

### 9.11 Teste 10 — build e checagem de tipos

```bash
npm run build
npm run lint
```

**Verifique:** ambos terminam sem erros.

Se todos os testes acima passarem, a Demanda 9 pode ser considerada validada e pronta para o registro de status ser atualizado em `DEMANDAS.md`.
