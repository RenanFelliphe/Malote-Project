# Atualização da Planilha via UI

> Documento de implementação autocontido da **Demanda 3** (ver `DEMANDAS.md`, seção "Registro de Demandas"). Ao final, sua execução completa deixa a Demanda 3 pronta para ser marcada como **Concluída** em `DEMANDAS.md`.

## 1. Contexto

O **Sistema de Organização e Envio de E-mails** é uma aplicação React/TypeScript que permite importar planilhas de contatos, validar e-mails, marcar registros como enviados/deletados e exportar o resultado. O botão "Atualizar planilha" já existe visualmente no menu de configurações (`Header.tsx`), mas está desabilitado (`disabled`, título "Em breve") — espaço reservado, de propósito, para não sugerir uma ação que a aplicação ainda não sabe executar.

A lógica de sincronizar por `id` já existe inteira em `src/scripts/sync.ts` (`syncRecords`/`applyStatusRules`) — hoje só roda via terminal (Node), fora do navegador, e não tem nenhuma forma de resolver conflito registro a registro: ou aceita tudo da planilha nova (`--aceitar-conflitos`), ou preserva tudo o que está protegido por `backup_dados` (Demanda 5), sem meio-termo.

No destrinchamento desta demanda (registrado em `DEMANDAS.md`), o escopo original — "reimportar planilha, resolver conflito de `backup_dados`" — se dividiu em dois fluxos de natureza diferente, acessados por um dropdown no mesmo botão do `Header.tsx`:

- **Atualizar Registros** — o que a demanda original cobria: reimportar uma planilha nova para atualizar os *valores* dos registros (nome, e-mail, presença/ausência), resolvendo conflito por conflito quando há dado protegido.
- **Atualizar Dados** — fluxo novo: corrigir os *metadados* do projeto (nome de exibição, nome do arquivo/rota, mapeamento de colunas), sem exigir que o usuário tenha a planilha original à mão de novo.

O segundo fluxo só é viável porque esta demanda também muda o modelo de dados: **a planilha bruta enviada passa a ser persistida junto ao projeto**, não só o `EmailRecord[]` já processado — hoje, depois de importado, `src/components/import/utils/construirRegistros.ts` só entrega o array final para `criarProjeto`; nenhuma linha/coluna original sobrevive em lugar nenhum, o que tornaria "corrigir o mapeamento sem reconstruir tudo" impossível sem essa mudança.

Duas descobertas de código, feitas durante o levantamento desta demanda, simplificam parte do que se imaginava de escopo:

- **`PUT /api/emails/:slug` já aceita reescrever o array `registros` inteiro** (`vite.config.ts`, `emailsApiPlugin`) — o endpoint existente, hoje usado por `persistirRegistros` para qualquer edição de tabela, já serve para persistir o resultado final dos dois fluxos desta demanda, sem precisar de um endpoint de gravação dedicado. Só não aceita ainda um campo `projeto` (nome de exibição) no corpo — ver Etapa 3.
- **`PATCH /api/projetos/:slug` já existe e já renomeia a pasta/slug de um projeto ativo** (`vite.config.ts`, `handleRenomearProjeto`) — construído originalmente para o conflito de restauração da lixeira, mas genérico o bastante para ser reaproveitado tal como está na seção "Projeto" do fluxo Atualizar Dados (Etapa 7).

## 2. Escopo

**Cobre:**
- Botão "Atualizar Planilha" no `Header.tsx` deixa de estar desabilitado e vira um dropdown com duas opções: **Atualizar Registros** e **Atualizar Dados**.
- Persistência do arquivo bruto da planilha (`sheet.<ext>`) na pasta de dados do projeto, ao lado de `emails.json`. Gravado na criação do projeto (sem alterar o fluxo atual do `ImportWizardModal`, só adicionando essa gravação) e sobrescrito a cada reimportação bem-sucedida via **Atualizar Registros** — o arquivo persistido sempre reflete a última planilha usada para aquele projeto.
- **Fluxo Atualizar Registros:** seletor de arquivo → modal com resumo inicial (mesmo modelo do resumo final do `EtapaRevisao`: nome do projeto, URL, total de registros, e-mails válidos/inválidos/duplicados, registros atualizados, tamanho do arquivo) → seções de conflito condicionais (só aparecem as que tiverem pelo menos 1 ocorrência) → resumo final.
- **Fluxo Atualizar Dados:** modal único com 3 seções — (1) projeto (nome de exibição e nome do arquivo/rota — ao salvar, se qualquer um dos dois mudou, recalcula e redireciona para a nova rota); (2) remapeamento de colunas nome/e-mail, reaproveitando a estrutura visual do `EtapaMapeamento` (duas colunas + prioridade quando há mais de uma coluna candidata por atributo), reprocessando o `sheet.<ext>` já persistido — **sem exigir novo upload**. Ao confirmar, `applyStatusRules` é reexecutado sobre a base inteira com os valores recalculados pela nova seleção de colunas — duplicados que passam a existir (ou deixam de existir) por causa do remapeamento são recalculados silenciosamente, sem seção de conflito própria; (3) resumo.
- Motor de merge único, compartilhado pelos dois fluxos, com um subconjunto de tipos de conflito habilitado conforme o chamador (ver tabela de aplicabilidade na seção 4), reaproveitando `applyStatusRules` para o recálculo pós-merge de válido/inválido/duplicado.
- Taxonomia final de conflitos (seção 4) e sua ordem de resolução em cascata dentro do wizard.
- Feedback consolidado ao final de cada fluxo e recarga dos dados do projeto na tela.

**Não cobre nesta fase:**
- Mapeamento de ID personalizado (coluna de ID customizável no mapeamento) — virou a **Demanda 7**, para nascer ao mesmo tempo no wizard de importação e neste fluxo de atualização, em vez de aparecer primeiro só aqui.
- Criar um projeto novo a partir deste fluxo (já existe via `ImportWizardModal`) — esta demanda é só para projeto já aberto.
- Desfazer uma reimportação ou uma atualização de dados (relacionado à Demanda 4, não obrigatório aqui).
- Detecção/resolução de duplicados como conflito de sincronização — duplicado continua sendo um estado calculado e resolvido depois, na tabela normal (`EmailTable`), não dentro do modal de conflito desta demanda.
- Refatoração do `ConflictDialog` — está datado hoje, mas fica registrado como débito técnico para não inflar o escopo desta demanda; o novo componente de merge (`MergeCampoConflito`) nasce à parte, sem depender de reformar o casco existente primeiro.

## 3. Modelo de dados e endpoints

**Arquivo bruto persistido:**

```
data/active/<slug>/
  emails.json     # já existe hoje — EmailRecord[] processado, dentro de EmailsData
  sheet.<ext>      # novo — a planilha bruta mais recente (csv ou xlsx)
```

- Gravado pela primeira vez no fluxo de criação (`ImportWizardModal` → `criarProjeto`), sem mudar o comportamento visível para o usuário nesse fluxo.
- Sobrescrito a cada reimportação bem-sucedida via **Atualizar Registros**.
- **Não** é alterado por **Atualizar Dados > Colunas** — remapear colunas é reinterpretar o mesmo arquivo já salvo, não uma reimportação de dados novos.

**Endpoints:**

| Rota | Método | Uso | Status |
|---|---|---|---|
| `/api/projetos` | `POST` | Criação de projeto — passa a também persistir `sheet.<ext>` | Já existe, precisa de ajuste |
| `/api/emails/:slug` | `PUT` | Persistir o array `registros` final dos dois fluxos desta demanda | Já existe, precisa aceitar `projeto` opcional no corpo |
| `/api/projetos/:slug` | `PATCH` | Renomear a pasta/slug (nome do arquivo/rota) — seção "Projeto" do fluxo Atualizar Dados | Já existe, reaproveitado como está |
| `/api/emails/:slug/sheet` *(nome sugerido)* | `POST` | Recebe a nova planilha (multipart) no fluxo Atualizar Registros; sobrescreve `sheet.<ext>` | Novo |
| `/api/emails/:slug/sheet` *(mesmo path)* | `GET` | Devolve os bytes brutos de `sheet.<ext>` já persistido, para o fluxo Atualizar Dados > Colunas reparsear no navegador sem novo upload | Novo |

O parse da planilha (`parseSheetBrowser.ts`) já roda inteiramente no navegador — por isso o motor de merge (seção 5) também é desenhado para rodar no navegador, recebendo o resultado do parse local e os registros atuais do projeto (já carregados na tela), e só then enviando o resultado final ao `PUT /api/emails/:slug` existente. Isso evita duplicar a lógica de sincronização entre um novo endpoint de servidor e o `sync.ts` de terminal — o motor de merge é escrito como módulo puro (sem `node:fs`), importável tanto pelo bundle do cliente quanto, no futuro, por `sync.ts`.

## 4. Taxonomia de conflitos

| # | Tipo | Gatilho | Precisa de decisão do usuário? | UI |
|---|---|---|---|---|
| 1 | **Atributo alterado** | `backup_dados.nome` ou `backup_dados.email` presente **e** o valor vindo da planilha diverge do valor protegido atual | Sim | Merge theirs/ours |
| 2 | **Status alterado (automático)** | Recálculo normal (`applyStatusRules`) faria um registro **não protegido** trocar de válido↔inválido | Não — é só o recálculo automático que já acontece hoje | Nota informativa no resumo, não é seção do wizard |
| 3 | **Registro corrigido** | `backup_dados.nome`/`.email` presente e o valor vindo da planilha é **igual** ao valor já corrigido na interface | Não — resolução automática (remove o `backup_dados` daquele campo) | Nota informativa no resumo |
| 4 | **Registro enviado** | Registro com `status = enviado` e a planilha traz `nome`/`email` diferente do atual | Sim | Merge theirs/ours |
| 5 | **Registro deletado (revivido)** | Registro com `status = deletado` volta a aparecer na planilha nova | Sim | Merge theirs/ours (manter deletado vs. reviver com os dados novos) |
| 6 | **Registro sumido da planilha** | Um `id` que existia na planilha anterior não está mais presente na nova | Sim | Lista simples (ignorar vs. marcar como deletado) — não é um merge de campo, não tem "theirs" de nome/e-mail para comparar |

Os itens 2 e 3 nunca ganham seção navegável no wizard — nenhum dos dois tem, de fato, um "theirs" para o usuário escolher (item 2 porque a planilha nunca carrega `status`, ele é sempre derivado; item 3 porque os dois lados já são iguais). Ambos entram só como nota informativa no resumo final, para não resolver nada silenciosamente sem o usuário saber que aconteceu.

**Ordem de resolução em cascata**, seguindo a mesma prioridade de `STATUS_PRIORIDADE` (`src/types/email.ts`: `enviado > deletado > duplicado > válido/inválido`), aplicada agora à ordem das seções do wizard:

```
Resumo inicial
  → Enviado (item 4)
  → Deletado / revivido (item 5)
  → Sumido da planilha (item 6)
  → Atributo alterado (item 1)
  → [Status alterado (item 2) e Corrigido (item 3) só entram como notas no resumo final]
Resumo final
```

A resolução de uma seção afeta o que aparece nas seções seguintes — nenhuma seção é calculada de antemão:
- Um registro "Enviado" mantido como enviado não aparece em "Atributo alterado". Se o usuário optar por "desenviar", ele passa a ser avaliado normalmente na seção seguinte.
- O mesmo vale para "Deletado/revivido" → "Atributo alterado": se o usuário decide reviver o registro, ele entra na checagem de atributo alterado com o novo status; se decide manter deletado, some do restante do fluxo.
- Cada seção só aparece se tiver pelo menos 1 registro pendente depois da cascata da seção anterior — mesmo comportamento condicional que `EtapaDefinicaoPrioridade` já tem hoje no wizard de importação.

**Aplicabilidade por fluxo** — nem todo tipo de conflito pode ocorrer nos dois pontos de entrada do motor de merge:

| Tipo de conflito | Atualizar Registros | Atualizar Dados > Colunas |
|---|---|---|
| Atributo alterado | Sim | Sim (o remapeamento pode gerar um nome/e-mail computado diferente do atual) |
| Status alterado (nota) | Sim | Sim |
| Corrigido (nota) | Sim | Sim |
| Enviado | Sim | Sim |
| Deletado / revivido | Sim | **Não** — remapear colunas não adiciona nem remove linhas, só reinterpreta as mesmas |
| Sumido da planilha | Sim | **Não** — mesmo motivo acima |

## 5. Motor de merge compartilhado

Um único motor de merge, com dois pontos de entrada diferentes (planilha nova vs. arquivo persistido remapeado) e um subconjunto de tipos de conflito habilitado por chamador, precisa manter estado acumulado entre as seções do wizard — a saída de uma seção é a entrada da próxima, e o resumo final só pode ser calculado depois que a cascata inteira terminar. É o desafio técnico central desta demanda.

Assinatura conceitual (nome/local exatos a definir na Etapa 4):

```ts
function calcularMerge(
  registrosAtuais: EmailRecord[],
  linhasNovas: LinhaPlanilha[],       // já parseadas por parseSheetBrowser.ts
  colunas: { nome: string[]; email: string[] }, // mapeamento escolhido, com prioridade
  tiposHabilitados: TipoConflito[],   // subconjunto da tabela de aplicabilidade (seção 4)
) : ResultadoMerge
```

Onde `ResultadoMerge` separa: registros sem conflito (já prontos para persistir), as listas por tipo de conflito navegável (enviado, deletado/revivido, sumido, alterado) e as listas de resolução automática (corrigido, status alterado) para as notas do resumo.

## 6. Divisão em etapas

As Etapas 1–4 preparam a base de dados e o motor de merge; as Etapas 5–8 são a UI dos dois fluxos, que dependem da base pronta.

---

## ⚠️ Fluxo de entrega por etapas — leia antes de começar

Para toda demanda implementada, o processo segue duas partes: uma etapa preliminar de mapeamento (Etapa 0) e a regra de entrega cumulativa que vale a partir da Etapa 1.

### Etapa 0 — Mapeamento ✅ concluída

Etapa preliminar, que roda antes da Etapa 1 de qualquer demanda. Único objetivo: reunir de uma vez o contexto necessário, para que as etapas seguintes não dependam mais do projeto inteiro sendo reenviado a cada troca.

1. A partir do planner da demanda (este arquivo), identificar todos os arquivos envolvidos na implementação — Fontes, Alterados e Criados — mesmo os que ainda não existem, mas estão previstos para etapas futuras.

2. Retornar um único ZIP contendo o planner da demanda + todos esses arquivos. Os "Criados" que ainda não foram implementados devem ser criados e guardados vazios.

A partir daqui, o usuário passa a enviar apenas o ZIP mais recente como referência — nunca mais o projeto inteiro.

**Nota de execução (Etapa 0):** ZIP montado com 18 arquivos — 12 já existentes (9 Fonte + `vite.config.ts`, `Header.tsx`, `emailsApi.ts`/`projetosApi.ts` como Alterados) e 5 Criados (`calcularMerge.ts`, `AtualizarRegistrosModal.tsx`, `AtualizarDadosModal.tsx`, `MergeCampoConflito.tsx`, `RegistrosSumidosSection.tsx`, todos vazios — nenhuma etapa de implementação foi iniciada ainda), além deste planner. Confirmado que `DEMANDAS.md` e este planner, no estado atual do projeto, batem exatamente com a última revisão feita nesta conversa (única diferença encontrada foi final de linha CRLF/LF e conteúdo de outra demanda, não relacionado). Nenhum ajuste de rota necessário nesta etapa.

### Regra de entrega (Etapa 1 em diante)

A cada etapa, a entrega é **um único ZIP, cumulativo**:

- **Contém todos os arquivos necessários até aqui, não só os da etapa atual.** Isso inclui (a) todo arquivo efetivamente alterado desde a Etapa 1 desta revisão, e (b) todo arquivo listado como Fonte, Alterado ou Criado em qualquer etapa já concluída — mesmo os que nunca chegaram a ser modificados. Uma vez que um arquivo apareceu em algum ZIP, ele continua aparecendo em todos os ZIPs seguintes até o fim da implementação, para que o usuário nunca precise reenviar manualmente algo que ainda é relevante, só porque não mudou na etapa mais recente.

- **Sempre inclui o planner da demanda** (este arquivo), atualizado a cada entrega: etapas concluídas marcadas com "✅ concluída" no título, notas de execução preenchidas, e qualquer ajuste de rota registrado — caso um diagnóstico feito durante a implementação mude uma decisão já tomada no planner.

---

### Etapa 1 — Persistência do arquivo bruto ✅ concluída

**Nota de execução:** `POST /api/projetos` (`vite.config.ts`) passa a exigir um campo `arquivo: { nomeArquivo, conteudoBase64 }` no corpo, gravando `sheet.<ext>` ao lado de `emails.json` logo após a escrita deste — `persistirSheetBruto` deriva a extensão de `nomeArquivo` (`path.extname`, com `xlsx` como fallback para nome sem extensão) e remove qualquer `sheet.<ext>` anterior antes de gravar (via `encontrarArquivoSheetExistente`), para o caso de o formato mudar entre importações (csv ↔ xlsx) — situação que só se tornará alcançável de fato na Etapa 5 (reimportação), mas a limpeza já nasce pronta para ela. Novos endpoints `GET`/`POST /api/emails/:slug/sheet` implementados no mesmo `emailsApiPlugin` do `PUT` existente, roteados por contagem de segmentos do path antes da lógica de `PUT` (que continua tratando o path de um segmento só, inalterada); `GET` devolve os bytes brutos com `Content-Type`/`Content-Disposition` derivados da extensão, `POST` recebe `{ nomeArquivo, conteudoBase64 }` e sobrescreve via o mesmo `persistirSheetBruto`. Validação de diretório (slug seguro + path traversal) extraída para `resolverDiretorioProjetoAtivo`, reaproveitada pelos dois novos handlers; o `PUT` existente manteve sua validação inline original, sem refatoração, para não misturar um reuso de código com a entrega desta etapa.

**Ajuste de rota:** o plano descrevia `POST /api/emails/:slug/sheet` como recebendo a planilha "via multipart" — implementado em vez disso como JSON `{ nomeArquivo, conteudoBase64 }` (mesmo formato usado por `POST /api/projetos`), para não introduzir uma dependência nova de parsing de multipart quando a API inteira já é JSON; `criarProjeto`/`enviarSheet` fazem a conversão para base64 no navegador (`arquivoParaBase64`, novo em `projetosApi.ts`, em blocos de 0x8000 bytes para não estourar a pilha de `String.fromCharCode`). Por esse mesmo motivo, `src/components/import/ImportWizardModal.tsx` — listado só como Fonte na seção 7 original — precisou de uma mudança de uma linha: a chamada a `criarProjeto` passa a incluir `arquivo`, o `File` que o componente já recebia como prop (nenhuma mudança de UI ou de fluxo visível, só o parâmetro adicional na chamada existente). Adicionado aos Arquivos Alterados desta seção. `emailsApi.ts` ganhou `enviarSheet`/`obterSheet` (esta última já devolvendo um `File`, para a Etapa 7 poder chamar `parsearPlanilha` sem nenhuma adaptação) — nenhuma das duas é consumida ainda, ficam prontas para as Etapas 5 e 7.

Não foi possível rodar `npm run build`/`npm run lint` desta vez: o ZIP enviado (modelo de entrega cumulativa desta demanda) não inclui `package.json`/`node_modules`/`tsconfig.json`, só os arquivos Fonte/Alterados/Criados relevantes. Validação feita isoladamente, fora do projeto: parse de sintaxe TypeScript dos 4 arquivos tocados (`vite.config.ts`, `emailsApi.ts`, `projetosApi.ts`, `ImportWizardModal.tsx`) sem erros. Recomendo rodar `npm run build` e `npm run lint` no projeto completo antes de seguir para a Etapa 2 (já concluída) ou Etapa 3, para pegar qualquer erro de tipo que só apareça com o `tsconfig.json` real do projeto (ex. `Buffer`/`btoa` fora do escopo de tipos configurado).

**O que fazer:**
- Endpoint de criação de projeto (`POST /api/projetos`, `vite.config.ts`) passa a gravar `sheet.<ext>` na pasta do projeto, além do `emails.json` já gravado hoje — sem alterar o restante do fluxo de criação (`ImportWizardModal` continua enviando o que já envia; o servidor apenas guarda uma cópia extra do arquivo original).
- Novo endpoint `GET /api/emails/:slug/sheet`, devolvendo os bytes brutos de `sheet.<ext>` (usado pela Etapa 7).
- Novo endpoint `POST /api/emails/:slug/sheet`, recebendo a nova planilha via multipart e sobrescrevendo `sheet.<ext>` (usado pela Etapa 5, ao confirmar o wizard).

**Por quê:** é a base de dados de que os dois fluxos desta demanda dependem — sem o arquivo persistido, "Atualizar Dados > Colunas" não tem o que reprocessar sem pedir upload de novo.

### Etapa 2 — Dropdown no Header ✅ concluída

**Nota de execução:** botão "Atualizar Planilha" (`Header.tsx`) deixou de estar `disabled` e virou o trigger de um submenu inline (mesmo dropdown, sem flyout separado) com "Atualizar registros" e "Atualizar dados", seguindo o único outro item do menu com controle aninhado ("Trocar tema"). Estado próprio (`submenuAtualizarAberto`) fechado junto do menu principal por um helper único (`fecharMenu`), reaproveitado em todos os pontos de saída já existentes (clique fora, Esc, e cada ação do menu) — a primeira tentativa usou um `useEffect` derivando `submenuAtualizarAberto` de `menuAberto`, mas o lint do projeto (`react-hooks/set-state-in-effect`) rejeitou por cascading render; o helper substitui isso sem efeito adicional.

"Atualizar registros" abre o seletor de arquivo do SO via `<input type="file">` oculto, mesmo padrão de `abrirSeletorDeArquivo`/`handleArquivoEscolhido` em `pages/home.tsx` (`ImportWizardModal`) — arquivo escolhido fica em `arquivoSelecionadoAtualizarRegistros` e, por enquanto, só aparece como uma confirmação temporária abaixo do header ("Arquivo recebido... assistente chega na Etapa 5"), com botão de dispensar; será substituída pela abertura real do `AtualizarRegistrosModal` na Etapa 5. "Atualizar dados" só fecha o menu por enquanto — deliberadamente **não** ganhou estado próprio (`modalAtualizarDadosAberto`) nesta etapa, para não deixar uma variável sem nenhum consumidor (o lint do projeto also rejeita `no-unused-vars`); esse estado nasce junto com `AtualizarDadosModal` na Etapa 7.

**Ajuste de rota:** `src/index.css` não estava na lista de Arquivos Necessários da seção 7 — precisou ser tocado nesta etapa porque o submenu, os itens indentados e a confirmação temporária de arquivo ficavam sem nenhum estilo (herdando só as classes dos itens de primeiro nível, sem indentação/hierarquia visual). Adicionado como Alterado na seção 7. Escolhas de ícone: `IconeImportar`/`IconeEditarStatus` para os dois itens do submenu e `IconeSetaBaixo`/`IconeSetaCima` como indicador de expandir/recolher — nenhum ícone novo precisou ser criado em `Icons.tsx` (não é tocado nesta demanda).

Checado com `npx tsc -b` (limpo), `npx eslint .` (limpo em `Header.tsx`; os 6 erros/3 avisos restantes são pré-existentes em `LixeiraSidebar.tsx`, `Paginacao.tsx`, `QuantidadeInput.tsx`, `ThemeContext.tsx` — mesmos 4 arquivos já registrados como pré-existentes na Demanda 5) e `npx vite build` (build completo, sem erros — só o aviso pré-existente de chunk grande).

**O que fazer:**
- Botão "Atualizar Planilha" no `Header.tsx` deixa de estar `disabled`/"Em breve" e vira um trigger de dropdown com dois itens: "Atualizar Registros" (abre seletor de arquivo) e "Atualizar Dados" (abre o modal direto, sem seletor).

**Por quê:** é o ponto de entrada visível dos dois fluxos — pode ser feita em paralelo às Etapas 1/3/4, já que não depende delas para existir visualmente (só os `onClick` ficam sem efeito completo até as etapas seguintes).

### Etapa 3 — Ajuste no endpoint de persistência e rename ✅ concluída

**Nota de execução:** `PUT /api/emails/:slug` (`vite.config.ts`, `emailsApiPlugin`) passa a aceitar `projeto` opcional no corpo — validação de formato estendida para `dados.projeto === undefined || typeof dados.projeto === 'string'`, e o merge final trocou de `...dadosAtuais` implícito para explicitamente `projeto: dados.projeto ?? dadosAtuais.projeto`, preservando o comportamento antigo para todo chamador que não enviar o campo (nenhum ainda envia — passa a ser usado só na Etapa 7). Mensagem de erro de corpo inválido atualizada para `{ email, registros, projeto? }`, refletindo o novo formato aceito.

`PATCH /api/projetos/:slug` (`handleRenomearProjeto`) **não precisou de nenhuma mudança** — confirmado lendo o código: a validação só checa colisão de `novoSlug` contra `activeDirectory`/`trashDirectory` e o roteamento (`if (req.method === 'PATCH') handleRenomearProjeto(req, res, slugAtual)`) não impõe nenhuma condição de que a chamada venha do fluxo de conflito de restauração da lixeira — `origem: 'ativo'` já funciona standalone. Confirma a suposição registrada na seção 1 do planner; reaproveitável como está na Etapa 7.

Validado isoladamente (mesma limitação das etapas anteriores — ZIP sem `package.json`/`node_modules`): `npx tsc --noEmit` limpo contra o `vite.config.ts` inteiro, com `vite`/`@vitejs/plugin-react`/tipos de `node` instalados à parte só para a checagem (não fazem parte desta entrega). Recomendo rodar `npm run build`/`npm run lint` no projeto completo antes de seguir para a Etapa 5, já que o `PUT` existente é caminho crítico usado por toda edição da Demanda 5.

**O que fazer:**
- `PUT /api/emails/:slug` (`vite.config.ts`) passa a aceitar um campo `projeto` opcional no corpo (`{ email, registros, projeto? }`) — quando presente, atualiza `EmailsData.projeto` (nome de exibição) junto com `email`/`registros`. Hoje o handler sempre preserva `dadosAtuais.projeto` no merge; passa a usar `dados.projeto ?? dadosAtuais.projeto`.
- Confirmar que `PATCH /api/projetos/:slug` (`handleRenomearProjeto`) aceita ser chamado com `origem: 'ativo'` fora do fluxo de conflito de restauração da lixeira para o qual foi originalmente escrito — pela leitura do código, a validação já é genérica (checa apenas colisão de slug), então não deveria precisar de mudança; só validar isso na prática antes de reaproveitar na Etapa 7.

**Por quê:** evita criar dois endpoints novos (um para `registros`, outro para nome de exibição) quando um ajuste pequeno no já existente resolve — e confirma que o endpoint de rename de slug já é reaproveitável antes de depender dele na Etapa 7.

### Etapa 4 — Motor de merge compartilhado ✅ concluída

**Nota de execução:** `calcularMerge` implementado em `src/scripts/utils/calcularMerge.ts` — assinatura igual à da seção 5 (`registrosAtuais`, `linhasNovas`, `colunas`, `tiposHabilitados`), devolvendo `{ registrosSemConflito, conflitos: { enviado, deletadoRevivido, sumido, atributoAlterado }, notas: { corrigido, statusAlterado } }`. Também exporta `TIPOS_CONFLITO_ATUALIZAR_REGISTROS`/`TIPOS_CONFLITO_ATUALIZAR_DADOS` (os dois subconjuntos da tabela de aplicabilidade da seção 4), prontos para as Etapas 5 e 7 passarem como `tiposHabilitados`. `applyStatusRules` **não** foi reaproveitada por import direto de `sync.ts`: o arquivo importa `node:fs` no topo (`import { existsSync, readFileSync, ... } from 'node:fs'`), o que quebraria o bundle do navegador mesmo a função em si não usando `fs` — a lógica de validade/duplicado foi replicada localmente em `recalcularStatusENotas`, e a leitura de coluna de nome/e-mail por prioridade replicada em `pickFirstFilled`, ambas seguindo o mesmo comportamento documentado nos comentários de `syncRecords`/`applyStatusRules`.

A classificação por registro segue a ordem de prioridade da seção 4 (enviado > deletado/revivido > atributo alterado, com corrigido resolvido automaticamente campo a campo antes de decidir se o registro tem conflito real). É um cálculo em **passe único e sem estado**: a cascata descrita na seção 4 (ex. "desenviar" um registro passa a avaliá-lo em "Atributo alterado") é responsabilidade da UI das Etapas 5/6/7, que deve reaplicar a decisão do usuário aos registros pendentes e chamar `calcularMerge` de novo com o resultado como novo `registrosAtuais` — a função não tenta resolver a cascata inteira numa única chamada.

**Ajuste de rota / pendência a confirmar:** `identifyColumns.ts` e `validateEmail.ts` (importados por `sync.ts`) não fizeram parte dos Arquivos Necessários desta demanda (seção 7) e não vieram em nenhum ZIP até agora, então `calcularMerge.ts` reimplementa localmente `isValidEmail`/`normalizeEmail` (regex padrão `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) e a detecção de coluna de ID (heurística local: cabeçalho igual a "id", case-insensitive; fallback para ordem da linha, como já documentado em `syncRecords`). Recomendo enviar os dois arquivos reais no próximo ZIP para eu confirmar paridade exata antes de a Etapa 5 depender disso na prática — se a heurística real de ID for diferente (ex. aceitar variações como "código"), é só nesta função (`identificarColunaId`) que o ajuste precisa entrar.

Validado isoladamente (sem `package.json`/`node_modules` no ZIP, mesma limitação já registrada na Etapa 1): `npx tsc --noEmit` rodou limpo contra cópias reais de `email.ts` e `parseSheetBrowser.ts` (a única dependência externa, `xlsx`, foi instalada à parte só para a checagem — não faz parte desta entrega). Recomendo rodar `npm run build`/`npm run lint` no projeto completo antes de seguir para a Etapa 5, para pegar qualquer divergência que só apareça com o `tsconfig.json` real. A Etapa 3 (ajuste do endpoint `PUT /api/emails/:slug` para aceitar `projeto` opcional) segue **pendente** — não foi tocada nesta entrega, que atendeu especificamente ao pedido de implementar a Etapa 4.

**O que fazer:**
- Novo módulo (`calcularMerge`, ver seção 5), sem dependências de Node (`fs`, etc.) — deve rodar no navegador. Recebe registros atuais + linhas já parseadas pela planilha (novas ou remapeadas) + a lista de tipos de conflito habilitados, devolve os registros sem conflito, as listas por tipo de conflito navegável e as listas de resolução automática.
- Reaproveita a mesma lógica de validação de e-mail e recálculo de status já usada em `applyStatusRules` (`sync.ts`) — decidir, ao implementar, se `applyStatusRules` é reaproveitada diretamente (se não depender de `node:fs`) ou se sua lógica de recálculo é extraída para um módulo puro comum aos dois lados (browser e `sync.ts`).

**Por quê:** é o núcleo que as duas UIs (Etapas 5 e 7) vão consumir — construído e testável isoladamente antes de qualquer tela, no mesmo espírito da Etapa 5 da Demanda 5 (`restaurarCampos`).

### Etapa 5 — Wizard "Atualizar Registros" ✅ concluída

**Nota de execução (retroativa — código já existia neste ZIP, mas esta etapa nunca tinha sido marcada como concluída nem documentada aqui):** `AtualizarRegistrosModal` implementado em `src/components/atualizar/AtualizarRegistrosModal.tsx`, reaproveitando o `Dialog` (footer fixo, corpo scrolável) no lugar do stepper de bolhas do `ImportWizardModal` — trocado por um rótulo textual (`ROTULO_SECAO`) + barra de progresso (`PROGRESSO_POR_SECAO`), por o número de seções ser variável (nem todo projeto tem os 4 tipos de conflito). Cascata implementada reaplicando, a cada "Avançar", as decisões da seção atual sobre um `snapshot` e chamando `calcularMerge` de novo (`avancar`), exatamente como documentado no cabeçalho de `calcularMerge.ts`. Sem suporte a "Voltar" entre seções de conflito — ajuste de rota deliberado (ver comentário no topo do arquivo): desfazer exigiria pilha de snapshots, fora do escopo. Ao confirmar, `sheet.<ext>` é sobrescrito (`enviarSheet`) só depois de `registros` já resolvidos (`salvarEmails`), para não perder o arquivo anterior se o usuário cancelar no meio.

Esta entrega (Etapa 6) fechou três lacunas que impediam esta etapa de compilar: `RegistrosSumidosSection.tsx` (referenciado, mas vazio), e `isValidEmail`/`normalizeEmail`/`identificarColunasAutomaticamente` (importados de `calcularMerge.ts`, mas não exportados/implementados lá) — ver "Ajustes de rota" na nota de execução da Etapa 6, abaixo.

**O que fazer:**
- Novo componente reaproveitando o casco do `ImportWizardModal` (stepper, barra de progresso, next/previous).
- Seção de resumo inicial (mesmo modelo do resumo final do `EtapaRevisao`).
- Seções condicionais de conflito, na ordem em cascata definida na seção 4, cada uma consumindo o estado resolvido da anterior.
- Seção de resumo final, incluindo as notas informativas de "corrigido" e "status alterado".
- Ao confirmar: envia a planilha para `POST /api/emails/:slug/sheet` (sobrescreve `sheet.<ext>`) e o resultado consolidado para `PUT /api/emails/:slug`.

**Por quê:** é a parte visível do fluxo original desta demanda — sem ela, o motor de merge da Etapa 4 não tem como ser acionado pelo usuário reimportando uma planilha nova.

### Etapa 6 — Componente de merge theirs/ours ✅ concluída

**Nota de execução:** `MergeCampoConflito` implementado em `src/components/atualizar/MergeCampoConflito.tsx` — mesmo layout item a item que já existia embutido em `AtualizarRegistrosModal.tsx` (`SecaoMergeSimples`, agora removido), com o acréscimo dos dois atalhos de resolução em massa ("Aceitar todos: {rótulo ours}" / "Aceitar todos: {rótulo theirs}") e um contador "X de Y resolvido(s)". `valorOurs`/`valorTheirs` continuam sendo strings livres por seção (não fixas em `'ours'`/`'theirs'`) — o significado muda por seção (ex. "manter-enviado"/"desenviar" em Enviado) — e `onDecisaoEmMassa` é responsabilidade do chamador, que substitui o `Record` de decisões inteiro de uma vez a partir da lista de conflitos que já tem em mãos (`resultadoAtual.conflitos.*`); o componente não duplica essa lista internamente. `AtualizarRegistrosModal.tsx` atualizado para consumir o componente compartilhado nas 3 seções aplicáveis (Enviado, Deletado/revivido, Atributo alterado), passando `onDecisaoEmMassa` como uma função que reconstrói o `Record` de decisões daquela seção.

**Ajustes de rota (pendências herdadas da Etapa 5, fechadas nesta entrega para o projeto compilar):**
- `isValidEmail`/`normalizeEmail`, em `src/scripts/utils/calcularMerge.ts`, não tinham `export` — `AtualizarRegistrosModal.tsx` (Etapa 5) já as importava de lá para as estatísticas cruas do resumo inicial. Adicionado `export` às duas, sem mudar comportamento.
- `identificarColunasAutomaticamente` era importada por `AtualizarRegistrosModal.tsx` (Etapa 5) mas não existia em nenhum arquivo entregue até agora. Implementada em `calcularMerge.ts`: heurística por cabeçalho contendo "nome" / "email"/"e-mail" (case-insensitive), com correspondência exata priorizada sobre parcial — mesmo formato `{ nome: string[]; email: string[] }` esperado pelo parâmetro `colunas` de `calcularMerge`.
- `src/components/atualizar/RegistrosSumidosSection.tsx` chegou vazio nesta entrega, apesar de o cabeçalho de `AtualizarRegistrosModal.tsx` já descrevê-lo como "o componente definitivo, desta etapa" (Etapa 5) e o arquivo já ser importado por nome/assinatura (`RegistrosSumidosSection`/`DecisaoSumido`). Implementado agora — lista simples com as duas opções (ignorar / marcar como deletado) por registro sumido, seguindo a assinatura já assumida pelo import existente.
- `src/index.css`: nenhuma das classes usadas por `AtualizarRegistrosModal.tsx` desde a Etapa 5 (`.etapa-atualizar`, `.lista-conflitos`, `.conflito-valores`, `.opcao-decisao`, `.notas-informativas`, `.atualizar-progresso`, etc.) tinha regra própria — só o ajuste de rota da Etapa 2 (submenu do Header) havia tocado este arquivo. Adicionado um bloco novo com todas elas, mais `.conflito-acoes-massa`/`.botao-acao-massa` (novas desta etapa) e `.lista-sumidos*` (para `RegistrosSumidosSection`). Também corrigido: `.importacao-stepper-resumo` é `display: none` por padrão (só visível em telas estreitas, alternativa compacta ao stepper de bolhas) — como os dois wizards desta demanda não usam o stepper de bolhas, adicionado `.modal-atualizar-registros .importacao-stepper-resumo { display: block; }` (e o equivalente `.modal-atualizar-dados`, para a Etapa 7) para o rótulo aparecer também em telas largas dentro destes modais especificamente.
- Dois tipos importados e nunca usados em `AtualizarRegistrosModal.tsx` (`ConflitoEnviado`, `ConflitoDeletadoRevivido`, `ConflitoAtributoAlterado` — resíduo de uma versão anterior do arquivo) removidos do import, para não quebrar `noUnusedLocals`/lint.

Validado isoladamente (mesma limitação das etapas anteriores — ZIP sem `package.json`/`node_modules` do projeto real): `npx tsc --noEmit` limpo contra os 4 arquivos de `src/components/atualizar/`, `calcularMerge.ts`, `email.ts`, `parseSheetBrowser.ts` e `emailsApi.ts`, com `Dialog.tsx`/`ConfirmDialog.tsx` (não incluídos nesta demanda, presumidos já existentes no projeto) substituídos por stubs de tipo só para a checagem — removidos antes desta entrega, não fazem parte do ZIP. Recomendo rodar `npm run build`/`npm run lint` no projeto completo antes de seguir para a Etapa 7, para confirmar que `Dialog`/`ConfirmDialog` reais batem com as props assumidas aqui (`isOpen`, `onClose`, `title`, `className`, `closeOnEsc`, `footer` para `Dialog`; `ariaLabel`, `titulo`, `descricao`, `rotuloCancelar`, `rotuloConfirmar`, `onCancelar`, `onConfirmar` para `ConfirmDialog`) e que o CSS novo não colide com nenhuma classe homônima já existente no arquivo real (bem maior do que o recorte enviado neste ZIP).

**O que fazer:**
- Novo componente `MergeCampoConflito` — duas colunas (theirs/ours) por registro conflitante, com atalhos de resolução em massa ("aceitar todos os theirs" / "aceitar todos os ours"). Não reaproveita `ConflictDialog` como casco de conteúdo (refatorá-lo fica fora do escopo desta demanda, ver seção 2); usa só o padrão visual do wizard de importação como referência de layout.
- Reaproveitado pelas três seções de merge de campo: Enviado, Deletado/revivido e Atributo alterado (a seção Sumido da planilha usa um componente à parte, de lista simples — ver Etapa 5).

**Por quê:** é o componente compartilhado por 3 das 4 seções de conflito navegáveis — construir uma vez e reaproveitar evita divergência de comportamento entre elas.

### Etapa 7 — Wizard "Atualizar Dados" ✅ concluída

**Nota de execução:** `AtualizarDadosModal` implementado em `src/components/atualizar/AtualizarDadosModal.tsx`, reaproveitando o mesmo casco de `AtualizarRegistrosModal` (Dialog com footer fixo, rótulo textual + barra de progresso) e o mesmo motor de merge sem estado (`calcularMerge`, Etapa 4) — mas com só 2 das 4 seções de conflito navegáveis habilitadas (`TIPOS_CONFLITO_ATUALIZAR_DADOS`: Enviado e Atributo alterado; Deletado/revivido e Sumido nunca se aplicam aqui, tabela de aplicabilidade da seção 4). 5 seções ao todo: Projeto → Colunas → [Enviado] → [Atributo alterado] → Resumo, com a mesma cascata de `avancar` (reaplica decisões da seção atual sobre um snapshot e chama `calcularMerge` de novo) já usada na Etapa 5/6.

Seção "Projeto": mesma lógica de acompanhamento automático de slug de `EtapaInformacoes.tsx` (nome do arquivo acompanha o nome do projeto até edição manual). Seção "Colunas": planilha buscada via `GET /api/emails/:slug/sheet` (Etapa 1) e reparseada com `parsearPlanilha`, sem exigir novo upload; `sheet.<ext>` nunca é sobrescrito por este fluxo (só reinterpreta o arquivo já salvo). Ao confirmar (seção Resumo): se o nome do arquivo mudou, chama `renomearProjeto` (novo, `projetosApi.ts`, `PATCH /api/projetos/:slug` com `origem: 'ativo'` — endpoint já existente, reaproveitado sem nenhuma mudança no servidor, confirmando a suposição da Etapa 3) antes do `PUT`; o slug devolvido pelo servidor é usado no `salvarEmails` seguinte (agora aceitando `projeto` opcional, `emailsApi.ts`) e no redirecionamento (`navigate` do react-router para `/projetos/<slug>`). Se só o nome de exibição mudou, só o `PUT` com `projeto` é chamado. Sem rota mudando, a tela recarrega (`window.location.reload()`), mesmo padrão da Etapa 5/6.

**Ajuste de rota / assunção de implementação:** `ColunaSeletora.tsx` (importado por `EtapaMapeamento.tsx`, arquivo Fonte desta demanda) não fez parte dos "Arquivos Necessários" (seção 7) e não veio em nenhum ZIP até agora — a seção "Colunas" chama `ColunaSeletora` diretamente (não `EtapaMapeamento`, que está acoplado ao `EstadoImportacao` do wizard de importação inteiro, um tipo bem maior do que o necessário aqui), com a assinatura de props inferida do uso existente em `EtapaMapeamento.tsx` (`titulo`, `headers`, `selecionadas`, `busca`, `onBuscaChange`, `onAlternarColuna`, `onReordenar`, `idPrefix`). Recomendo enviar `ColunaSeletora.tsx` no próximo ZIP para eu confirmar paridade exata antes dos testes manuais da seção 9.2 (Teste 8/9) dependerem disso na prática — se a assinatura real divergir, é só neste componente que o ajuste precisa entrar. Sem checagem em tempo real de colisão de slug na seção "Projeto" (a versão do wizard de importação usa uma lista de projetos em memória, `PROJETOS`, não disponível/enviada para este fluxo) — a validação real acontece no servidor ao confirmar, com o erro exibido no resumo final (`erroSalvar`), mesmo padrão de erro já usado nas Etapas 5/6.

Validado isoladamente (mesma limitação das etapas anteriores — ZIP sem `package.json`/`node_modules` do projeto real): `npx tsc --noEmit` (com `noUnusedLocals`/`noUnusedParameters` ligados, mesma severidade do lint do projeto) limpo contra `AtualizarDadosModal.tsx`, `MergeCampoConflito.tsx`, `calcularMerge.ts`, `email.ts`, `parseSheetBrowser.ts`, `slugify.ts`, `emailsApi.ts` e `projetosApi.ts`, com `Dialog.tsx`/`ConfirmDialog.tsx`/`ColunaSeletora.tsx` substituídos por stubs de tipo só para a checagem (removidos antes desta entrega, não fazem parte do ZIP). Recomendo rodar `npm run build`/`npm run lint` no projeto completo antes de considerar a Demanda 3 pronta para revisão final (Etapa 8), para confirmar que `Dialog`/`ConfirmDialog` reais batem com as props assumidas (mesmas já usadas em `AtualizarRegistrosModal.tsx`) e que `ColunaSeletora` real bate com a assinatura assumida acima.

**O que fazer:**
- 3 seções: (1) projeto — nome de exibição e nome do arquivo/rota, reaproveitando a mesma lógica de acompanhamento automático de slug já usada em `EtapaInformacoes.tsx` (o nome do arquivo acompanha o nome do projeto até ser editado manualmente); ao confirmar, se o nome do arquivo mudou, chama `PATCH /api/projetos/:slug` (Etapa 3) e redireciona para a nova rota; se só o nome de exibição mudou, só precisa do `PUT /api/emails/:slug` com `projeto` (Etapa 3); (2) colunas — reaproveitando a estrutura do `EtapaMapeamento` (duas colunas + prioridade), buscando o arquivo persistido via `GET /api/emails/:slug/sheet` (Etapa 1) e reparseando com `parseSheetBrowser.ts`, disparando o motor de merge (Etapa 4) só com os tipos de conflito aplicáveis a este fluxo (tabela da seção 4); ao confirmar, `applyStatusRules` é reexecutado sobre a base inteira; (3) resumo.

**Por quê:** fecha o segundo fluxo desta demanda — permite corrigir metadados do projeto sem precisar do arquivo original em mãos de novo, resolvendo a limitação identificada no contexto (seção 1).

### Etapa 8 — Confirmação e feedback final

**O que fazer:**
- Ao confirmar cada fluxo, garantir que a ordem de chamadas está correta (ex.: no fluxo Atualizar Registros, persistir `sheet.<ext>` antes ou depois de `registros`? recomenda-se depois de todas as resoluções de conflito confirmadas, para não sobrescrever o arquivo bruto se o usuário cancelar o wizard no meio do caminho).
- Recarregar os dados do projeto na tela após qualquer um dos dois fluxos.
- Redirecionar quando o nome do arquivo/rota mudou (fluxo Atualizar Dados > Projeto).

**Por quê:** garante que os dois fluxos deixam o projeto em um estado consistente mesmo se o usuário cancelar no meio, e que a tela reflete o resultado sem precisar de recarregar a página manualmente.

## 7. Arquivos Necessários

**Arquivos Fonte** (usados como referência, não sofrem alteração):
- `src/scripts/sync.ts` — base da lógica de sincronização por `id` (`syncRecords`, `applyStatusRules`), reaproveitada como ponto de partida do motor de merge (Etapa 4).
- `src/types/email.ts` (`STATUS_PRIORIDADE`) — ordem de prioridade reaproveitada para a cascata de seções de conflito (seção 4).
- `src/components/import/ImportWizardModal.tsx` — casco reaproveitado (stepper, progresso, next/previous) pelos dois novos wizards (Etapas 5 e 7).
- `src/components/import/EtapaRevisao.tsx` — modelo do resumo, reaproveitado nas seções de resumo inicial/final (Etapa 5).
- `src/components/import/EtapaMapeamento.tsx` — estrutura de seleção de colunas + prioridade, referência de layout para a seção "Colunas" do fluxo Atualizar Dados (Etapa 7 — na prática, `ColunaSeletora` é consumido diretamente, ver nota de execução da Etapa 7).
- `src/components/import/ColunaSeletora.tsx` *(ainda não enviado em nenhum ZIP — ver ajuste de rota da Etapa 7)* — consumido diretamente por `AtualizarDadosModal.tsx` na seção "Colunas"; assinatura de props inferida do uso em `EtapaMapeamento.tsx`, pendente de confirmação contra o arquivo real.
- `src/components/import/EtapaInformacoes.tsx` — lógica de acompanhamento automático do slug a partir do nome do projeto, reaproveitada na seção "Projeto" do fluxo Atualizar Dados (Etapa 7).
- `src/components/import/utils/parseSheetBrowser.ts` — parse da planilha, reaproveitado tanto para o novo upload (Atualizar Registros) quanto para reler o `sheet.<ext>` persistido (Atualizar Dados).
- `src/components/import/utils/slugify.ts` — normalização de slug, mesma usada em `EtapaInformacoes.tsx`.
- `src/types/email.ts` (`backup_dados`) — consultada pelo motor de merge para detectar conflito por campo (Demanda 5).

**Arquivos Alterados:**
- `vite.config.ts` — endpoint de criação de projeto passa a gravar `sheet.<ext>`; `PUT /api/emails/:slug` passa a aceitar `projeto` opcional; novos endpoints `GET`/`POST /api/emails/:slug/sheet` (Etapas 1 e 3).
- `src/components/Header.tsx` — botão "Atualizar Planilha" vira dropdown com as duas opções (Etapa 2).
- `src/index.css` *(ajuste de rota das Etapas 2 e 6 — não estava na lista original)* — estilos do submenu de "Atualizar Planilha" e da confirmação temporária de arquivo selecionado (Etapa 2); estilos das seções de conflito, resumo e do componente `MergeCampoConflito` (Etapa 6, ver nota de execução).
- `src/services/emailsApi.ts` — novas funções de client para os endpoints acima (`enviarSheet`/`obterSheet`, Etapa 1); `salvarEmails` passou a aceitar `projeto` opcional (Etapa 7), refletindo o `PUT` ajustado na Etapa 3.
- `src/services/projetosApi.ts` — nova função `renomearProjeto` (Etapa 7), client para `PATCH /api/projetos/:slug` (`origem: 'ativo'`), usada pela seção "Projeto" do fluxo Atualizar Dados quando o nome do arquivo/rota muda.
- `src/components/import/ImportWizardModal.tsx` *(ajuste de rota da Etapa 1 — não estava na lista original, seguia listado só como Fonte)* — chamada a `criarProjeto` passa a incluir `arquivo` (o `File` já recebido como prop), para o servidor persistir `sheet.<ext>` na criação.

**Arquivos Criados:**
- `src/scripts/utils/calcularMerge.ts` — motor de merge compartilhado entre os dois fluxos, sem dependências de Node (Etapa 4; `isValidEmail`/`normalizeEmail`/`identificarColunasAutomaticamente` exportadas/implementadas como ajuste de rota da Etapa 6).
- `src/components/atualizar/AtualizarRegistrosModal.tsx` — wizard do fluxo "Atualizar Registros" (Etapa 5).
- `src/components/atualizar/AtualizarDadosModal.tsx` *(nome sugerido)* — wizard do fluxo "Atualizar Dados" (Etapa 7 — ainda vazio).
- `src/components/atualizar/MergeCampoConflito.tsx` — componente de merge theirs/ours reutilizado pelas seções de conflito "Enviado", "Deletado/revivido" e "Atributo alterado" (Etapa 6 ✅).
- `src/components/atualizar/RegistrosSumidosSection.tsx` — seção específica do conflito "sumido da planilha" (lista simples, não é merge de campo) (Etapa 5; implementada como ajuste de rota da Etapa 6, ver nota de execução).

## 8. Critérios de avaliação

A demanda será considerada **aprovada** quando todos os itens abaixo forem verdadeiros.

### 8.1 O que deve ser entregue

- Código-fonte com as 8 etapas implementadas.
- `sheet.<ext>` presente em todo projeto criado ou reimportado a partir da conclusão da Etapa 1.
- Um resumo curto (no corpo do commit/PR) listando quais das 8 etapas foram concluídas.

### 8.2 O que o sistema deve fazer para ser aprovado

- **Build limpo:** `npm run build` (`tsc -b` + Vite) completa sem erros de tipo.
- **Lint limpo:** `npm run lint` não aponta erros novos.
- **Dropdown funciona:** clicar em "Atualizar Planilha" no Header mostra as duas opções; cada uma abre o fluxo correto.
- **Atualizar Registros — caminho feliz:** reimportar uma planilha sem nenhum conflito mostra só o resumo inicial e o resumo final, sem seções de conflito.
- **Atualizar Registros — conflitos:** cada tipo de conflito da seção 4 (enviado, deletado/revivido, sumido, alterado) só aparece quando há pelo menos 1 registro daquele tipo; resolver uma seção afeta corretamente o que aparece nas seções seguintes (cascata).
- **Registro corrigido é silencioso:** um registro cuja edição manual bate com o valor da planilha nova não abre nenhuma seção, e a proteção (`backup_dados`) é removida automaticamente; aparece como nota no resumo final.
- **`sheet.<ext>` é sobrescrito** ao final de uma reimportação bem-sucedida via Atualizar Registros.
- **Atualizar Dados > Projeto:** renomear o nome de exibição não altera a rota; renomear o nome do arquivo altera a rota e redireciona o usuário.
- **Atualizar Dados > Colunas:** remapear as colunas sem novo upload atualiza `nome`/`email` de todos os registros de acordo com a nova seleção, sem exigir o arquivo original de novo; duplicados são recalculados de acordo com o novo mapeamento.
- **`npm run sync` continua funcionando** sobre uma planilha de teste, sem erro.

## 9. Como testar e validar manualmente

### 9.1 Preparar o ambiente

```bash
npm install
npm run dev
```

Abra o endereço local mostrado no terminal (por padrão, algo como `http://localhost:5173`).

### 9.2 Teste 1 — dropdown e persistência do arquivo bruto

1. Abra um projeto existente e clique em "Atualizar Planilha" no menu de configurações.
2. **Verifique:** aparecem as duas opções, "Atualizar Registros" e "Atualizar Dados".
3. Crie um projeto novo via importação normal.
4. **Verifique (inspecionando a pasta `data/active/<slug>/`):** existe um `sheet.<ext>` além de `emails.json`.

### 9.3 Teste 2 — Atualizar Registros, caminho feliz

1. Escolha "Atualizar Registros" e selecione uma planilha sem nenhum registro protegido conflitante.
2. **Verifique:** o modal mostra só o resumo inicial e, ao avançar, o resumo final — nenhuma seção de conflito aparece.
3. **Verifique:** `sheet.<ext>` foi sobrescrito com o novo arquivo.

### 9.4 Teste 3 — conflito "Atributo alterado"

1. Edite manualmente o nome ou e-mail de um registro pela tabela (Demanda 5).
2. Reimporte uma planilha com um valor diferente para esse mesmo campo, no mesmo registro (mesmo `id`).
3. **Verifique:** a seção "Atributo alterado" aparece, mostrando o valor atual (ours) e o valor da planilha (theirs); escolher um dos dois aplica corretamente ao confirmar.

### 9.5 Teste 4 — conflito "Registro corrigido" (silencioso)

1. Edite manualmente o e-mail de um registro para um valor X.
2. Reimporte uma planilha em que aquele mesmo registro já tenha o valor X (planilha "alcançou" a correção manual).
3. **Verifique:** nenhuma seção de conflito é aberta para esse registro; o resumo final lista esse caso como resolvido automaticamente; `backup_dados.email` foi removido do registro.

### 9.6 Teste 5 — conflito "Registro enviado" e efeito cascata

1. Marque um registro como enviado.
2. Reimporte uma planilha com nome/e-mail diferente para esse registro.
3. **Verifique:** a seção "Enviado" aparece primeiro. Escolhendo manter o status enviado, o registro **não** aparece na seção seguinte ("Atributo alterado"). Repetindo o teste escolhendo "desenviar", o registro **passa a aparecer** na seção de atributo alterado.

### 9.7 Teste 6 — conflito "Registro sumido da planilha"

1. Reimporte uma planilha que **não** contenha um `id` presente na planilha anterior.
2. **Verifique:** a seção "Sumido da planilha" lista esse registro, com opção de ignorar ou marcar como deletado; a escolha é aplicada corretamente ao confirmar.

### 9.8 Teste 7 — Atualizar Dados > Projeto

1. Escolha "Atualizar Dados" e, na seção "Projeto", altere só o nome de exibição.
2. **Verifique:** ao confirmar, a rota não muda.
3. Repita alterando o nome do arquivo/rota.
4. **Verifique:** ao confirmar, o usuário é redirecionado para a nova rota, e a pasta em `data/active/` foi renomeada.

### 9.9 Teste 8 — Atualizar Dados > Colunas

1. Escolha "Atualizar Dados" e, na seção "Colunas", troque qual coluna representa o e-mail (sem selecionar nenhum arquivo novo).
2. **Verifique:** o sistema busca o `sheet.<ext>` já persistido, sem pedir upload.
3. Confirme e **verifique:** os e-mails de todos os registros refletem a nova coluna escolhida, e a contagem de duplicados no resumo reflete o recálculo.

### 9.10 Teste 9 — build e checagem de tipos

```bash
npm run build
npm run lint
```

**Verifique:** ambos terminam sem erros.

Se todos os testes acima passarem, a Demanda 3 pode ser considerada validada e pronta para o registro de status ser atualizado em `DEMANDAS.md`.