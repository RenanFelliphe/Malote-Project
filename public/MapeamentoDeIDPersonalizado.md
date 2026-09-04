# Mapeamento de ID Personalizado

> Documento de implementação autocontido da **Demanda 7** (ver `DEMANDAS.md`, seção "Registro de Demandas"). Ao final, sua execução completa deixa a Demanda 7 pronta para ser marcada como **Concluída** em `DEMANDAS.md`.

## 1. Contexto

Surgiu durante o destrinchamento da Demanda 3, como parte da seção "Colunas" do fluxo Atualizar Dados: a ideia original era permitir selecionar, na hora de remapear colunas, qual coluna da planilha deveria ser usada como `id` do registro. Só que hoje **nenhum** dos dois pontos de entrada (wizard de importação nem a Demanda 3, já concluída) tem esse seletor — o `id` é sempre a ordem da linha na planilha, sem controle explícito do usuário sobre qual coluna usar quando há uma candidata melhor.

Foi retirada do escopo da Demanda 3 porque, para fazer sentido, precisa nascer nos dois lugares ao mesmo tempo — se nascesse só na atualização, o `id` usado para casar registros na reimportação poderia divergir silenciosamente do `id` que o projeto usou na criação.

**Revisão de escopo (pós-mapeamento):** ao rastrear o código antes de implementar, foi identificado que a estratégia de resolução de ID hoje está fragmentada em 3 lugares com comportamentos diferentes:

- `identifyColumns.ts` (Node/CLI, usado só por `sync.ts`) — lista ampla de candidatos hardcoded (`ID_COLUMNS = ['ID', 'Id', 'id', '#', 'Aluno – ID', 'Aluno - ID']`), nunca importada pelos fluxos do navegador.
- `calcularMerge.ts` (navegador, `identificarColunaId`) — aceita só header exatamente `"id"` (case-insensitive), sem a lista ampla de `identifyColumns.ts`.
- `construirRegistros.ts` (navegador, criação de projeto) — **nenhuma** detecção. Sempre `id: index + 1`.

Um seletor de UI sozinho, sem persistir a escolha em `EmailsData` e sem essas duas últimas funções passarem a recebê-la como parâmetro explícito, não teria efeito real sobre o `id` gravado. O escopo abaixo já incorpora essa correção — a demanda deixa de ser "adicionar um seletor" e passa a ser "substituir as 3 heurísticas fragmentadas por uma única escolha explícita, persistida e conectada de ponta a ponta".

## 2. Escopo

**Cobre:**
- Novo campo persistido em `EmailsData` (`types/email.ts`): `colunaId?: string` — nome da coluna da planilha usada como origem do `id` deste projeto. Ausente/`undefined` equivale a "Gerar Automaticamente" (comportamento atual: ordem da linha).
- `construirRegistros.ts` (criação de projeto) passa a aceitar essa escolha e resolver o `id` de cada linha a partir dela, com fallback para ordem de linha.
- `calcularMerge.ts` deixa de detectar a coluna de ID internamente (heurística restrita a header `"id"`) e passa a recebê-la como parâmetro explícito, fornecido pelo chamador a partir do `colunaId` persistido do projeto.
- `AtualizarRegistrosModal.tsx` (fluxo "Atualizar Registros", Demanda 3) passa a ler o `colunaId` persistido do projeto e repassá-lo ao motor de merge — **sem** seletor próprio de coluna nesse fluxo; trocar a estratégia de ID continua sendo uma ação exclusiva de "Atualizar Dados > Colunas".
- Seletor de coluna de ID (`<select>` simples) tanto no `EtapaMapeamento.tsx` (wizard de importação) quanto na seção "Colunas" do `AtualizarDadosModal.tsx` (Demanda 3); ao confirmar em qualquer um dos dois, a escolha é (re)gravada em `colunaId`.
- **Exclusividade entre atributos:** ao selecionar uma coluna para representar um dos 3 atributos (id, nome, email), ela deixa de estar disponível para os outros dois — vale nos dois pontos de entrada. Implica subir o estado de "colunas em uso" para o componente pai e propagar como lista de exclusão para os 3 seletores.
- Validação bloqueante ao escolher uma coluna de ID: valores vazios, duplicados **ou não numéricos** impedem a confirmação, com feedback visível. Mesma validação reaproveitada na construção dos registros.
- Aviso ao usuário, no fluxo "Atualizar Registros", se a planilha reimportada não tiver a coluna indicada por `colunaId` (ex.: coluna renomeada) — o merge cai no fallback de ordem de linha, e isso precisa ficar visível, não silencioso.

**Não cobre nesta fase:**
- Múltiplas colunas com prioridade para ID (decisão tomada: fica fixo em 1 coluna — ver seção 4).
- Migração de `id` para projetos já existentes que mudarem de estratégia de identificação (ex.: projeto criado sem coluna de ID explícita passa a ter uma) — o risco de desalinhamento entre reimportações ao trocar de estratégia de ID no meio do caminho de um projeto já existente é uma nota de atenção a levantar na implementação, não uma migração automática coberta aqui.
- Suporte a colunas de ID com valores não numéricos (strings livres, UUIDs, códigos alfanuméricos) — decisão tomada de manter `EmailRecord.id: number` nesta fase (ver seção 4); tratado como validação bloqueante, não como funcionalidade suportada.

## 3. Modelo de dados e assinaturas alteradas

**Campo novo em `EmailsData` (`src/types/email.ts`):**

```ts
export interface EmailsData {
  // ...campos existentes...
  /**
   * Nome da coluna da planilha usada como origem do `id` dos registros
   * deste projeto. Ausente/`undefined` = "Gerar Automaticamente" (ordem
   * da linha na planilha) — mesmo comportamento de hoje, sem migração
   * necessária para projetos já existentes.
   */
  colunaId?: string;
}
```

**`construirRegistros.ts` — assinatura estendida:**

```ts
export function construirRegistros(
  linhas: LinhaPlanilha[],
  colunasNome: string[],
  colunasEmail: string[],
  colunaId: string | null // novo — null/ausente preserva o comportamento atual
): EmailRecord[]
```

Resolve o `id` de cada linha com a mesma lógica de `resolverIdDaLinha` (abaixo, hoje só em `calcularMerge.ts`): se `colunaId` for informado e o valor da linha for numérico e não vazio, usa esse número; caso contrário, cai para `index + 1`.

**`calcularMerge.ts` — assinatura estendida, detecção interna removida:**

```ts
// Antes (Etapa 4 da Demanda 3): detectava a coluna internamente.
function identificarColunaId(linhas: LinhaPlanilha[]): string | null { /* header === "id" */ }

// Depois (esta demanda): recebida do chamador, não mais detectada aqui.
export function calcularMerge(
  registrosAtuais: EmailRecord[],
  linhasNovas: LinhaPlanilha[],
  colunas: { nome: string[]; email: string[] },
  tiposHabilitados: TipoConflito[],
  colunaId: string | null // novo parâmetro
): ResultadoMerge
```

`resolverIdDaLinha(linha, colunaId, indice)` já existe e não muda de comportamento — só deixa de ser alimentada pela detecção interna e passa a receber o `colunaId` vindo de fora.

**Novo módulo — validação compartilhada (`src/components/import/utils/validarColunaId.ts`, nome sugerido):**

```ts
export interface ResultadoValidacaoColunaId {
  valido: boolean;
  /** Mensagem pronta para exibir ao usuário quando `valido` for `false`. */
  erro?: string;
}

/**
 * Valida os valores de uma coluna candidata a ID: vazio, duplicado ou não
 * numérico bloqueiam a confirmação. `colunaId: null` (Gerar Automaticamente)
 * sempre é válido — não há o que checar.
 */
export function validarColunaId(
  linhas: LinhaPlanilha[],
  colunaId: string | null
): ResultadoValidacaoColunaId
```

Reaproveitada tanto pelo seletor de UI (Etapa 5) quanto por `construirRegistros.ts` (Etapa 2), para não duplicar a checagem de vazio/duplicado/não numérico em dois lugares.

**Nota sobre `identifyColumns.ts`:** o arquivo continua como referência (Fonte) só por contexto histórico — a lista `ID_COLUMNS` que ele usa para *adivinhar* a coluna de ID no `sync.ts` (CLI) não é reaproveitada por esta demanda, que substitui qualquer heurística de adivinhação por escolha explícita do usuário nos dois fluxos do navegador. `sync.ts` (CLI) permanece fora do escopo desta demanda — continua usando sua própria heurística, sem ler `colunaId`.

## 4. Decisões

- ~~Bloquear ou avisar em caso de valores vazios/duplicados?~~ → **Bloquear**, dado explicitamente pelo usuário. Estendido para também bloquear em caso de valor não numérico (ver decisão de tipo abaixo).
- ~~ID com 1 coluna fixa ou múltiplas com prioridade (como nome/email)?~~ → **1 coluna fixa.** ID não tem a propriedade de "variantes intercambiáveis" que nome/email têm; permitir fallback entre colunas de ID reintroduziria divergência silenciosa entre importações — o próprio problema que a demanda existe para evitar. Componente: `<select>` simples, mais leve que `ColunaSeletora.tsx`.
- ~~O escopo cobre só criação e remapeamento, ou também a reimportação ("Atualizar Registros")?~~ → **Também a reimportação.** Sem isso, o problema que a demanda resolve na criação reapareceria de forma silenciosa no fluxo de reimportação, que hoje cairia de volta na heurística frágil de `calcularMerge.ts`. Não ganha UI própria de seleção — só passa a *ler* a escolha já persistida.
- ~~Onde persistir a escolha?~~ → **Novo campo `colunaId?: string` em `EmailsData`.** Ausência do campo já é o fallback correto ("Gerar Automaticamente"), então não há necessidade de migração para projetos existentes.
- ~~IDs numéricos ou também string/alfanumérico (UUID, código com letras)?~~ → **Só numéricos nesta fase.** Ampliar `EmailRecord.id` para `string | number` afeta comparações, `Map`/índices por id, ordenação e outras partes do sistema fora do escopo desta demanda — desproporcional ao esforço estimado. Fica registrado como possível demanda futura; a validação bloqueante (vazio/duplicado/não numérico) cobre o caso enquanto isso.

## 5. Divisão em etapas

Ordem pensada para que modelo de dados e wiring do motor de merge existam **antes** de qualquer UI, já que as etapas de seletor dependem de ter onde salvar/ler o valor escolhido. Revisar ao iniciar cada etapa — o código pode ter mudado desde este mapeamento.

---

## ⚠️ Fluxo de entrega por etapas — leia antes de começar

Para toda demanda implementada, o processo segue duas partes: uma etapa preliminar de mapeamento (Etapa 0) e a regra de entrega cumulativa que vale a partir da Etapa 1.

### Etapa 0 — Mapeamento ✅ concluída

Etapa preliminar, que roda antes da Etapa 1 de qualquer demanda. Único objetivo: reunir de uma vez o contexto necessário, para que as etapas seguintes não dependam mais do projeto inteiro sendo reenviado a cada troca.

1. A partir do planner da demanda (este arquivo), identificar todos os arquivos envolvidos na implementação — Fontes, Alterados e Criados — mesmo os que ainda não existem, mas estão previstos para etapas futuras.

2. Retornar um único ZIP contendo o planner da demanda + todos esses arquivos. Os "Criados" que ainda não foram implementados devem ser criados e guardados vazios.

A partir daqui, o usuário passa a enviar apenas o ZIP mais recente como referência — nunca mais o projeto inteiro.

**Nota de execução (Etapa 0):** ZIP montado com 10 arquivos — 8 já existentes (`identifyColumns.ts` como Fonte; `types/email.ts`, `construirRegistros.ts`, `calcularMerge.ts`, `EtapaMapeamento.tsx`, `ColunaSeletora.tsx`, `AtualizarDadosModal.tsx`, `AtualizarRegistrosModal.tsx` como Alterados) e 1 Criado (`validarColunaId.ts`, vazio — nenhuma etapa de implementação foi iniciada ainda), além deste planner. Antes de montar o ZIP, os 8 arquivos existentes foram relidos do estado atual do projeto (pós-conclusão da Demanda 3) para confirmar que nada mudou debaixo do escopo já revisado: `calcularMerge.ts` continua com `identificarColunaId` interna restrita a header `"id"`, sem parâmetro de ID na assinatura pública; `construirRegistros.ts` continua sem nenhuma detecção de ID (`index + 1` sempre); `EmailsData` continua sem `colunaId`; `EtapaMapeamento.tsx`/`EstadoImportacao` continuam sem nada de ID; `ColunaSeletora.tsx` continua sem lista de exclusão externa; os dois modais de atualização (agora implementados de verdade pela Demanda 3) chamam `calcularMerge` exatamente na convenção assumida por este planner, sem parâmetro de ID. Nenhuma divergência encontrada; nenhum ajuste de rota necessário nesta etapa.

### Regra de entrega (Etapa 1 em diante)

A cada etapa, a entrega é **um único ZIP, cumulativo**:

- **Contém todos os arquivos necessários até aqui, não só os da etapa atual.** Isso inclui (a) todo arquivo efetivamente alterado desde a Etapa 1 desta revisão, e (b) todo arquivo listado como Fonte, Alterado ou Criado em qualquer etapa já concluída — mesmo os que nunca chegaram a ser modificados. Uma vez que um arquivo apareceu em algum ZIP, ele continua aparecendo em todos os ZIPs seguintes até o fim da implementação, para que o usuário nunca precise reenviar manualmente algo que ainda é relevante, só porque não mudou na etapa mais recente.

- **Sempre inclui o planner da demanda** (este arquivo), atualizado a cada entrega: etapas concluídas marcadas com "✅ concluída" no título, notas de execução preenchidas, e qualquer ajuste de rota registrado — caso um diagnóstico feito durante a implementação mude uma decisão já tomada no planner.

---

### Etapa 1 — Modelo de dados: persistência da escolha ✅ concluída

**Nota de execução:** `colunaId?: string` adicionado a `EmailsData` (`src/types/email.ts`), posicionado logo antes de `email`/`registros` (junto dos demais campos de metadados do projeto, como `slug`/`deletado_em`). Documentado no mesmo estilo de comentário já usado no restante da interface, explicando o fallback ("Gerar Automaticamente" quando ausente) e apontando para os três arquivos que vão lê-lo/gravá-lo nas próximas etapas (`construirRegistros.ts`, `AtualizarDadosModal.tsx`, `calcularMerge.ts`) e para o que só lê (`AtualizarRegistrosModal.tsx`). Nenhum outro campo ou tipo do arquivo foi tocado — mudança aditiva pura, um campo opcional novo. Sem ajuste de rota: o campo é exatamente como descrito na seção 3 deste planner.

Validado isoladamente (`tsc --noEmit --strict` contra o arquivo, que não importa nada de fora — self-contained): limpo, sem erros. Recomendo rodar `npm run build`/`npm run lint` no projeto completo antes de seguir para a Etapa 3, para confirmar que nenhum outro ponto do código desestrutura `EmailsData` de um jeito que a checagem de tipos exaustiva (`noUnusedLocals`/etc.) rejeitaria com o campo novo — não deveria acontecer, já que é opcional, mas é o mesmo cuidado já registrado nas notas de execução da Demanda 3.

**O que fazer:**
- Adicionar `colunaId?: string` a `EmailsData` (`types/email.ts`).
- Ausente/`undefined` = "Gerar Automaticamente" (comportamento atual). Sem migração necessária para projetos existentes.

**Por quê:** é a base de onde toda escolha do usuário passa a ser lida — as etapas seguintes (wiring do merge e da construção) dependem deste campo existir primeiro.

### Etapa 2 — Wiring em `construirRegistros.ts` (criação) ✅ concluída

**Nota de execução:** encontrada parcialmente feita ao iniciar esta rodada — `validarColunaId.ts` já existia implementado (vazio/duplicado/não numérico, na ordem correta por causa de `Number('') === 0`), mas `construirRegistros.ts` ainda não tinha sido ajustado: sem parâmetro `colunaId`, sem chamar a validação, `id` sempre `index + 1`. Completado agora: parâmetro `colunaId: string | null` (não opcional, seguindo a assinatura da seção 3 do planner, não a descrição livre desta etapa); `resolverIdDaLinha` reimplementada localmente (mesmo padrão de `pickFirstFilled` já existente no arquivo — este módulo não importa de `src/scripts/`); `validarColunaId` chamada antes de construir os registros, lançando `Error` com a mensagem pronta em caso de valor inválido (único precedente de erro síncrono no projeto é `identifyColumns.ts`, mesmo padrão reaproveitado). Nenhum call site de `construirRegistros` existe ainda neste ZIP (a integração real é Etapa 7), então a mudança de assinatura não quebra nada nesta entrega.

Validado isoladamente (`tsc --noEmit --strict`): limpo. Recomendo `npm run build`/`npm run lint` no projeto completo antes da Etapa 4, mesmo cuidado já registrado nas notas da Etapa 1.

### Etapa 3 — Wiring em `calcularMerge.ts` (merge) ✅ concluída

**Nota de execução:** `identificarColunaId` (heurística de header `"id"`) removida; `calcularMerge` passa a receber `colunaId: string | null` como 5º parâmetro (posição final, para não reordenar os 4 já existentes e minimizar o diff nos chamadores). `resolverIdDaLinha` não mudou de comportamento — só deixou de ser alimentada pela detecção interna.

Chamadas ajustadas em `AtualizarDadosModal.tsx` (escopo explícito desta etapa): adicionei `colunaId?: string` a `Props` (opcional — o componente pai que renderiza este modal não faz parte dos "Arquivos Necessários" desta demanda e ainda não passa essa prop nesta entrega) e repassei `colunaId ?? null` nas duas chamadas de `calcularMerge`. A seção "Colunas" ainda não lê nem regrava `colunaId` de verdade — isso é escopo da Etapa 8.

**Ajuste de rota:** `AtualizarRegistrosModal.tsx` também chama `calcularMerge` (2 vezes) e não fazia parte do escopo declarado desta etapa, mas quebraria a checagem de tipos se eu não tocasse nele — mudar a assinatura de uma função exportada exige ajustar todo chamador, não só o citado no texto da etapa. Passei `null` explicitamente nas duas chamadas, com comentário no código apontando para a Etapa 9. **Atenção — regressão temporária:** antes desta etapa, uma planilha reimportada com cabeçalho literalmente `"id"` era detectada automaticamente nesse fluxo; entre agora e a conclusão da Etapa 9 (que lê o `colunaId` persistido do projeto), esse fluxo sempre casa por ordem de linha, mesmo que a planilha tenha uma coluna `"id"` explícita. Não afeta projetos sem coluna `"id"` no cabeçalho (maioria dos casos, dado que a demanda existe justamente porque esse header raramente existe). Vale acelerar a Etapa 9 se isso for usado em produção no meio do caminho.

Validado isoladamente (`tsc --noEmit --strict` contra os 4 arquivos alterados desta etapa, checando as assinaturas cruzadas manualmente já que não tenho o projeto completo/`node_modules` aqui): consistente. Recomendo `npm run build`/`npm run lint` completos antes da Etapa 4 — em especial para confirmar que não há outro chamador de `calcularMerge` fora dos arquivos deste ZIP.

### Etapa 4 — Estado compartilhado de "colunas em uso" ✅ concluída

**Nota de execução:** estado `colunasEmUso: Record<'id'|'nome'|'email', string[]>` subido para `EtapaMapeamento.tsx` (`useMemo`), exatamente na forma sugerida pela seção 3 do planner. `id` fica como placeholder vazio nesta etapa — o seletor de ID (e o estado local que ele precisa) só nasce na Etapa 5; `colunasEmUso.id` passa a refletir a escolha real a partir de lá.

Derivado dele, `colunasExcluidas` (mesma forma) calcula, por atributo, as colunas já em uso pelos outros dois. Ainda não conectado a `ColunaSeletora` como desabilitação de checkbox — isso é escopo explícito da Etapa 6, que ainda não veio. Para o cálculo não ficar como código morto nesta entrega (o projeto roda com `noUnusedLocals` — ver nota da Etapa 1) e para já entregar algum valor visível nesta etapa, usei `colunasExcluidas.nome`/`.email` num aviso textual simples acima de cada `ColunaSeletora` ("N coluna(s) já em uso por outro campo"), sem alterar `ColunaSeletora.tsx` em si. `colunasExcluidas.id` fica computado mas sem seção própria ainda para exibi-lo (não há 3º seletor até a Etapa 5) — não é código morto porque é uma propriedade de um objeto cujo `const` pai (`colunasExcluidas`) já é referenciado, `noUnusedLocals` não se aplica a propriedades individuais.

**Ajuste de rota:** `EtapaMapeamento.tsx` não tinha `EstadoImportacao` (`./types`) neste ZIP — o arquivo não faz parte dos "Arquivos Necessários" desta demanda. Não precisei alterá-lo: o estado novo desta etapa (`colunasEmUso`/`colunasExcluidas`) é local ao componente, derivado de campos que já existem em `EstadoImportacao` (`colunasNome`/`colunasEmail`), sem precisar de nenhum campo novo no tipo em si. Se a Etapa 5 precisar persistir a escolha de ID em `EstadoImportacao` (para sobreviver a re-render/navegação entre etapas do wizard), pode ser necessário pedir esse arquivo — sinalizado como possível pendência.

**O que fazer (original, referência):**
- Subir para o componente pai (`EtapaMapeamento.tsx`) o cálculo de quais colunas já estão selecionadas para nome/email/id.
- Definir a forma desse estado (provavelmente `Record<'id'|'nome'|'email', string[]>` ou equivalente) e como ele desce para os 3 seletores.

**Por quê:** a exclusividade entre atributos (Etapa 6) precisa de um único lugar que saiba, a qualquer momento, quais colunas já estão em uso por qualquer um dos 3 atributos.

### Etapa 5 — Seletor de coluna de ID + validação bloqueante ✅ concluída

**O que fazer:**
- Novo `<select>` simples, opção "Gerar Automaticamente" como padrão, listando as colunas da planilha **exceto** as já em uso por nome/email.
- Ao escolher uma coluna, verificar vazios/duplicados/não numéricos nos valores usando `validarColunaId` (seção 3); bloquear confirmação e exibir feedback se houver problema.

**Por quê:** é a interface que de fato expõe a escolha ao usuário — sem ela, o campo `colunaId` (Etapa 1) nunca teria como ser preenchido por uma ação real.

**Nota de execução:** `<select>` simples adicionado a `EtapaMapeamento.tsx`, terceira seção (depois de Nome e E-mail), com "Gerar Automaticamente" (`value=""`, mapeado para `colunaId: null`) como padrão. Opções filtradas por `colunasExcluidas.id` (já não lista colunas em uso por nome/e-mail — a exclusividade do lado do ID já funciona de verdade nesta etapa, mesmo antes de `ColunaSeletora.tsx` ganhar a mesma capacidade para nome/e-mail na Etapa 6). Validação bloqueante via `validarColunaId` (mesmo módulo da Etapa 2), mensagem de erro exibida abaixo do select com `role="alert"` e `aria-invalid`/`aria-describedby` no próprio `<select>`.

**Ajustes de rota (2), ambos por arquivos fora do escopo desta demanda que este ZIP não tem:**

1. **`estado.colunaId` assumido em `EstadoImportacao` (`./types`).** Esse arquivo não veio em nenhum ZIP até agora. Segui o mesmo padrão já usado por `colunasNome`/`colunasEmail` (campo em `EstadoImportacao`, atualizado via `onEstadoChange`), com tipo assumido `colunaId: string | null`. Se o tipo real for diferente (ex.: campo ainda não existe, ou é opcional em vez de `string | null`), é só enviar `types.ts` no próximo ZIP para eu ajustar — mudança pequena, isolada neste arquivo.
2. **Novo prop `linhas: LinhaPlanilha[]` em `EtapaMapeamento`.** Necessário para `validarColunaId` checar os valores reais da coluna (não só os cabeçalhos). O componente que renderiza `EtapaMapeamento` (o wizard container, fora do escopo desta demanda) precisa passar essa prop a mais — provavelmente já tem esse array em mãos (é o mesmo `planilha.linhas` que os outros fluxos já usam), só não vinha sendo repassado porque `EtapaMapeamento` não precisava dele até agora. Se o build quebrar por falta dessa prop no chamador, é só me avisar com o arquivo do wizard container.

**Nota sobre "bloquear confirmação":** o bloqueio de fato do botão "Avançar" do wizard não é responsabilidade deste componente — quem sabe se deve desabilitar o botão é o wizard container (fora do escopo desta demanda), que já teria acesso tanto a `estado.colunaId` quanto a `planilha.linhas` para rodar a mesma `validarColunaId` e decidir. Aqui só garanto que a mensagem de erro aparece de forma visível; se o wizard container vier num próximo ZIP, posso confirmar/ajustar essa gate junto.

### Etapa 6 — Exclusividade em `ColunaSeletora.tsx` ✅ concluída

**Nota de execução:** novo prop opcional `colunasExcluidas?: string[]` (default `[]` — mesmo comportamento de antes desta demanda quando omitido). Cada opção de checkbox cujo header está em `colunasExcluidas` fica com `disabled`, exceto se a própria coluna já estiver em `selecionadas` — proteção para o usuário nunca ficar com um checkbox travado sem conseguir desmarcá-lo, caso a lista de exclusão externa mude sob ele (não deveria acontecer na prática, já que quem monta a lista de exclusão exclui o que já está selecionado ali mesmo, mas é defensivo e barato). Rótulo textual "Já usada por outro campo" ao lado da opção desabilitada, além da classe `coluna-seletora-opcao-desabilitada` no `<label>` para estilização.

`EtapaMapeamento.tsx` atualizado para passar `colunasExcluidas.nome`/`colunasExcluidas.email` (já calculadas na Etapa 4) para os dois `ColunaSeletora`. Os avisos textuais acima de cada seletor (adicionados na Etapa 4) tiveram a redação ajustada de "já em uso" para "desabilitada(s) abaixo — já em uso", já que agora refletem uma desabilitação real, não só informativa.

**Fora do escopo desta etapa (propositalmente):** `AtualizarDadosModal.tsx` também usa `ColunaSeletora`, mas não foi tocado aqui — como o novo prop é opcional, a chamada existente lá continua compilando sem passá-lo. Reaproveitar a exclusividade nesse fluxo (Demanda 3) é escopo explícito da Etapa 8.

**O que fazer:**
- Adaptar `ColunaSeletora.tsx` para aceitar lista de exclusão externa (colunas usadas pelos outros 2 atributos) e desabilitá-las nas opções de nome/email.

**Por quê:** sem isso, seria possível marcar a mesma coluna como Nome, E-mail e ID ao mesmo tempo — o problema de divergência silenciosa que a demanda existe para evitar reapareceria por outra porta.

### Etapa 7 — Reaproveitar no wizard de importação ✅ concluída

**O que fazer:**
- Integrar Etapas 4–6 em `EtapaMapeamento.tsx`; ao confirmar, o `colunaId` escolhido é persistido em `EmailsData` na criação do projeto (via Etapa 2).

**Por quê:** fecha o primeiro dos dois pontos de entrada da demanda — sem essa integração, a escolha feita no seletor nunca chegaria a `construirRegistros`.

**Nota de execução:** `colunaId: string | null` adicionado de verdade a `EstadoImportacao` (`import/types.ts`) e a `ESTADO_IMPORTACAO_INICIAL` (`null` — "Gerar Automaticamente" por padrão) — a suposição feita na Etapa 5 (campo ainda não confirmado) estava correta na forma, só não existia ainda no arquivo real. Em `ImportWizardModal.tsx`: `<EtapaMapeamento>` passa a receber a prop `linhas={planilha.linhas}` (exigida desde a Etapa 5); `construirRegistros` passa a receber `estado.colunaId` como 4º argumento (a chamada anterior, com 3 argumentos, já não compilava contra a assinatura da Etapa 2); e `etapa2Valida` (gate do botão "Avançar" na etapa de Mapeamento) passou a exigir também `validarColunaId(planilha.linhas, estado.colunaId).valido`, fechando o critério de aceite 7.2 ("bloqueia o avanço com feedback visível") — antes desta etapa, só a mensagem de erro aparecia (Etapa 5), sem impedir o avanço de fato.

`criarProjeto` (`services/projetosApi.ts`) ganhou um 6º parâmetro **opcional** `colunaId?: string | null` (opcional, não obrigatório como o padrão de Etapa 3/`calcularMerge`, para não arriscar quebrar outros chamadores de `criarProjeto` fora do escopo desta demanda), enviado no corpo da requisição como `colunaId: colunaId ?? null`.

**Confirmado com `vite.config.ts` (`projetosApiPlugin`, handler de `POST /api/projetos`):** a suspeita registrada na entrega anterior estava correta — o handler desestruturava só `{ slug, projeto, email, registros, arquivo }` do corpo, descartando `colunaId` silenciosamente. Corrigido: `formatoValido` passa a aceitar `colunaId` ausente/`undefined` (chamadores antigos), `null` (client atual) ou `string`, rejeitando qualquer outro tipo com o mesmo `ApiError(400, ...)` já usado para os demais campos; `colunaId` desestruturado do corpo; `dadosProjeto` grava o campo só quando é uma string não vazia (spread condicional `...(typeof colunaId === 'string' && colunaId !== '' ? { colunaId } : {})`), preservando a semântica "ausente = Gerar Automaticamente" de `EmailsData.colunaId?: string` (não gravar `null` explícito no JSON, que é o tipo usado internamente pelo client/`construirRegistros`/`calcularMerge`, mas não o tipo do campo persistido).

Cadeia agora fechada de ponta a ponta: seletor (Etapa 5) → `estado.colunaId` → `construirRegistros` (resolve `id`) e `criarProjeto` (persiste `colunaId`) → `projetosApiPlugin` grava em `emails.json`.

Validado isoladamente (`tsc --noEmit --strict` contra os arquivos `.ts`/`.tsx` alterados, checando as assinaturas cruzadas manualmente): consistente. Recomendo `npm run build`/`npm run lint` completos antes da Etapa 8, e o Teste 1 da seção 8.2 (importar com uma coluna de ID e inspecionar `emails.json`) para confirmar em ambiente real.

### Etapa 8 — Reaproveitar na Demanda 3 (Atualizar Dados > Colunas) ✅ concluída

**O que fazer:**
- Integrar o mesmo seletor + exclusividade + validação na seção "Colunas" do `AtualizarDadosModal.tsx`; ao confirmar, `colunaId` é regravado em `EmailsData` e repassado ao motor de merge (Etapa 3) para o remapeamento em curso.

**Por quê:** fecha o segundo ponto de entrada — permite corrigir a estratégia de ID de um projeto já existente, do mesmo jeito que já é possível corrigir o mapeamento de nome/e-mail.

**Nota de execução:** novo estado local `colunaIdSelecionado` em `AtualizarDadosModal.tsx`, inicializado a partir da prop `colunaId` (persistida do projeto, Etapa 3) — mesmo papel que `colunasNome`/`colunasEmail` têm como estado editável local. `colunasEmUso`/`colunasExcluidas`/`opcoesColunaId`/`validacaoColunaId` replicados de `EtapaMapeamento.tsx` (Etapas 4/5/6), reaproveitando `validarColunaId`. As duas chamadas a `calcularMerge` (`resultadoAtual` e dentro de `avancar`) passaram a usar `colunaIdSelecionado` em vez da prop crua, para que a troca feita no seletor desta sessão já afete o merge em curso, não só a próxima montagem do componente. `avancarHabilitado` da seção "colunas" passou a exigir também `validacaoColunaId.valido`, fechando o bloqueio de avanço (mesmo critério 7.2 já fechado para o wizard de importação na Etapa 7). Os dois `ColunaSeletora` (nome/e-mail) passaram a receber `colunasExcluidas.nome`/`.email`; novo `<select>` de "Coluna de ID" adicionado à seção "Colunas", mesma marcação/acessibilidade de `EtapaMapeamento.tsx`.

Confirmado com o arquivo real de `ColunaSeletora.tsx` (chegou na entrega da Etapa 6): a assinatura de props inferida quando este componente foi escrito (`titulo`, `headers`, `selecionadas`, `busca`, `onBuscaChange`, `onAlternarColuna`, `onReordenar`, `idPrefix`) bateu exatamente, incluindo o prop opcional `colunasExcluidas` — nenhum ajuste retroativo necessário.

**Servidor (`vite.config.ts`, `emailsApiPlugin`, handler de `PUT /api/emails/:slug`) — ajustado nesta entrega:** `formatoValido` passou a aceitar `colunaId` ausente/`undefined` (chamadores antigos), `null` ou `string`. `dadosMesclados` só mexe em `colunaId` quando o corpo o envia explicitamente (`dados.colunaId !== undefined`): grava a string quando não vazia, remove o campo quando `null`/vazia, e preserva o valor já persistido (via spread de `dadosAtuais`) quando o chamador não manda o campo — sem regressão para `AtualizarRegistrosModal` (Etapa 9, ainda não enviado esse campo).

**Nota de execução (fechamento da pendência):** `services/emailsApi.ts` chegou nesta entrega. `DadosEditaveis` ganhou o campo opcional `colunaId?: string | null`, no mesmo estilo/posição de `projeto?` (comentário documentando a semântica "omitido = preserva o valor já persistido", espelhando o comportamento já implementado no servidor na nota anterior). `confirmarAtualizacao` (`AtualizarDadosModal.tsx`) passou a chamar `salvarEmails(slugFinal, { email: emailAtual, registros: snapshot, projeto: nomeProjeto, colunaId: colunaIdSelecionado })` — sem mais "excess property", já que o tipo do parâmetro agora prevê o campo. `colunaIdSelecionado` é `string | null`, compatível ponto a ponto com o tipo aceito por `DadosEditaveis.colunaId` e com o que o handler do servidor (`emailsApiPlugin`) já esperava. Nenhuma outra alteração necessária em `AtualizarDadosModal.tsx`: o merge em curso já usava `colunaIdSelecionado` desde a nota de execução anterior — só faltava a persistência sobreviver ao fechar o modal, o que esta chamada resolve.

Cadeia agora fechada de ponta a ponta neste segundo ponto de entrada: seletor "Colunas" → `colunaIdSelecionado` → `calcularMerge` (efeito imediato no remapeamento em curso) e `salvarEmails` (persistência) → `emailsApiPlugin` regrava `EmailsData.colunaId`.

Validado isoladamente (`tsc --noEmit --strict` contra os dois arquivos alterados nesta entrega, checando as assinaturas cruzadas manualmente): consistente — `colunaId?: string | null` em `DadosEditaveis` aceita exatamente o tipo de `colunaIdSelecionado` (`string | null`), e a chamada em `confirmarAtualizacao` compila sem erro de excess property. Recomendo `npm run build`/`npm run lint` completos e o Teste 4 da seção 8.5 (trocar a coluna de ID em "Atualizar Dados > Colunas", confirmar e inspecionar `emails.json`) para validar em ambiente real antes de seguir para a Etapa 9.

**Nota de execução (fechamento do wiring — `Header.tsx`, chegou nesta entrega):** `Header.tsx` é quem de fato renderiza `<AtualizarDadosModal ... />` — o "componente pai" citado como pendência desde a Etapa 3. Adicionei `colunaId?: string` a `Props` de `Header.tsx` (mesmo estilo/documentação da prop equivalente em `AtualizarDadosModal`/`AtualizarRegistrosModal`) e passei `colunaId={colunaId}` na renderização do modal.

**Nota de execução (fechamento definitivo — `pages/emails.tsx`, chegou nesta entrega):** `pages/emails.tsx` é quem de fato renderiza `<Header ... />` — o último elo da cadeia, confirmando a suspeita registrada acima. Ajustada a chamada `<Header slug={slug} nome={tituloPagina} registros={registros} email={email} onSalvarEmail={persistirEmailConteudo} />` para incluir `colunaId={dados.colunaId}` — `dados: EmailsData` já tinha `colunaId?: string` desde a Etapa 1, então nenhuma mudança de tipo foi necessária, só a prop faltando na chamada. Cadeia de ponta a ponta agora fechada: `EmailsData.colunaId` (persistido, resolvido pela rota antes deste componente montar) → `pages/emails.tsx` → `Header.tsx` → `AtualizarDadosModal`/`AtualizarRegistrosModal` → `calcularMerge`/`salvarEmails`.

### Etapa 9 — Reaproveitar em "Atualizar Registros" ✅ concluída

**O que fazer:**
- `AtualizarRegistrosModal.tsx` lê o `colunaId` já persistido no projeto e repassa ao motor de merge (Etapa 3) — sem seletor próprio nesse fluxo.
- Se a coluna indicada por `colunaId` não existir na planilha reimportada, exibir aviso visível de que o merge caiu no fallback de ordem de linha (não é regressão desta demanda, mas precisa deixar de ser silencioso).

**Por quê:** fecha a lacuna identificada na revisão de escopo (seção 1) — sem isso, o problema que a demanda resolve na criação reapareceria de forma silenciosa a cada reimportação.

**Nota de execução:** nova prop opcional `colunaId?: string` em `AtualizarRegistrosModal.tsx` (mesmo estilo/doc de `AtualizarDadosModal.tsx`, Etapa 8: ausente = "Gerar Automaticamente"). Normalizada uma vez, no topo do componente, para `colunaIdNormalizado: string | null` (formato exigido por `calcularMerge`) — diferente de `AtualizarDadosModal`, aqui não é estado editável (`useState`), já que este fluxo não tem seletor próprio: é só a leitura direta da prop.

**Correção de um bug pré-existente:** a chamada a `calcularMerge` dentro de `avancar` (recálculo a cada "Avançar", entre seções de conflito) estava com só 4 dos 5 argumentos exigidos pela assinatura da Etapa 3 — o `colunaId` explícito faltava por completo, não só fixado em `null` como no `resultadoAtual` inicial. Isso não teria compilado sob `tsc --strict`; corrigido junto com o wiring desta etapa (ambas as chamadas — `resultadoAtual` e dentro de `avancar` — agora usam `colunaIdNormalizado`).

**Aviso de coluna ausente:** novo `colunaIdAusenteNaPlanilha` (`useMemo`, depende de `colunaIdNormalizado`/`planilha`) — verdadeiro quando o projeto tem `colunaId` mas o cabeçalho da planilha reimportada não o contém. Não interfere no cálculo do merge (`resolverIdDaLinha`, dentro de `calcularMerge`, já cai sozinho no fallback de ordem de linha nesse caso) — só controla a exibição de um `<p role="alert">` fixo logo no topo do conteúdo do modal, visível em qualquer seção do wizard (não só no resumo inicial), citando o nome da coluna ausente.

**Ajuste de rota (mesma pendência já registrada na Etapa 8 de `AtualizarDadosModal`):** o componente que renderiza `AtualizarRegistrosModal` (provavelmente `Header.tsx` ou a página do projeto) não fez parte dos "Arquivos Necessários" desta demanda e não veio em nenhum ZIP até agora — não é possível confirmar nem ajustar a chamada `<AtualizarRegistrosModal ... />` para passar `colunaId={project.colunaId}`. A prop ficou opcional exatamente por isso; sem esse wiring do lado de fora, o componente sempre recebe `colunaId === undefined` e se comporta como "Gerar Automaticamente" (mesmo comportamento de hoje — sem regressão, mas também sem o benefício da demanda até o wiring ser fechado). Se esse arquivo pai for enviado num próximo ZIP, fecho esse último passo.

**Nota de execução (fechamento do wiring — `Header.tsx`, chegou nesta entrega):** a suspeita acima estava correta — `Header.tsx` é quem renderiza `<AtualizarRegistrosModal ... />`. Adicionei `colunaId?: string` a `Props` de `Header.tsx` (uma única prop nova, documentada, reaproveitada pelos dois modais desta demanda — ver nota equivalente na Etapa 8) e passei `colunaId={colunaId}` na renderização deste modal. Fechamento definitivo (`pages/emails.tsx` → `Header.tsx`) documentado na nota da Etapa 8, que cobre os dois modais de uma vez — mesma prop, mesma origem (`dados.colunaId`).

**Nota sobre estilo do aviso:** a classe `atualizar-alerta-colunaid-ausente` usada no `<p>` do aviso não tem CSS correspondente nesta entrega — nenhum arquivo `.css` fez parte dos "Arquivos Necessários" desta demanda (mesma situação de todas as outras classes novas introduzidas pelas etapas anteriores, ex. `coluna-seletora-opcao-desabilitada` na Etapa 6). Puramente uma questão de estilo visual, não de funcionalidade — o aviso já é semanticamente visível (`role="alert"`) independente do CSS.

Validado isoladamente (`tsc --noEmit --strict` contra o arquivo alterado, checando a assinatura de `calcularMerge` importada): consistente — as duas chamadas agora passam os 5 argumentos exigidos, e `colunaIdAusenteNaPlanilha` só lê propriedades já tipadas (`planilha.headers: string[]`, inferido do uso existente em `identificarColunasAutomaticamente(planilha.headers)`). Recomendo `npm run build`/`npm run lint` completos e os Testes 5 e 6 (seções 8.6 e 8.7) para validar em ambiente real, assim que o wiring do componente pai permitir passar um `colunaId` real para este modal.

Com esta etapa, as 9 etapas do escopo revisado (seção 1) estão implementadas, com o wiring fechado de ponta a ponta — `EmailsData.colunaId` (persistido) → `pages/emails.tsx` → `Header.tsx` → os dois modais → `calcularMerge`/`salvarEmails`. Nenhum ajuste de rota pendente. Falta apenas a validação em ambiente real (seção 8, especialmente os Testes 5 e 6) — não executável aqui, já que este ZIP contém só o subconjunto de arquivos desta demanda, não o repositório completo com dependências instaláveis.

### Etapa 10 — Estilização das classes novas (fecha a pendência das notas das Etapas 6 e 9) ✅ concluída

**O que fazer:** adicionar ao `src/index.css` as regras faltantes para todas as classes novas introduzidas pelas Etapas 5, 6, 7, 8 e 9, que ficaram sem CSS correspondente porque nenhum arquivo `.css` fazia parte dos "Arquivos Necessários" originais desta demanda (ver nota de execução da Etapa 9).

**Nota de execução:** projeto completo (`Malote-Project.zip`, incluindo `src/index.css`) recebido para diagnóstico, permitindo confirmar por grep — em vez de suposição — quais classes estavam de fato sem regra. Confirmadas sem CSS: `.etapa-mapeamento-secao` (wrapper das 3 seções da Etapa 4 — nome/e-mail/id — nunca tinha tido regra própria, nem antes desta demanda), `.etapa-mapeamento-aviso-exclusividade` (aviso de exclusividade, Etapa 4), `.etapa-mapeamento-secao-id`/`.etapa-mapeamento-secao-id-descricao` (seção do seletor de ID, Etapa 5), `.etapa-mapeamento-erro-bloqueante` (mensagem de validação bloqueante, Etapa 5), `.coluna-seletora-opcao-desabilitada`/`.coluna-seletora-motivo-desabilitada` (estado desabilitado por exclusividade, Etapa 6) e `.atualizar-alerta-colunaid-ausente` (aviso de coluna ausente, Etapa 9).

Regras adicionadas em `src/index.css`, reaproveitando os tokens (`--color-*`, `--radius-*`) e os padrões visuais já usados por classes irmãs existentes: `.etapa-mapeamento-secao-id` ganhou `grid-column: 1 / -1` para ocupar a largura cheia do grid de 2 colunas de `.etapa-mapeamento-secoes` (a seção de ID é única, abaixo de nome/e-mail, não um terceiro item lado a lado) e uma borda superior separando visualmente do par nome/e-mail; `.etapa-mapeamento-aviso-exclusividade` e `.atualizar-alerta-colunaid-ausente` seguem o padrão de "alerta" (`--color-warning`/`--color-warning-bg`, `--radius-sm`/`--radius-md`) já usado por `.atualizar-alerta-conflitos`; `.etapa-mapeamento-erro-bloqueante` segue o padrão de erro (`--color-danger`/`--color-danger-bg`) já usado por `.importacao-erro p`; `.coluna-seletora-opcao-desabilitada` reaproveita o mesmo `opacity`+`cursor: not-allowed` de outros estados desabilitados do projeto.

Não houve mudança de marcação (JSX) em nenhum componente — só CSS. Nenhuma classe nova foi introduzida além das já existentes no código.

Com esta etapa, a Demanda 7 fica sem pendências conhecidas de estilo. Segue faltando apenas a validação manual em ambiente real (seção 8) — ainda não executável aqui.

### Etapa 11 — Correção de bug estrutural + simplificação do aviso de exclusividade ✅ concluída

**O que aconteceu:** captura de tela real do modal "Atualizar Dados > Colunas" mostrou o aviso de exclusividade (`.etapa-mapeamento-aviso-exclusividade`) renderizado como uma caixa amarela enorme, ocupando a coluna inteira do grid — não um bug de CSS ausente (Etapa 10 já havia adicionado a regra), e sim um bug de marcação: em `AtualizarDadosModal.tsx`, diferente de `EtapaMapeamento.tsx`, o `<p>` do aviso e o `<ColunaSeletora>` de cada atributo **não** estavam agrupados dentro de um `<div className="etapa-mapeamento-secao">` comum — ambos eram filhos diretos, soltos, de `.etapa-mapeamento-secoes` (grid de 2 colunas). O grid intercalou os 4 itens em 2 colunas × 2 linhas (avisos numa coluna, seletores na outra) e, por causa do `align-items: stretch` padrão do CSS Grid, o `<p>` do aviso — sem altura própria — esticou para ocupar toda a altura da linha, definida pelo `ColunaSeletora` ao lado. `EtapaMapeamento.tsx` nunca teve esse problema porque já envolvia aviso + seletor no mesmo `.etapa-mapeamento-secao` desde a Etapa 4.

**Nota de execução (correção do bug):** adicionados os `<div className="etapa-mapeamento-secao">` faltantes em `AtualizarDadosModal.tsx`, um por atributo (nome/e-mail), replicando exatamente a estrutura de `EtapaMapeamento.tsx`.

**Nota de execução (simplificação, pedido explícito do usuário):** o aviso agregado ("N coluna(s) desabilitada(s) abaixo — já em uso por outro campo") foi removido dos dois pontos de entrada (`EtapaMapeamento.tsx` e `AtualizarDadosModal.tsx`) — informação redundante, já que cada opção desabilitada individualmente já exibe `.coluna-seletora-motivo-desabilitada` ("Já usada por outro campo") ao lado do próprio checkbox. A regra CSS `.etapa-mapeamento-aviso-exclusividade` foi removida de `src/index.css` (classe sem nenhum uso restante). `colunasExcluidas.nome`/`.email` continuam calculados e em uso — agora só como prop de exclusão para `ColunaSeletora`, sem o texto agregado.

**Nota de execução (estilização real do `<select>` de ID):** a regra da Etapa 10 só tinha `max-width`, sem nenhuma propriedade visual — a única cobertura vinha do seletor global `select { font-family; color }` (sem borda, fundo, padding ou raio). Adicionado `.etapa-mapeamento-secao-id select` completo (borda, fundo, padding, `border-radius`, tamanho de fonte), no mesmo padrão de `.modal-campo select`/`.theme-selector-filtros select`, mais um estado de foco (`:focus-visible`) consistente com o resto do projeto.

Nenhuma mudança de comportamento/lógica — só marcação (agrupamento em `.etapa-mapeamento-secao`, remoção do aviso agregado) e CSS.

## 6. Arquivos Necessários

**Arquivos Fonte** (usados como referência, não sofrem alteração):
- `src/scripts/utils/identifyColumns.ts` — lógica de detecção automática por heurística (Node/CLI, `sync.ts`), citada só por contraste: esta demanda substitui adivinhação por escolha explícita (ver seção 3).

**Arquivos Alterados:**
- `src/types/email.ts` — novo campo `colunaId?: string` em `EmailsData` (Etapa 1).
- `src/components/import/utils/construirRegistros.ts` — resolve `id` a partir da coluna escolhida, com fallback (Etapa 2).
- `src/scripts/utils/calcularMerge.ts` — recebe `colunaId` como parâmetro explícito em vez de detectar internamente (Etapa 3).
- `src/components/import/EtapaMapeamento.tsx` — estado compartilhado de colunas em uso + seletor de ID + confirmação persiste `colunaId` (Etapas 4, 5, 7).
- `src/components/import/ColunaSeletora.tsx` — aceita lista de exclusão externa (Etapa 6).
- `src/components/atualizar/AtualizarDadosModal.tsx` — reaproveita seletor + exclusividade + validação; repassa `colunaId` ao motor de merge e regrava a escolha (Etapa 8).
- `src/components/atualizar/AtualizarRegistrosModal.tsx` — nova prop opcional `colunaId?: string`; normaliza para `colunaIdNormalizado` e repassa às duas chamadas de `calcularMerge` (corrigindo também uma chamada que faltava o parâmetro por completo); novo aviso visível (`colunaIdAusenteNaPlanilha`) quando a coluna não existe na planilha reimportada (Etapa 9).
- `src/components/Header.tsx` — nova prop opcional `colunaId?: string`, repassada sem alteração a `AtualizarRegistrosModal` e a `AtualizarDadosModal` na renderização de ambos (fecha o wiring pendente desde a Etapa 3/9, ver notas de execução das duas etapas).
- `src/pages/emails.tsx` — chamada a `<Header ... />` passa a incluir `colunaId={dados.colunaId}`, fechando definitivamente a cadeia de wiring (Etapas 8 e 9).
- `src/components/import/types.ts` — novo campo `colunaId: string | null` em `EstadoImportacao` + `ESTADO_IMPORTACAO_INICIAL` (Etapa 7).
- `src/components/import/ImportWizardModal.tsx` — passa `linhas` e `colunaId` para `EtapaMapeamento`/`construirRegistros`, e gate de `etapa2Valida` (Etapa 7). Falta ainda repassar `colunaId` a `criarProjeto`.
- `src/services/projetosApi.ts` — `criarProjeto` ganhou parâmetro opcional `colunaId?: string | null`, enviado no corpo de `POST /api/projetos` (Etapa 7).
- `vite.config.ts` (`projetosApiPlugin`, handler de `POST /api/projetos`) — lê `colunaId` do corpo e grava em `EmailsData` só quando é uma string não vazia (Etapa 7).
- `vite.config.ts` (`emailsApiPlugin`, handler de `PUT /api/emails/:slug`) — mesma lógica de leitura/gravação condicional de `colunaId`, preservando o valor já persistido quando o chamador não envia o campo (Etapa 8).
- `src/services/emailsApi.ts` — `DadosEditaveis`/`salvarEmails` passam a aceitar `colunaId?: string | null` e repassá-lo no corpo de `PUT /api/emails/:slug`; `confirmarAtualizacao` (`AtualizarDadosModal.tsx`) já envia `colunaIdSelecionado` (Etapa 8).
- `src/index.css` — regras para as classes novas das Etapas 4–9 que ainda não tinham CSS: `.etapa-mapeamento-secao`, `.etapa-mapeamento-aviso-exclusividade`, `.etapa-mapeamento-secao-id`/`-descricao`, `.etapa-mapeamento-erro-bloqueante`, `.coluna-seletora-opcao-desabilitada`/`-motivo-desabilitada`, `.atualizar-alerta-colunaid-ausente` (Etapa 10).

**Arquivos Criados:**
- `src/components/import/utils/validarColunaId.ts` *(nome sugerido)* — validação bloqueante (vazio/duplicado/não numérico) compartilhada entre a Etapa 2 (construção) e a Etapa 5 (seletor/UI), evitando duplicar a lógica (ainda vazio nesta entrega).

## 7. Critérios de avaliação

A demanda será considerada **aprovada** quando todos os itens abaixo forem verdadeiros.

### 7.1 O que deve ser entregue

- Código-fonte com as 9 etapas implementadas.
- `colunaId` presente (ou explicitamente ausente, para "Gerar Automaticamente") em todo projeto criado ou com a estratégia de ID alterada a partir da conclusão da Etapa 1.
- Um resumo curto (no corpo do commit/PR) listando quais das 9 etapas foram concluídas.

### 7.2 O que o sistema deve fazer para ser aprovado

- **Build limpo:** `npm run build` (`tsc -b` + Vite) completa sem erros de tipo.
- **Lint limpo:** `npm run lint` não aponta erros novos.
- **Wizard de importação:** o seletor de coluna de ID aparece em `EtapaMapeamento`, com "Gerar Automaticamente" como padrão; escolher uma coluna já usada por nome/e-mail não é possível (desabilitada); escolher uma coluna com valores vazios/duplicados/não numéricos bloqueia o avanço com feedback visível.
- **Criação com ID customizado:** ao confirmar a importação com uma coluna de ID escolhida, os registros gravados usam os valores dessa coluna como `id` (não a ordem da linha), e `colunaId` é persistido em `emails.json`.
- **Atualizar Dados > Colunas:** o mesmo seletor + exclusividade + validação aparecem; trocar a coluna de ID e confirmar atualiza `colunaId` persistido e reflete no próximo merge.
- **Atualizar Registros respeita `colunaId`:** reimportar uma planilha nova casa os registros pelo valor da coluna indicada em `colunaId` (não pela ordem da linha nem pelo header `"id"` literal), sem exigir nenhuma ação do usuário nesse fluxo.
- **Aviso de coluna ausente:** reimportar uma planilha sem a coluna indicada por `colunaId` exibe aviso visível de que o merge caiu no fallback de ordem de linha.
- **Comportamento padrão preservado:** um projeto sem `colunaId` definido continua se comportando exatamente como hoje (ordem da linha), em todos os 3 fluxos.

## 8. Como testar e validar manualmente

### 8.1 Preparar o ambiente

```bash
npm install
npm run dev
```

Abra o endereço local mostrado no terminal (por padrão, algo como `http://localhost:5173`).

### 8.2 Teste 1 — seletor de ID no wizard de importação

1. Inicie uma importação com uma planilha que tenha uma coluna de identificador único (ex.: "Matrícula").
2. Na etapa de mapeamento, **verifique:** o seletor de coluna de ID aparece, com "Gerar Automaticamente" selecionado por padrão.
3. Escolha essa coluna como ID. **Verifique:** ela desaparece das opções de Nome e E-mail (exclusividade).
4. Conclua a importação e **verifique (inspecionando `emails.json`):** os `id` dos registros batem com os valores da coluna escolhida, e `colunaId` foi persistido.

### 8.3 Teste 2 — validação bloqueante

1. Repita a importação escolhendo uma coluna com valores vazios ou duplicados como ID.
2. **Verifique:** o avanço é bloqueado, com mensagem indicando o problema.
3. Repita escolhendo uma coluna com valores não numéricos (texto livre).
4. **Verifique:** o avanço também é bloqueado.

### 8.4 Teste 3 — comportamento padrão preservado

1. Importe uma planilha deixando "Gerar Automaticamente" selecionado.
2. **Verifique:** os `id` dos registros seguem a ordem da linha, como hoje; `colunaId` não é gravado (ou gravado como ausente).

### 8.5 Teste 4 — Atualizar Dados > Colunas

1. Abra um projeto existente, "Atualizar Dados" → "Colunas".
2. **Verifique:** o seletor de ID aparece, refletindo a estratégia atual do projeto.
3. Troque a coluna de ID e confirme. **Verifique:** `colunaId` foi atualizado em `emails.json`.

### 8.6 Teste 5 — Atualizar Registros respeita a coluna persistida

1. Num projeto com `colunaId` definido (Teste 1 ou 4), reimporte uma planilha nova via "Atualizar Registros", com valores da coluna de ID coincidindo parcialmente com os já existentes (alguns iguais, um novo).
2. **Verifique:** os registros são casados pelo valor da coluna indicada em `colunaId`, não pela ordem da linha — um registro cujo valor de ID já existia deve ser reconhecido como o mesmo registro mesmo que sua posição na planilha tenha mudado.

### 8.7 Teste 6 — aviso de coluna ausente

1. No mesmo projeto do Teste 5, reimporte uma planilha em que a coluna indicada por `colunaId` foi renomeada ou removida.
2. **Verifique:** aparece um aviso visível informando que o merge caiu no fallback de ordem de linha.

### 8.8 Teste 7 — build e checagem de tipos

```bash
npm run build
npm run lint
```

**Verifique:** ambos terminam sem erros.
