# DEMANDAS.md

> Este documento reúne as demandas levantadas para evolução do sistema, além da especificação já formalizada em `DEVME.md`. Diferente da especificação (que descreve o que **já foi decidido e está pronto para ser implementado**), este arquivo registra objetivos e ideias em diferentes estágios de maturidade — desde melhorias pontuais até a visão de longo prazo do projeto — para que não se percam entre uma conversa e outra.
>
> As demandas estão organizadas na ordem recomendada de execução (não pela numeração de identificação, que é fixa e não muda): **5 → 3 → 7 → 9 → 10 → 11 → 12 → 2 → 6 → 1 → 8** (Demanda 4 pausada — ver seção correspondente).

## Como usar este documento

Cada demanda segue o mesmo formato, para ficar fácil de escanear e de manter atualizado:

- **Status** — onde a demanda está no ciclo de vida agora (ver convenção abaixo).
- **Esforço estimado** — ordem de grandeza de tempo, não uma estimativa formal (projeto local/pessoal, sem sprint).
- **Depende de / Bloqueia** — dependências entre demandas, para a ordem de execução fazer sentido.
- **Escopo** — o que a demanda cobre e, igualmente importante, o que ela **não** cobre nesta fase.
- **Decisões em aberto** — perguntas de negócio que precisam de resposta antes (ou durante) a implementação. Só aparece quando existe alguma.
- **Etapas de Implementação** — quebra em passos sequenciais, no mesmo espírito da seção 8 de `DEVME.md`. Cada bloco de etapas carrega uma flag **`[Inicial]`** no cabeçalho, sinalizando que essa quebra foi feita antecipadamente e **deve ser revisada quando a demanda for de fato iniciada** — o código pode ter mudado, e a etapa 1 muitas vezes revela detalhes que reordenam o resto.

### Convenção de status

| Status | Significado |
|---|---|
| **Registrado** | Demanda levantada, mas ainda não destrinchada |
| **Mapeado** | Destrinchada — escopo e etapas prontos para iniciar a implementação |
| **Em execução** | Implementação em andamento |
| **Pausada** | Parada por algum motivo, ainda não concluída |
| **Concluída** | Implementação finalizada, aguardando validação completa |
| **Validada** | Validada 100% — a demanda em si é **removida** deste arquivo; só a linha na tabela de registro abaixo permanece, como histórico |

Ou seja: uma demanda **concluída** ainda mora aqui, com sua seção inteira, até ser validada. Só depois de **validada** ela sai do corpo do documento — mas nunca desaparece da tabela de registro, que funciona como histórico permanente de tudo que já foi levantado.

---

## ⚠️ Fluxo de entrega por etapas — leia antes de começar

Para toda demanda implementada, o processo segue duas partes: uma etapa preliminar de mapeamento (Etapa 0) e a regra de entrega cumulativa que vale a partir da Etapa 1.

### Etapa 0 — Mapeamento

Etapa preliminar, que roda antes da Etapa 1 de qualquer demanda. Único objetivo: reunir de uma vez o contexto necessário, para que as etapas seguintes não dependam mais do projeto inteiro sendo reenviado a cada troca.

1. A partir do planner da demanda (`nomeDaDemanda.md`), identificar todos os arquivos envolvidos na implementação — Fontes, Alterados e Criados — mesmo os que ainda não existem, mas estão previstos para etapas futuras.

2. Retornar um único ZIP contendo o planner da demanda + todos esses arquivos. Os "Criados" que ainda não foram implementados devem ser criados e guardados vazios.

A partir daqui, o usuário passa a enviar apenas o ZIP mais recente como referência — nunca mais o projeto inteiro.

### Regra de entrega (Etapa 1 em diante)

A cada etapa, a entrega é **um único ZIP, cumulativo**:

- **Contém todos os arquivos necessários até aqui, não só os da etapa atual.** Isso inclui (a) todo arquivo efetivamente alterado desde a Etapa 1 desta revisão, e (b) todo arquivo listado como Fonte, Alterado ou Criado em qualquer etapa já concluída — mesmo os que nunca chegaram a ser modificados. Uma vez que um arquivo apareceu em algum ZIP, ele continua aparecendo em todos os ZIPs seguintes até o fim da implementação, para que o usuário nunca precise reenviar manualmente algo que ainda é relevante, só porque não mudou na etapa mais recente.

- **Sempre inclui o planner da demanda** (`nomeDaDemanda.md`), atualizado a cada entrega: etapas concluídas marcadas com "✅ concluída" no título, notas de execução preenchidas, e qualquer ajuste de rota registrado — caso um diagnóstico feito durante a implementação mude uma decisão já tomada no planner.

> Observação: Sempre ao criar o documento individual de cada demanda, este bloco deve ser incluído no arquivo.

---

## Registro de Demandas

Tabela viva: toda demanda já levantada tem uma linha aqui, mesmo depois de removida do corpo do documento (status `Validada`). Ordenada pela ordem de execução recomendada.

| # | Demanda | Status | Esforço | Depende de | Bloqueia |
|---|---|---|---|---|---|
| 5 | Edição Individual de Registro | ✅ Concluída | Dias | — | 3 (novo requisito: conflito de sync) |
| 3 | Atualizar Planilha via UI | ✅ Concluída | Dias | 5 (modelo `backup_dados`) | — |
| 7 | Mapeamento de ID Personalizado | ✅ Concluída | Dias | — | — |
| 4 | Histórico de Alterações | ⏸️ Pausada | Horas–dias (versão simples) | — | — |
| 9 | Logs de Alterações | ✅ Concluída | Dias | — | — |
| 10 | Refatoração do Sistema de Duplicatas | ✅ Concluída | Dias | — | — |
| 11 | Backup/Exportação Completa do Sistema | Registrado | Dias | — | — |
| 12 | Testes Automatizados | Registrado | Dias | — | — |
| 2 | Variáveis no Texto (merge tags) | Registrado | Dias | — | 1 (para "fechar o ciclo") |
| 6 | Armazenamento Duplo (Banco + Local) | Registrado | Semanas | — | 1 (recomendado) |
| 1 | Envio Automático dos E-mails | Registrado | Semanas | 6 (recomendado) | — |
| 8 | Sistema de Seleção de Temas | ✅ Concluída | Dias | — | — |

---

## Demanda 5 — Edição Individual de Registro

**Status:** ✅ Concluída
**Esforço estimado:** Dias — cresceu de escopo em relação à ideia original, ao unificar a proteção de nome/e-mail/status num único mecanismo
**Depende de:** —
**Bloqueia:** Demanda 3 (a reimportação de planilha precisa saber lidar com registros protegidos por `backup_dados`)

### Contexto

Hoje, para corrigir um erro de digitação em um registro (nome ou e-mail), o único caminho é reimportar a planilha inteira via `sync.ts` no terminal. A própria tabela já resolve esse problema para o campo `status` (`EmailTable.renderStatus`, com um `<select>` inline substituindo o badge) — o mesmo padrão se estende a nome e e-mail, mas isso levanta uma pergunta maior: como proteger uma correção manual contra ser silenciosamente sobrescrita numa reimportação futura?

A resposta virou um redesenho do mecanismo de proteção que já existia (`status_alterado`), generalizando-o para qualquer campo editável manualmente — não só o status.

### Escopo

**Cobre:**
- Edição inline de `nome` e `email` diretamente na célula da tabela (`EmailTable.tsx`), no mesmo espírito visual do stepper de tamanho de fonte do editor (buffer local de digitação + confirmação só no blur/Enter).
- Persistência imediata via o pipeline já existente (`persistirRegistros`), sem botão "Salvar".
- Revalidação do e-mail digitado (mesma regex de `EmailStatus.ts`).
- Um novo modelo de proteção unificado (`backup_dados`), que substitui `status_alterado` e passa a cobrir também `nome` e `email`.
- Um único botão "Restaurar" por linha (não mais por célula), que resolve automaticamente quando há só um campo alterado, ou abre um modal de escolha quando há mais de um.

**Não cobre nesta fase:**
- Edição em massa de nome/e-mail para múltiplos registros ao mesmo tempo — é, por natureza, uma correção pontual (cada registro tem um valor único), diferente de status (um conjunto pequeno e fixo de opções, onde aplicar a mesma escolha a vários registros já faz sentido hoje).
- Edição de outros campos além de nome/e-mail (`id` não deve ser editável — é a chave de sincronização com a planilha).

### Modelo de dados: `backup_dados`

Substitui inteiramente o campo `status_alterado` (booleano) de `EmailRecord`:

```ts
interface EmailRecord {
  id: number;
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

### Botão "Restaurar" por linha

- Um único botão por registro, no canto direito da linha (não mais um botão por célula).
- Visível somente quando **as duas condições** são verdadeiras: (1) `backup_dados` tem pelo menos uma chave presente, e (2) a linha está sob hover ou está selecionada via checkbox — mesmo padrão de visibilidade condicional já usado em `botao-icone-th` (`visibility: hidden` reservando o espaço, não `display: none`).
- **Se `backup_dados` tem exatamente 1 chave:** restaura direto, sem modal — aplica a regra de restauração do campo correspondente (ver acima).
- **Se `backup_dados` tem 2 ou mais chaves:** abre um modal de conflito para o usuário escolher quais campos restaurar.

### Modal de restauração — individual vs. em massa

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

### Etapas de Implementação `[Inicial]`

> Quebra preliminar — revisar ao iniciar. A ordem aqui prioriza ter o modelo de dados e a captura funcionando antes de qualquer UI, já que tudo mais depende disso.

**Etapa 1 — Modelo de dados**
- Remover `status_alterado` de `EmailRecord` (`types/email.ts`); adicionar `backup_dados?: { nome?: string; email?: string; status?: boolean }`.
- Atualizar `EmailStatus.ts` (`recalcularStatusAutomatico`) e `sync.ts` (`applyStatusRules`) para ler `backup_dados?.status` no lugar de `status_alterado`.
- Novos registros (criados por sincronização) nascem sem `backup_dados`.

**Etapa 2 — Migração dos dados já existentes**
- Os arquivos `data/*/emails.json` já em uso (`projeto-teste-emails.json`, `ultima-chamada-multiverso-emails.json`) têm registros com `status_alterado: true`. Escrever uma migração (script único, ou leitura retrocompatível no carregamento) que traduza `status_alterado: true` → `backup_dados: { status: true }`.

**Etapa 3 — Captura em `nome`/`email`**
- No handler de persistência de edição de célula: antes de gravar o novo valor, checar se `backup_dados[campo]` já existe; só capturar o valor atual se ainda não existir (regra "primeira vez vence").

**Etapa 4 — Campo editável na tabela**
- Trocar `<td>{registro.nome}</td>` e `<td>{registro.email}</td>` por um campo editável inline: exibição normal por padrão, vira `<input>` ao clicar, confirma no blur ou Enter, reverte no Esc.
- Ao confirmar edição de e-mail, revalidar com `isValidEmail` e recalcular status conforme a prioridade já existente (só se `backup_dados.status` for ausente/`false`).

**Etapa 5 — Lógica central de restauração**
- Função única `restaurarCampos(registro, camposEscolhidos)`, que aplica a regra certa por campo: literal para `nome`/`email`, recálculo automático para `status`. Usada tanto pelo caminho "1 campo, sem modal" quanto pela confirmação do modal.

**Etapa 6 — Botão de restaurar por linha**
- Novo ícone na área de ações da linha (`td-acoes`, já existente na estrutura de `EmailTable.tsx`), com a regra de visibilidade condicional (hover ou seleção + `backup_dados` não vazio).
- Decide entre restaurar direto (1 campo) ou abrir o modal (2+ campos).

**Etapa 7 — Modal de conflito de restauração**
- Novo componente, reaproveitando `ConflictDialog` como casco (mesmo padrão de `ConflitoExclusaoModal`/`DuplicadosConflitoModal`).
- Modo individual: lista os campos daquele registro específico.
- Modo em massa: lista a união dos campos alterados entre os registros selecionados; aplica a `restaurarCampos` em cada um, respeitando o no-op onde não se aplica.

### Arquivos Necessários

**Arquivos Fonte:**
- `src/components/EmailStatus.ts` — regex de validação de e-mail (`isValidEmail`), reaproveitada para revalidar o e-mail editado inline na tabela.
- `src/components/ConflictDialog.tsx` — casco reaproveitado como base visual do novo modal de conflito de restauração (Etapa 7).

**Arquivos Alterados:**
- `src/types/email.ts` — remove `status_alterado` de `EmailRecord`; adiciona `backup_dados?: { nome?: string; email?: string; status?: boolean }` (Etapa 1).
- `src/components/EmailStatus.ts` — `recalcularStatusAutomatico` passa a ler `backup_dados?.status` no lugar de `status_alterado` (Etapa 1).
- `src/scripts/sync.ts` — `applyStatusRules` passa a ler `backup_dados?.status` no lugar de `status_alterado` (Etapa 1).
- `src/components/EmailTable.tsx` — célula de nome/e-mail vira campo editável inline; captura em `backup_dados` na primeira edição; novo botão "Restaurar" na área `td-acoes` com a regra de visibilidade condicional (Etapas 3, 4 e 6).
- `data/active/projeto-teste/emails.json` — migração dos registros com `status_alterado: true` para `backup_dados: { status: true }` (Etapa 2).
- `data/active/chamada-alunos-ibm/emails.json` — mesma migração do item acima (Etapa 2).

**Arquivos Criados:**
- `src/components/utils/restaurarCampos.ts` *(nome sugerido)* — função única `restaurarCampos(registro, camposEscolhidos)`, com a regra de restauração por campo (Etapa 5).
- `src/components/RestaurarCamposModal.tsx` *(nome sugerido, distinto de `ConflitoRestauracaoModal.tsx` já existente, que trata de outro conflito)* — modal de conflito de restauração (individual e em massa), construído sobre `ConflictDialog` (Etapa 7).

---

## Demanda 3 — Atualizar Planilha via UI

**Status:** ✅ Concluída
**Esforço estimado:** Dias
**Depende de:** Demanda 5 (o fluxo de conflito depende do modelo `backup_dados` existir)
**Bloqueia:** —

### Contexto

O botão "Atualizar planilha" já existe visualmente no menu de configurações (`Header.tsx`), mas está desabilitado (`disabled`, título "Em breve"). A lógica de sincronizar por `id` já existe inteira em `sync.ts` — hoje só roda via terminal (Node), fora do navegador.

Com a Demanda 5, essa reimportação ganha uma complicação nova: registros podem ter campos protegidos manualmente (`backup_dados`). Reimportar sem tratar isso sobrescreveria correções manuais silenciosamente — o que é exatamente o problema que a Demanda 5 foi desenhada para evitar.

No destrinchamento desta demanda, o escopo original ("reimportar planilha, resolver conflito de `backup_dados`") se dividiu em dois fluxos com naturezas diferentes:

- **Atualizar Registros** — o que a demanda original cobria: reimportar uma planilha nova para atualizar os *valores* dos registros (nome, e-mail, presença/ausência).
- **Atualizar Dados** — fluxo novo: corrigir os *metadados* do projeto (nome, mapeamento de colunas), sem depender de o usuário ter a planilha original à mão outra vez.

O segundo fluxo só é viável porque esta demanda passa a exigir uma mudança de modelo de dados: **a planilha bruta enviada passa a ser persistida junto ao projeto**, não só o `EmailRecord[]` já processado.

### Escopo

**Cobre:**
- Botão "Atualizar Planilha" no `Header.tsx` deixa de estar desabilitado e vira um dropdown com duas opções: **Atualizar Registros** e **Atualizar Dados**.
- **Persistência do arquivo bruto da planilha** (`sheet.<ext>`) na pasta de dados do projeto, ao lado de `emails.json`. Gravado na criação do projeto (sem alterar o fluxo atual do `ImportWizardModal`, só adicionando essa gravação) e **sobrescrito a cada reimportação bem-sucedida** via "Atualizar Registros" — o arquivo persistido sempre reflete a última planilha usada para aquele projeto.
- **Fluxo "Atualizar Registros":** seletor de arquivo → modal com resumo inicial (mesmo modelo do resumo final do `EtapaRevisao`: nome do projeto, URL, total de registros, e-mails válidos/inválidos/duplicados, registros atualizados, tamanho do arquivo) → seções de conflito condicionais (só aparecem as que tiverem pelo menos 1 ocorrência) → resumo final.
- **Fluxo "Atualizar Dados":** modal único com 3 seções — (1) dados do projeto (nome, nome do arquivo — ao salvar, se o nome do projeto mudou, recalcula o slug e redireciona para a nova rota, reaproveitando a checagem de unicidade já usada em `ConflitoRestauracaoModal`); (2) remapeamento de colunas nome/e-mail, reaproveitando a estrutura visual do `EtapaMapeamento` (duas colunas + seleção de prioridade quando há mais de uma coluna candidata por atributo), reprocessando o `sheet.<ext>` já persistido — **sem exigir novo upload**. Ao confirmar, `applyStatusRules` é **reexecutado sobre a base inteira** com os valores de nome/e-mail recalculados pela nova seleção de colunas — duplicados que passam a existir (ou deixam de existir) por causa do remapeamento são recalculados silenciosamente, do mesmo jeito que qualquer outro recálculo de duplicado no sistema hoje, sem gerar seção de conflito própria; (3) resumo.
- **Motor de merge único, compartilhado pelos dois fluxos** (com um subconjunto de tipos de conflito habilitado por chamador — ver tabela de aplicabilidade abaixo), reaproveitando `applyStatusRules` para o recálculo de válido/inválido/duplicado depois do merge.
- Taxonomia final de conflitos (ver seção própria abaixo) e sua ordem de resolução em cascata dentro do wizard.
- Feedback consolidado ao final de cada fluxo (adicionados, atualizados automaticamente, resolvidos manualmente, ignorados) e recarga dos dados do projeto na tela.

**Não cobre nesta fase:**
- Mapeamento de ID personalizado (coluna de ID customizável no mapeamento) — foi retirado do escopo original de "Atualizar Dados > Colunas" e virou a **Demanda 7**, para nascer ao mesmo tempo no wizard de importação e neste fluxo de atualização, em vez de aparecer primeiro só aqui.
- Criar um projeto novo a partir deste fluxo (já existe via `ImportWizardModal`) — esta demanda é só para projeto já aberto.
- Desfazer uma reimportação ou uma atualização de dados (relacionado à Demanda 4, não obrigatório aqui).
- Detecção/resolução de duplicados como conflito de sincronização — duplicado continua sendo um estado calculado e resolvido depois, na tabela normal (`EmailTable`), não dentro do modal de conflito desta demanda.
- Refatoração do `ConflictDialog` — está ruim hoje, mas fica registrado como débito técnico para não inflar o escopo desta demanda; o novo componente de merge (`MergeCampoConflito`) nasce à parte, sem depender de reformar o casco existente primeiro.

### Modelo de dados

Pasta de dados de cada projeto passa a conter dois arquivos, em vez de um:

```
data/active/<slug>/
  emails.json     # já existe hoje — EmailRecord[] processado
  sheet.<ext>      # novo — a planilha bruta mais recente (csv, xlsx, etc.)
```

- Gravado pela primeira vez no fluxo de criação (`ImportWizardModal`), sem mudança de comportamento visível para o usuário nesse fluxo.
- Sobrescrito a cada reimportação bem-sucedida via **Atualizar Registros**.
- **Não** é alterado por **Atualizar Dados > Colunas** — remapear colunas é reinterpretar o mesmo arquivo já salvo, não uma reimportação de dados novos.

### Taxonomia final de conflitos

| # | Tipo | Gatilho | Precisa de decisão do usuário? | UI |
|---|---|---|---|---|
| 1 | **Atributo alterado** | `backup_dados.nome` ou `backup_dados.email` presente **e** o valor vindo da planilha diverge do valor protegido atual | Sim | Merge theirs/ours |
| 2 | **Status alterado (automático)** | Recálculo normal (`applyStatusRules`) faria um registro **não protegido** trocar de válido↔inválido | Não — é só o recálculo automático que já acontece hoje | Nota informativa no resumo, não é seção do wizard |
| 3 | **Registro corrigido** | `backup_dados.nome`/`.email` presente e o valor vindo da planilha é **igual** ao valor já corrigido na interface | Não — resolução automática (remove o `backup_dados` daquele campo) | Nota informativa no resumo ("N registros tiveram a proteção removida por já estarem com o valor correto") |
| 4 | **Registro enviado** | Registro com `status = enviado` e a planilha traz `nome`/`email` diferente do atual | Sim | Merge theirs/ours |
| 5 | **Registro deletado (revivido)** | Registro com `status = deletado` volta a aparecer na planilha nova | Sim | Merge theirs/ours (manter deletado vs. reviver com os dados novos) |
| 6 | **Registro sumido da planilha** | Um `id` que existia na planilha anterior não está mais presente na nova | Sim | Lista simples (não é bem um "theirs/ours" — é ignorar vs. marcar como deletado) |

Sobre os itens 2 e 3: nenhum dos dois tem, de fato, um "theirs" para o usuário escolher — item 2 porque a planilha nunca carrega `status`, ele é sempre derivado; item 3 porque os dois lados (planilha e valor corrigido manualmente) já são iguais. Por isso nenhum dos dois ganha uma seção navegável no wizard — ambos entram só como uma linha informativa no resumo final, para não resolver nada silenciosamente sem o usuário saber que aconteceu.

**Ordem de resolução em cascata** (mesma lógica de prioridade de `STATUS_PRIORIDADE`, aplicada agora à ordem das seções do wizard, não só ao cálculo de status):

```
Resumo inicial
  → Enviado (item 4)
  → Deletado / revivido (item 5)
  → Sumido da planilha (item 6)
  → Atributo alterado (item 1)
  → [Status alterado (item 2) e Corrigido (item 3) só entram como notas no resumo final]
Resumo final
```

A resolução de uma seção afeta o que aparece nas seções seguintes — nenhuma seção é calculada de antemão, cada uma parte do resultado da anterior:
- Um registro "Enviado" mantido como enviado não aparece em "Atributo alterado" (a decisão de mantê-lo já resolveu o valor). Se o usuário optar por "desenviar" (aceitar o novo nome/e-mail e voltar o status), ele passa a ser avaliado normalmente na seção seguinte.
- O mesmo vale para "Deletado/revivido" → "Atributo alterado": se o usuário decide reviver o registro, ele entra na checagem de atributo alterado com o novo status; se decide manter deletado, some do restante do fluxo.
- Cada seção só aparece se tiver pelo menos 1 registro pendente depois da cascata da seção anterior — mesmo comportamento condicional que o `EtapaDefinicaoPrioridade` já tem hoje no wizard de importação (só some se não houver ambiguidade).

**Aplicabilidade por fluxo** — nem todo tipo de conflito pode ocorrer nos dois pontos de entrada do motor de merge:

| Tipo de conflito | Atualizar Registros | Atualizar Dados > Colunas |
|---|---|---|
| Atributo alterado | Sim | Sim (o remapeamento pode gerar um nome/e-mail computado diferente do atual) |
| Status alterado (nota) | Sim | Sim |
| Corrigido (nota) | Sim | Sim |
| Enviado | Sim | Sim |
| Deletado / revivido | Sim | **Não** — remapear colunas não adiciona nem remove linhas, só reinterpreta as mesmas |
| Sumido da planilha | Sim | **Não** — mesmo motivo acima |

### Desafio técnico principal

Um único motor de merge, com dois pontos de entrada diferentes (planilha nova vs. arquivo persistido remapeado) e um subconjunto de tipos de conflito habilitado por chamador, precisa manter estado acumulado entre as seções do wizard — a saída de uma seção é a entrada da próxima, e o resumo final só pode ser calculado depois que a cascata inteira terminar.

### Decisões em aberto

- **Atalhos de resolução em massa** ("aceitar todos os theirs" / "aceitar todos os ours") por seção de conflito — confirmado que sim, no espírito do merge estilo VS Code; falta só definir se o atalho fica visível mesmo quando há só 1 registro na seção (provavelmente não, é ruído).
- **Formato da nota de "Status alterado" e "Corrigido" no resumo final** — lista textual (nomes dos registros afetados) ou só uma contagem numérica? Lista é mais transparente, mas pode ficar longa em planilhas grandes; talvez contagem + link/expansível.

### Etapas de Implementação `[Inicial]`

> Quebra preliminar — revisar ao iniciar. A ordem prioriza ter a persistência do arquivo bruto e o motor de merge prontos antes de qualquer UI, já que os dois wizards dependem disso.

**Etapa 1 — Persistência do arquivo bruto**
- Endpoint de criação de projeto (`emailsApiPlugin`) passa a gravar `sheet.<ext>` na pasta do projeto, além do `emails.json` já gravado hoje — sem alterar o restante do fluxo de criação.
- Nova função utilitária para ler esse arquivo de volta a partir do middleware (usada pela Etapa 7).

**Etapa 2 — Dropdown no Header**
- Botão "Atualizar Planilha" no `Header.tsx` deixa de estar `disabled`/"Em breve" e vira um trigger de dropdown com dois itens: "Atualizar Registros" (abre seletor de arquivo) e "Atualizar Dados" (abre o modal direto, sem seletor).

**Etapa 3 — Endpoints no middleware**
- `POST /api/emails/:slug/sync` — recebe a nova planilha via `FormData` (fluxo Atualizar Registros); ao concluir com sucesso, sobrescreve `sheet.<ext>`.
- Endpoint para reprocessar o `sheet.<ext>` já persistido com uma nova seleção de colunas, sem upload (fluxo Atualizar Dados > Colunas).
- `PATCH /api/projetos/:slug` — atualização de nome do projeto/arquivo, reaproveitando a checagem de unicidade de slug já usada em `ConflitoRestauracaoModal`.

**Etapa 4 — Motor de merge compartilhado**
- Novo módulo com a função central: recebe registros atuais + registros vindos da planilha (nova ou remapeada) + a lista de tipos de conflito habilitados para aquele chamador, devolve os registros sem conflito, as listas por tipo de conflito (enviado, deletado/revivido, sumido, alterado) e as listas de resolução automática (corrigido, status alterado).
- Reaproveita `applyStatusRules` para o recálculo pós-merge.

**Etapa 5 — Wizard "Atualizar Registros"**
- Novo componente reaproveitando o casco do `ImportWizardModal` (stepper, barra de progresso, next/previous).
- Seção de resumo inicial (mesmo modelo do resumo final do `EtapaRevisao`).
- Seções condicionais de conflito, na ordem em cascata definida acima, cada uma consumindo o estado resolvido da anterior.
- Seção de resumo final, incluindo as notas informativas de "corrigido" e "status alterado".

**Etapa 6 — Componente de merge theirs/ours**
- Novo componente `MergeCampoConflito` — duas colunas (theirs/ours) por registro conflitante, com os atalhos de resolução em massa. Não reaproveita `ConflictDialog` como casco de conteúdo (ver decisão de não refatorá-lo agora); usa só o padrão visual do wizard como referência de layout.

**Etapa 7 — Wizard "Atualizar Dados"**
- 3 seções: (1) projeto — nome/arquivo, com recálculo de slug e redirecionamento ao concluir se o nome mudou; (2) colunas — reaproveitando a estrutura do `EtapaMapeamento` (duas colunas + prioridade), disparando o motor de merge (Etapa 4) com o `sheet.<ext>` persistido e só os tipos de conflito aplicáveis a este fluxo (ver tabela de aplicabilidade); ao confirmar, reexecuta `applyStatusRules` sobre a base inteira com os valores recalculados, para refletir duplicados que passam a existir/deixam de existir por causa do remapeamento; (3) resumo.

**Etapa 8 — Confirmação e feedback final**
- Ao confirmar cada fluxo, envia o resultado consolidado ao endpoint correspondente, atualiza `sheet.<ext>` (só no fluxo Atualizar Registros), redireciona se o nome do projeto mudou (fluxo Atualizar Dados) e recarrega os dados do projeto na tela.

### Arquivos Necessários

**Arquivos Fonte:**
- `src/scripts/sync.ts` — base da lógica de sincronização por `id`, reaproveitada como ponto de partida do motor de merge (Etapa 4).
- `src/components/EmailStatus.ts` (`STATUS_PRIORIDADE`) — ordem de prioridade reaproveitada para a cascata de seções de conflito.
- `src/components/import/ImportWizardModal.tsx` — casco reaproveitado (stepper, progresso, next/previous) pelos dois novos wizards (Etapas 5 e 7).
- `src/components/import/EtapaRevisao.tsx` — modelo do resumo, reaproveitado nas seções de resumo inicial/final (Etapa 5).
- `src/components/import/EtapaMapeamento.tsx` — estrutura de seleção de colunas + prioridade, reaproveitada na seção "Colunas" do fluxo Atualizar Dados (Etapa 7).
- `src/components/import/utils/parseSheetBrowser.ts` — parse da planilha, reaproveitado tanto para o novo upload (Atualizar Registros) quanto para reler o `sheet.<ext>` persistido (Atualizar Dados).
- `src/components/ConflitoRestauracaoModal.tsx` / lógica de `slugify` — reaproveitada na checagem de unicidade ao renomear o projeto (Etapa 7).
- `src/types/email.ts` — estrutura de `backup_dados` (Demanda 5), consultada pelo motor de merge para detectar conflito por campo.

**Arquivos Alterados:**
- `vite.config.ts` — endpoint de criação de projeto passa a gravar `sheet.<ext>`; novos endpoints `POST /api/emails/:slug/sync`, de remapeamento de colunas e `PATCH /api/projetos/:slug` (Etapas 1 e 3).
- `src/components/Header.tsx` — botão "Atualizar Planilha" vira dropdown com as duas opções (Etapa 2).
- `src/services/emailsApi.ts` / `src/services/projetosApi.ts` — novas funções de client para os endpoints acima.

**Arquivos Criados:**
- `src/scripts/syncEngine.ts` *(nome sugerido)* — motor de merge compartilhado entre os dois fluxos (Etapa 4).
- `src/components/atualizar/AtualizarRegistrosModal.tsx` *(nome sugerido)* — wizard do fluxo "Atualizar Registros" (Etapa 5).
- `src/components/atualizar/AtualizarDadosModal.tsx` *(nome sugerido)* — wizard do fluxo "Atualizar Dados" (Etapa 7).
- `src/components/atualizar/MergeCampoConflito.tsx` *(nome sugerido)* — componente de merge theirs/ours reutilizado pelas seções de conflito "Enviado", "Deletado/revivido" e "Atributo alterado" (Etapa 6).
- `src/components/atualizar/RegistrosSumidosSection.tsx` *(nome sugerido)* — seção específica do conflito "sumido da planilha" (lista simples, não é merge de campo) (Etapa 5).

---

## Demanda 7 — Mapeamento de ID Personalizado

**Status:** ✅ Concluída (validação manual final em ambiente real ainda por conta do usuário — ver `MapeamentoDeIDPersonalizado.md`, seção 8; toda a implementação, build (`tsc`/`eslint`/`vite build`) e a estilização (conferida por captura de tela real) foram verificadas)
**Esforço estimado:** Dias
**Depende de:** —
**Bloqueia:** —

### Contexto

Surgiu durante o destrinchamento da Demanda 3, como parte da seção "Colunas" do fluxo Atualizar Dados: a ideia original era permitir selecionar, na hora de remapear colunas, qual coluna da planilha deveria ser usada como `id` do registro. Só que hoje **nenhum** dos dois pontos de entrada (wizard de importação nem a futura Demanda 3) tem esse seletor — o `id` é sempre a ordem da linha na planilha, sem controle explícito do usuário sobre qual coluna usar quando há uma candidata melhor.

Foi retirada do escopo da Demanda 3 porque, para fazer sentido, precisa nascer nos dois lugares ao mesmo tempo — se nascesse só na atualização, o `id` usado para casar registros na reimportação poderia divergir silenciosamente do `id` que o projeto usou na criação.

**Revisão de escopo (pós-mapeamento):** ao rastrear o código antes de implementar, foi identificado que a estratégia de resolução de ID hoje está fragmentada em 3 lugares com comportamentos diferentes — `identifyColumns.ts` (Node/CLI, lista ampla de candidatos, não usado pelos fluxos do navegador), `calcularMerge.ts` (navegador, aceita só header exatamente `"id"`) e `construirRegistros.ts` (navegador, **nenhuma** detecção — sempre ordem da linha). Um seletor de UI sozinho, sem persistir a escolha em `EmailsData` e sem essas duas funções passarem a recebê-la como parâmetro explícito, não teria efeito real sobre o `id` gravado. O escopo abaixo já incorpora essa correção.

### Escopo

**Cobre:**
- Novo campo persistido em `EmailsData` (`types/email.ts`): `colunaId?: string` — nome
  da coluna da planilha usada como origem do `id` deste projeto. Ausente/`undefined`
  equivale a "Gerar Automaticamente" (comportamento atual: ordem da linha).
- `construirRegistros.ts` (criação de projeto) passa a aceitar essa escolha e resolver
  o `id` de cada linha a partir dela, com fallback para ordem de linha.
- `calcularMerge.ts` deixa de detectar a coluna de ID internamente (heurística restrita
  a header `"id"`) e passa a recebê-la como parâmetro explícito, fornecido pelo
  chamador a partir do `colunaId` persistido do projeto.
- `AtualizarRegistrosModal.tsx` (fluxo "Atualizar Registros", Demanda 3) passa a ler o
  `colunaId` persistido do projeto e repassá-lo ao motor de merge — **sem** seletor
  próprio de coluna nesse fluxo; trocar a estratégia de ID continua sendo uma ação
  exclusiva de "Atualizar Dados > Colunas".
- Seletor de coluna de ID (`<select>` simples) tanto no `EtapaMapeamento.tsx` (wizard
  de importação) quanto na seção "Colunas" do `AtualizarDadosModal.tsx` (Demanda 3);
  ao confirmar em qualquer um dos dois, a escolha é (re)gravada em `colunaId`.
- **Exclusividade entre atributos:** ao selecionar uma coluna para representar um dos
  3 atributos (id, nome, email), ela deixa de estar disponível para os outros dois —
  vale nos dois pontos de entrada. Implica subir o estado de "colunas em uso" para o
  componente pai e propagar como lista de exclusão para os 3 seletores.
- Validação bloqueante ao escolher uma coluna de ID: valores vazios, duplicados **ou
  não numéricos** (novo critério — ver Decisões) impedem a confirmação, com feedback
  visível. Mesma validação reaproveitada na construção dos registros (Etapa 2).
- Aviso ao usuário, no fluxo "Atualizar Registros", se a planilha reimportada não
  tiver a coluna indicada por `colunaId` (ex.: coluna renomeada) — o merge cai no
  fallback de ordem de linha, e isso precisa ficar visível, não silencioso.

**Não cobre nesta fase:**
- Múltiplas colunas com prioridade para ID (decisão tomada: fica fixo em 1 coluna —
  ver justificativa na seção de decisões).
- Migração de `id` para projetos já existentes que mudarem de estratégia de
  identificação (ex.: projeto criado sem coluna de ID explícita passa a ter uma) — o
  risco de desalinhamento entre reimportações ao trocar de estratégia de ID no meio
  do caminho de um projeto já existente é uma nota de atenção a levantar na
  implementação, não uma migração automática coberta aqui.
- Suporte a colunas de ID com valores não numéricos (strings livres, UUIDs, códigos
  alfanuméricos) — decisão tomada de manter `EmailRecord.id: number` nesta fase (ver
  Decisões); tratado como validação bloqueante, não como funcionalidade suportada.

### Questões

- Se a coluna de ID escolhida tiver valores vazios ou duplicados, o sistema deve
  bloquear a confirmação ou só avisar e seguir com o fallback de ordem de linha para
  os casos problemáticos?

### Decisões

- ~~Bloquear ou avisar?~~ → **Bloquear**, dado explicitamente pelo usuário. Estendido
  para também bloquear em caso de valor não numérico (ver decisão de tipo abaixo).
- ~~ID com 1 coluna fixa ou múltiplas com prioridade (como nome/email)?~~ →
  **1 coluna fixa.** ID não tem a propriedade de "variantes intercambiáveis" que
  nome/email têm; permitir fallback entre colunas de ID reintroduziria divergência
  silenciosa entre importações — o próprio problema que a demanda existe para evitar.
  Componente: `<select>` simples, mais leve que `ColunaSeletora.tsx`.
- ~~O escopo cobre só criação e remapeamento, ou também a reimportação ("Atualizar
  Registros")?~~ → **Também a reimportação.** Sem isso, o problema que a demanda
  resolve na criação reapareceria de forma silenciosa no fluxo de reimportação, que
  hoje cairia de volta na heurística frágil de `calcularMerge.ts`. Não ganha UI
  própria de seleção — só passa a *ler* a escolha já persistida.
- ~~Onde persistir a escolha?~~ → **Novo campo `colunaId?: string` em `EmailsData`.**
  Ausência do campo já é o fallback correto ("Gerar Automaticamente"), então não há
  necessidade de migração para projetos existentes.
- ~~IDs numéricos ou também string/alfanumérico (UUID, código com letras)?~~ →
  **Só numéricos nesta fase.** Ampliar `EmailRecord.id` para `string | number` afeta
  comparações, `Map`/índices por id, ordenação e outras partes do sistema fora do
  escopo desta demanda — desproporcional ao esforço estimado. Fica registrado como
  possível demanda futura; a validação bloqueante (vazio/duplicado/não numérico)
  cobre o caso enquanto isso.

### Etapas de Implementação `[Inicial]`

> Quebra preliminar — revisar ao iniciar e ao ver como a Demanda 3 evoluiu (esta
> demanda toca os mesmos pontos de mapeamento que ela usa). Ordem pensada para que
> modelo de dados e wiring do motor de merge existam **antes** de qualquer UI, já
> que as etapas de seletor dependem de ter onde salvar/ler o valor escolhido.

**Etapa 1 — Modelo de dados: persistência da escolha**
- Adicionar `colunaId?: string` a `EmailsData` (`types/email.ts`).
- Ausente/`undefined` = "Gerar Automaticamente" (comportamento atual). Sem migração
  necessária para projetos existentes.

**Etapa 2 — Wiring em `construirRegistros.ts` (criação)**
- Aceitar parâmetro opcional de coluna de ID; se informado, resolver o `id` de cada
  linha a partir dela (mesma lógica de resolução usada em `calcularMerge.ts`,
  incluindo fallback para ordem de linha em caso de valor vazio/não numérico); se
  ausente, comportamento atual (`index + 1`) permanece.
- Validar (bloqueante) unicidade/preenchimento/numericidade da coluna escolhida antes
  de construir os registros, reaproveitando a validação da Etapa 5.

**Etapa 3 — Wiring em `calcularMerge.ts` (merge)**
- Remover a detecção interna de coluna de ID (heurística restrita a header
  exatamente `"id"`); `calcularMerge` passa a receber a coluna como parâmetro
  explícito (`colunaId: string | null`), fornecido pelo chamador.
- Ajustar as chamadas existentes em `AtualizarDadosModal.tsx` para passar o
  `colunaId` do projeto.

**Etapa 4 — Estado compartilhado de "colunas em uso"**
- Subir para o componente pai (`EtapaMapeamento.tsx`) o cálculo de quais colunas já
  estão selecionadas para nome/email/id.
- Definir a forma desse estado (provavelmente `Record<'id'|'nome'|'email', string[]>`
  ou equivalente) e como ele desce para os 3 seletores.

**Etapa 5 — Seletor de coluna de ID + validação bloqueante**
- Novo `<select>` simples, opção "Gerar Automaticamente" como padrão, listando as
  colunas da planilha **exceto** as já em uso por nome/email.
- Ao escolher uma coluna, verificar vazios/duplicados/não numéricos nos valores;
  bloquear confirmação e exibir feedback se houver problema.

**Etapa 6 — Exclusividade em `ColunaSeletora.tsx`**
- Adaptar `ColunaSeletora.tsx` para aceitar lista de exclusão externa (colunas usadas
  pelos outros 2 atributos) e desabilitá-las nas opções de nome/email.

**Etapa 7 — Reaproveitar no wizard de importação**
- Integrar Etapas 4–6 em `EtapaMapeamento.tsx`; ao confirmar, o `colunaId` escolhido
  é persistido em `EmailsData` na criação do projeto (via Etapa 2).

**Etapa 8 — Reaproveitar na Demanda 3 (Atualizar Dados > Colunas)**
- Integrar o mesmo seletor + exclusividade + validação na seção "Colunas" do
  `AtualizarDadosModal.tsx`; ao confirmar, `colunaId` é regravado em `EmailsData` e
  repassado ao motor de merge (Etapa 3) para o remapeamento em curso.

**Etapa 9 — Reaproveitar em "Atualizar Registros"**
- `AtualizarRegistrosModal.tsx` lê o `colunaId` já persistido no projeto e repassa ao
  motor de merge (Etapa 3) — sem seletor próprio nesse fluxo.
- Se a coluna indicada por `colunaId` não existir na planilha reimportada, exibir
  aviso visível de que o merge caiu no fallback de ordem de linha (não é regressão
  desta demanda, mas precisa deixar de ser silencioso).

### Arquivos Necessários

**Arquivos Fonte:**
- `src/scripts/utils/identifyColumns.ts` — lógica de detecção automática (Node/CLI),
  referência para a nova opção explícita de ID.

**Arquivos Alterados:**
- `src/types/email.ts` — novo campo `colunaId?: string` em `EmailsData` (Etapa 1).
- `src/components/import/utils/construirRegistros.ts` — resolve `id` a partir da
  coluna escolhida, com fallback (Etapa 2).
- `src/scripts/utils/calcularMerge.ts` — recebe `colunaId` como parâmetro explícito
  em vez de detectar internamente (Etapa 3).
- `src/components/import/EtapaMapeamento.tsx` — estado compartilhado de colunas em
  uso + seletor de ID + confirmação persiste `colunaId` (Etapas 4, 5, 7).
- `src/components/import/ColunaSeletora.tsx` — aceita lista de exclusão externa
  (Etapa 6).
- `src/components/atualizar/AtualizarDadosModal.tsx` — reaproveita seletor +
  exclusividade + validação; repassa `colunaId` ao motor de merge e regrava a
  escolha (Etapa 8).
- `src/components/atualizar/AtualizarRegistrosModal.tsx` — lê `colunaId` persistido
  do projeto e repassa ao motor de merge (Etapa 9).

**Arquivos Criados:**
- `src/components/import/utils/validarColunaId.ts` *(nome sugerido)* — validação
  bloqueante (vazio/duplicado/não numérico) compartilhada entre a Etapa 2
  (construção) e a Etapa 5 (seletor/UI), evitando duplicar a lógica.

---

## Demanda 4 — Histórico de Alterações

**Status:** ⏸️ Pausada — em favor da Demanda 9 (Logs de Alterações), mais simples e com valor imediato mais claro. Retomar quando a necessidade real de "desfazer" (restauração de snapshot) se confirmar na prática.
**Esforço estimado:** Horas a dias, dependendo da versão escolhida
**Depende de:** —
**Bloqueia:** —

### Contexto

Toda alteração (`salvarEmails`) sobrescreve o `emails.json` inteiro, sem versionamento nem log de quem/quando mudou o quê. Não existe "desfazer".

### Escopo

**Cobre (versão simples, recomendada para começar):**
- Snapshot do estado anterior gravado a cada `PUT /api/emails/:slug`, antes de sobrescrever (ex.: `data/<slug>/history/<timestamp>.json`).
- Listagem dos snapshots disponíveis para um projeto (data/hora de cada alteração).
- Restauração de um snapshot completo (volta o projeto inteiro para aquele estado).

**Não cobre nesta fase (versão avançada, registrada para o futuro):**
- Diff estruturado por campo (quem mudou o quê, de/para) — necessário para um "desfazer" granular que não sobrescreva alterações concorrentes de outros campos.
- Autoria da alteração (o sistema é single-user local, não há login — "quem" não é rastreável nesta fase).
- Poda automática de snapshots antigos (risco de crescimento ilimitado de arquivos — decisão em aberto abaixo).

### Decisões em aberto

- **Retenção:** manter todos os snapshots indefinidamente, ou aplicar alguma poda (ex.: manter só os últimos N, ou 1 por dia após X tempo)? Sem poda, `data/<slug>/history/` cresce sem limite.
- **Granularidade do "desfazer":** a versão simples restaura o projeto inteiro para um ponto no tempo — isso é aceitável, ou o valor real está em desfazer só uma mudança pontual (o que exigiria a versão avançada)?

### Etapas de Implementação `[Inicial]`

> Quebra preliminar da versão simples — revisar ao iniciar. Se a decisão for pela versão avançada (diff estruturado), esta quebra não se aplica e precisa ser refeita.

**Etapa 1 — Snapshot automático**
- No middleware (`vite.config.ts`), antes de sobrescrever `emails.json` em cada `PUT`, gravar uma cópia do estado atual em `data/<slug>/history/<timestamp>.json`.

**Etapa 2 — Listagem de histórico**
- Endpoint `GET /api/emails/:slug/history`, retornando a lista de snapshots (timestamp + tamanho/contagem de registros, para dar contexto sem abrir o arquivo).
- UI simples (pode viver no dropdown de configurações do `Header.tsx`) para visualizar essa lista.

**Etapa 3 — Restauração**
- Endpoint `POST /api/emails/:slug/history/:timestamp/restore`, que sobrescreve o `emails.json` atual com o conteúdo do snapshot escolhido (gravando, por sua vez, um novo snapshot do estado "atual antes de restaurar", para não perder o histórico dessa ação).
- Confirmação explícita na UI antes de restaurar (ação destrutiva sobre o estado atual).

**Etapa 4 — Retenção (se decidido aplicar poda)**
- Rotina de limpeza de snapshots antigos, conforme política definida na decisão em aberto.

### Arquivos Necessários

**Arquivos Fonte:**
- `vite.config.ts` — handler atual de `PUT /api/emails/:slug` no `emailsApiPlugin`, ponto onde o snapshot precisa ser interceptado antes da sobrescrita (Etapa 1).
- `src/components/Header.tsx` — dropdown de configurações onde a UI simples de histórico pode viver (Etapa 2).

**Arquivos Alterados:**
- `vite.config.ts` — o handler de `PUT /api/emails/:slug` passa a gravar um snapshot em `data/<slug>/history/<timestamp>.json` antes de sobrescrever; novos endpoints `GET /api/emails/:slug/history` e `POST /api/emails/:slug/history/:timestamp/restore` (Etapas 1, 2 e 3).
- `src/components/Header.tsx` — novo item no dropdown de configurações para visualizar/restaurar snapshots (Etapa 2).

**Arquivos Criados:**
- `data/active/<slug>/history/` *(diretório novo, gerado em runtime — um por projeto, com um `.json` por snapshot)* (Etapa 1).
- `src/components/HistoricoModal.tsx` *(nome sugerido)* — UI de listagem e restauração de snapshots, com confirmação explícita antes de restaurar (Etapas 2 e 3).
- `src/services/historicoApi.ts` *(nome sugerido)* — client para os endpoints de listagem/restauração de histórico.
- Rotina de limpeza de snapshots antigos *(módulo a definir, condicional à decisão em aberto sobre retenção)* (Etapa 4).

---

## Demanda 9 — Logs de Alterações

**Status:** ✅ Concluída — as 7 etapas de implementação estão marcadas como concluídas em `public/LogsDeAlteracoes.md`; falta a validação manual de ponta a ponta (seção 9 do planner, critérios de aceite 8.2) antes de virar **Validada**
**Esforço estimado:** Dias — instrumentação espalhada por ~12 pontos de mutação/erro diferentes, mais a tela de visualização e a exportação de logs
**Depende de:** —
**Bloqueia:** —

### Contexto

Não existe hoje nenhum rastro de "o que aconteceu no sistema". Conforme a lógica de merge/backup_dados/colunaId (Demandas 5, 3, 7) acumula complexidade, perguntas como "por que esse registro ficou com esse ID?" ou "quando essa planilha foi reimportada?" ficam cada vez mais frequentes e cada vez mais difíceis de responder sem um log. Diferente da Demanda 4 (Histórico de Alterações — snapshot completo + restauração, por projeto, atualmente pausada), aqui o objetivo é só rastro: uma linha de texto por ação, sem guardar o estado inteiro e sem capacidade de restauração. É deliberadamente mais simples e cobre o sistema inteiro, não só os projetos.

### Escopo

**Cobre:**
- Uma linha em `data/logs/<AAAA-MM>.jsonl` para toda e qualquer alteração feita via interface — não só por projeto, mas do sistema como um todo.
- Ações que na prática disparam mais de uma mutação real a partir do mesmo clique (ex.: o modal "Atualizar Planilha" pode renomear o projeto **e** alterar dados/colunas ao mesmo tempo) emitem uma linha por mutação de fato ocorrida, todas com a mesma tag (`alterar_planilha`), diferenciadas pelos demais atributos (`mensagem`, `original`, `atual`).
- Ações em massa (ex.: reimportar planilha com milhares de registros) geram **uma única linha**, com a contagem refletida em `mensagem`/`quantidade` — sem detalhamento individual por registro nesta fase.
- Ações "vazias" (modal aberto e confirmado sem nenhuma mudança real, em qualquer um dos tipos abaixo) **não** geram log — mesmo critério já usado por `restaurarCampos.ts`, que não grava `last_updated` quando nada muda de fato.
- Tela dedicada em `/logs`, acessível por um botão "Visualizar Logs" no `Header`, com:
  - Busca por nome, data, tipo ou outro atributo;
  - Filtro por tipo, data (dia único ou intervalo) ou outro atributo;
  - Paginação, mais recente primeiro;
  - Somente leitura — **sem** edição ou exclusão de log via interface, em nenhuma hipótese;
  - Exibe também `erro_servidor`/`erro_cliente`, em aba própria separada das ações (ver Interface da tela `/logs`).
- Endpoint novo `POST /api/logs`, chamado pelo frontend, para registrar a exportação de planilha (`exportarPlanilha.ts`), já que hoje esse fluxo é 100% client-side e não passa por nenhum handler existente.
- Botão "Exportar Logs", sempre visível na tela `/logs`, exportando **por mês ou intervalo de meses** (não por resultado de busca/filtro, e não é possível exportar um log específico). Seleção de 1 mês só baixa o arquivo direto; seleção de um intervalo de mais de 1 mês baixa um `.zip` contendo um arquivo por mês. Formato (CSV ou JSON) escolhido pelo usuário — ver Decisões para o esquema de achatamento do CSV.
- Rotação mensal do arquivo de log (`data/logs/2026-09.jsonl`, `2026-10.jsonl`...), sem poda — nunca deleta arquivo antigo, só limita o tamanho de cada um.
- Leitura sequencial por arquivo mensal (mês mais recente → mais antigo) com early-exit ao preencher a página pedida, em vez de ler todo o histórico a cada request.
- Taxonomia fechada de `acao` (12 tipos, tabela abaixo), pensada para ser "adicionável" no futuro sem quebrar o que já existe.
- Flag de ambiente (`.env`, ex.: `LOGS_ATIVOS=false`), checado no `vite.config.ts`, para desativar a escrita de logs durante desenvolvimento local — sem exposição na interface (ver Decisões). Quando desativado, a tela `/logs` mostra um indicador somente-leitura (ex.: banner) informando que o registro está desativado no ambiente atual.

**Não cobre nesta fase:**
- Detalhamento individual de itens dentro de uma ação em massa (ex.: ver os 4000 registros de uma reimportação, um a um). Se vier a necessidade, resolvemos depois com um arquivo de detalhe separado por ação — decisão consciente de não implementar agora.
- Log de troca de tema (Demanda 8) — puramente client-side, sem mutação no servidor; desnecessário por decisão explícita.
- Autoria da alteração — sistema é single-user local, sem login, mesma ressalva já registrada na Demanda 4.
- Poda/expiração de logs antigos — nunca deve existir, dado que log não pode ser editado/deletado via interface.
- Qualquer forma de editar/deletar/restaurar um log pela interface.
- Ativar/desativar o registro de logs pela interface — controle fica só em variável de ambiente, nunca em um botão clicável dentro do app rodando (ver Decisões).
- Cache em memória ou índice de offsets para leitura — otimização prematura dado o volume esperado (uso local/pessoal); revisitar só se a leitura sequencial por mês realmente doer na prática.

### Taxonomia de `acao`

| Tipo | Gatilho |
|---|---|
| `importar_planilha` | Criação de projeto (upload inicial) |
| `alterar_planilha` | Renomear projeto e/ou remapear colunas/dados via modal "Atualizar Planilha" — pode emitir mais de uma linha por clique |
| `reimportar_planilha` | Reimportação/merge de uma nova planilha sobre um projeto existente |
| `deletar_projeto` | Soft delete (projeto vai pra lixeira) |
| `restaurar_projeto` | Projeto sai da lixeira |
| `deletar_projeto_permanente` | Exclusão definitiva a partir da lixeira |
| `exportar_planilha` | Exportação (CSV/XLSX/PDF), via `POST /api/logs` dedicado |
| `alterar_registro` | Qualquer alteração de campo em um registro — inclui marcar como deletado (`status → deletado`) e como enviado (`status → enviado`); a diferenciação vem de `original`/`atual`/`mensagem`, não de um tipo separado |
| `restaurar_registro` | Reverter campos protegidos (`nome`/`email`/`status`) a partir de `backup_dados` |
| `editar_email` | Qualquer alteração no conteúdo de e-mail do projeto (`EmailConteudo`): assunto, corpo, anexos (quando existir) e demais atributos que vierem a ser adicionados a esse conjunto no futuro — sem exigir novo tipo de log a cada novo atributo |
| `erro_servidor` | Erro não tratado no servidor, incluindo falha ao gravar uma linha de log (tentativa única, sem loop) |
| `erro_cliente` | Exception não tratada na UI (`window.onerror`/error boundary) ou resposta de API 4xx/5xx |

A taxonomia é fixa no código (whitelist validada por `registrarLog`) — não existe interface para o usuário criar um tipo de log novo. "Adicionável" significa mudança de código, como a inclusão dos dois tipos de erro acima.

### Formato da linha (`data/logs/<AAAA-MM>.jsonl`)

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

Para ações em massa, `original`/`atual` ficam `null` e o resumo vai só em `mensagem`/`quantidade` (ex.: `"4000 registros inseridos"`). Para `editar_email`, `original`/`atual` sempre indicam qual campo foi tocado (ex.: `{"campo": "assunto", "de": "...", "para": "..."}`), preparando a estrutura para novos atributos (como anexos) sem mudança de schema. ID no formato `AAAAMMDD-HHMMSS-xxxx` — ordena naturalmente por data sem precisar ler o arquivo inteiro.

`mensagem` sempre é montada por um template fixo por `acao` dentro do `registrarLog`, a partir de parâmetros estruturados passados pelo handler — nenhum handler escreve texto livre diretamente.

Para `erro_servidor`/`erro_cliente`, o formato muda um pouco — não há ação de usuário por trás, então `registroId`/`quantidade`/`original`/`atual` ficam `null`, e dois campos novos aparecem: `origem` (`"servidor"` | `"cliente"`) e `detalhe` (stack trace completo quando existir, ou o corpo da resposta de erro quando for um 4xx/5xx sem exception):

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

### Decisões

- ~~Retenção/rotação?~~ → **Rotação mensal**, um arquivo `.jsonl` por mês, sem poda — nunca deleta arquivo antigo.
- ~~Paginação?~~ → **Leitura sequencial por arquivo mensal, mais recente primeiro, com early-exit** ao preencher a página pedida, em vez de ler o histórico inteiro a cada request. Consistente com o padrão do resto do `vite.config.ts` (nenhum handler mantém cache em memória hoje). Revisitar (cache/índice) só se o volume real de uso justificar.
- ~~Ação sem mudança real gera log?~~ → **Não**, em nenhum tipo — vale de forma geral, não só para `alterar_planilha`.
- ~~`renomear_projeto` é um tipo próprio ou parte de `alterar_planilha`?~~ → **Parte de `alterar_planilha`.** O modal "Atualizar Planilha" pode alterar nome e dados no mesmo clique; quando isso acontece, emite uma linha por mutação real ocorrida (podendo ser 2), sempre com a mesma tag, diferenciadas por `mensagem`/`original`/`atual`.
- ~~`deletar_registro` e `enviar_registro` são tipos próprios?~~ → **Não — fazem parte de `alterar_registro`.** São, no fundo, mudanças do campo `status`; a diferenciação para busca vem do conteúdo de `original`/`atual`/`mensagem`, sem multiplicar tipos.
- ~~Log de troca de tema?~~ → **Fora de escopo**, por decisão explícita (além de ser puramente client-side, sem mutação no servidor).
- ~~Exportar o log gera, ele mesmo, uma nova linha de log?~~ → **Não.** É uma ação de leitura sobre o próprio log (mesmo raciocínio de `GET /api/lixeira` não ser logado) — logar isso criaria recursão sem propósito real de auditoria.
- ~~Formato(s) de exportação de log?~~ → **Os dois — CSV e JSON, usuário escolhe na hora**, seguindo o mesmo padrão do `ExportarModal` de planilhas. JSON exporta a estrutura tal como está no `.jsonl`. CSV usa colunas fixas (`id, data, acao, projeto, registroId, quantidade, mensagem`) mais duas colunas `alteracoes_de` e `alteracoes_para` com o `JSON.stringify` de `original`/`atual` — evita achatar em colunas por campo (que quebraria com número variável de campos alterados), sem perder informação.
- ~~Falha ao gravar o log trava a ação real?~~ → **Não.** A mutação do usuário nunca falha por causa do log. Falha no `appendFile` dispara uma tentativa **única** de gravar `erro_servidor` registrando essa falha; se essa segunda gravação também falhar, só `console.error`, sem retry — evita loop.
- ~~Usuário pode criar tipo de log via interface?~~ → **Não, nunca.** Taxonomia é whitelist fixa no código, validada por `registrarLog`. "Adicionável no futuro" significa mudança de código (como a inclusão de `erro_servidor`/`erro_cliente` agora), não uma opção de runtime.
- ~~Timezone na exibição?~~ → Tela `/logs` sempre converte `data` (gravado em UTC) pro fuso horário local de quem está vendo.
- ~~Filtro de data: dia único ou intervalo?~~ → **Os dois** — suporta busca por um dia específico e por intervalo (de/até).
- ~~Auto-criação de `data/logs/`?~~ → Sim, criado automaticamente (`mkdir -p` equivalente) no primeiro `appendFile`.
- ~~Erros do cliente vão pra onde?~~ → Reaproveita o `POST /api/logs` já existente (o mesmo usado por `exportar_planilha`). Cobre tanto exceptions não tratadas na UI (`window.onerror`/error boundary) quanto respostas de API 4xx/5xx.
- ~~Nível de detalhe do erro?~~ → **Stack trace completo** em `detalhe` quando existir (erro JS); corpo da resposta de erro quando for um 4xx/5xx sem exception por trás. Custo em espaço é desprezível no volume esperado (erro não é ação de rotina); volume alto seria, ele mesmo, sinal de um bug a corrigir, não um problema de tamanho de log.
- ~~Como evitar poluir `data/logs/` com ruído de desenvolvimento?~~ → **Flag de ambiente (`.env`), não toggle de interface.** `LOGS_ATIVOS=false` no `.env`, checado no `vite.config.ts`, desativa a escrita sem expor um botão clicável no app. Motivo de não ser um botão na UI: contraria diretamente o requisito original ("toda e qualquer alteração"), e cria um paradoxo de auto-referência (desativar o log é, ela mesma, uma alteração — logar isso deixa uma lacuna suspeita no rastro; não logar cria a única ação do sistema desenhada pra não deixar rastro). Como dev e uso "real" rodam na mesma instância local, um botão ficaria exposto o tempo todo, com risco de desativação por engano. A tela `/logs` mostra um indicador somente-leitura de que o registro está desativado, sem permitir alternar por ali.

**Interface da tela `/logs`:**
- **Layout:** tabela. Clicar numa linha abre um modal com o log em detalhes (todos os campos, incluindo `original`/`atual`/`detalhe`).
- **Densidade da tabela:** só as colunas mais importantes (`data`, `acao`, `projeto`, `mensagem`); o resto (`id`, `registroId`, `quantidade`, `original`, `atual`, `detalhe`/`origem` nos erros) fica reservado pro modal de detalhe.
- **Paginação:** fixa em 50 por página, sem opção de o usuário mudar o tamanho.
- **Busca/filtros:** sempre acima da tabela (não painel lateral).
- **Ações vs Erros:** abas separadas, alternadas por um switch — não misturadas na mesma listagem. Trocar de aba **mantém** os filtros/busca e a página atual aplicados (não reseta).
- **Estado vazio:** "Nenhum log encontrado".
- **Estado de erro** (falha real do `GET /api/logs`, ex.: servidor fora do ar): mensagem distinta do estado vazio (ex.: "Erro ao carregar logs") — nunca a mesma mensagem de "nenhum log encontrado", pra não confundir "não tem nada" com "não consegui buscar".
- **Exportação:** botão sempre visível; exporta por mês/intervalo de meses (não pelo filtro atual, não por log individual — ver Escopo). 1 mês = arquivo direto; mais de 1 mês = `.zip`.
- **Acesso à tela:** só pelo botão no dropdown de configurações/funções do `Header` por enquanto (mesmo padrão visual dos outros itens do dropdown) — sem atalhos pré-filtrados a partir de outras telas nesta fase.

### Decisões em aberto

*(nenhuma pendente no momento)*

### Etapas de Implementação `[Inicial]`

> Quebra preliminar — revisar ao iniciar.

**Etapa 1 — Utilitário central de log**
- Função única (ex.: `registrarLog(acao, dados)`) que monta a linha no formato acima usando o template fixo de `mensagem` por `acao`, resolve o arquivo mensal correto (`data/logs/<AAAA-MM>.jsonl`), cria `data/logs/` automaticamente se não existir, e faz o `appendFile`. Todo handler chama essa função — nenhum handler escreve no arquivo de log diretamente, nem escreve `mensagem` como texto livre. Não grava nada quando a ação não resultou em mudança real (ver Decisões). Valida `acao` contra a whitelist fixa dos tipos definidos — rejeita qualquer valor fora dela.
- Envolvido em `try/catch`: se o `appendFile` falhar, tenta gravar uma única linha `erro_servidor` sobre essa falha; se essa segunda gravação também falhar, só `console.error`, sem nova tentativa (evita loop).
- Checa o flag de ambiente `LOGS_ATIVOS` no início da função — se `false`, retorna sem escrever nada (nenhum handler precisa saber disso; a decisão fica centralizada aqui).

**Etapa 2 — Instrumentar os handlers existentes**
- `vite.config.ts`: `POST /api/projetos` (`importar_planilha`), `PATCH /api/projetos/:slug` + a parte de colunas/dados do fluxo "Atualizar Planilha" (`alterar_planilha`, possivelmente 2 chamadas do utilitário no mesmo request), `POST /api/emails/:slug/sheet` (`reimportar_planilha`), `DELETE /api/projetos` (`deletar_projeto`), `POST /api/lixeira/restaurar` (`restaurar_projeto`), `DELETE /api/lixeira` (`deletar_projeto_permanente`).
- Handler de `PUT /api/emails/:slug`: `alterar_registro`, `restaurar_registro`, `editar_email`, conforme o que de fato mudou no payload.

**Etapa 3 — Endpoint de recepção client-side (`POST /api/logs`)**
- Recebe eventos que não nascem de um handler de mutação existente: confirmação de `exportar_planilha` (disparada por `exportarPlanilha.ts`) e, a partir da Etapa 4, os relatos de `erro_cliente`. Um único endpoint pros dois casos.

**Etapa 4 — Instrumentar logs de erro**
- Servidor: captura de exceptions não tratadas nos handlers do `vite.config.ts` (gera `erro_servidor` via `registrarLog`, respeitando o guard contra loop da Etapa 1).
- Cliente: `window.onerror`/error boundary do React (`erro_cliente`, `origem: "cliente"`) e interceptação de respostas 4xx/5xx nas chamadas de API existentes (`src/services/*Api.ts`), ambos enviados via `POST /api/logs` (Etapa 3).

**Etapa 5 — Leitura com filtro/busca/paginação**
- Novo `GET /api/logs`, com query params de busca (nome/data/tipo/projeto/registroId/id da alteração), filtro e paginação.
- Leitura sequencial por arquivo mensal (mês mais recente → mais antigo), com early-exit ao preencher a página pedida.

**Etapa 6 — Tela `/logs`**
- Nova rota (`App.tsx`); botão "Visualizar Logs" no dropdown de configurações/funções do `Header`, mesmo padrão visual dos demais itens.
- Tabela paginada (50 por página, fixo) com colunas `data`, `acao`, `projeto`, `mensagem`; clicar na linha abre modal com o log completo (`id`, `registroId`, `quantidade`, `original`, `atual`, e `origem`/`detalhe` quando for erro).
- Busca/filtro (nome, data — dia único ou intervalo —, tipo, projeto, registroId, id da alteração) sempre acima da tabela.
- Abas "Ações" / "Erros" com switch; troca de aba preserva filtros/busca/página atuais.
- Estado vazio: "Nenhum log encontrado". Estado de erro do fetch: mensagem distinta (ex.: "Erro ao carregar logs").
- Banner somente-leitura exibido quando `LOGS_ATIVOS=false` no ambiente atual (o `GET /api/logs` pode retornar esse estado junto da listagem).

**Etapa 7 — Exportar logs por mês**
- Novo `GET /api/logs/export` no `vite.config.ts` (query params: meses/intervalo + formato), já que a exportação lê `data/logs/` diretamente no servidor — o cliente não tem acesso a esses arquivos.
- Botão "Exportar Logs" sempre visível na tela `/logs`.
- Seletor de mês único ou intervalo de meses (não depende da busca/filtro/aba ativa — exporta os arquivos mensais como são, com ações e erros juntos, já que é assim que ficam armazenados).
- Seleção de formato (CSV ou JSON) por arquivo exportado, mesmo padrão do `ExportarModal` de planilhas; JSON exporta a estrutura como está, CSV usa o esquema de achatamento descrito em Decisões.
- 1 mês selecionado → download do arquivo direto (convertido pro formato escolhido). Mais de 1 mês → `.zip` contendo um arquivo por mês.

### Arquivos Necessários

**Arquivos Fonte:**
- `vite.config.ts` — todos os handlers de mutação existentes, pontos de instrumentação (Etapa 2).
- `src/pages/emails.tsx` — ações individuais e em massa sobre registros (Etapa 2).
- `src/components/atualizar/AtualizarDadosModal.tsx` — fluxo que pode gerar renomeio + alteração de dados no mesmo clique (Etapa 2).
- `src/components/utils/restaurarCampos.ts` — lógica de `restaurar_registro` (Etapa 2).
- `src/components/utils/exportarPlanilha.ts` — ponto de disparo de `exportar_planilha` (Etapa 3) e padrão de referência do fluxo de exportação (Etapa 7).
- `src/components/Header.tsx` — onde entra o botão "Visualizar Logs", no dropdown de configurações/funções já existente (Etapa 6).
- `src/App.tsx` — onde entra a rota `/logs` (Etapa 6).

**Arquivos Alterados:**
- `vite.config.ts` — handlers existentes passam a chamar `registrarLog`; novos endpoints `POST /api/logs` (Etapa 3), `GET /api/logs` (Etapa 5) e `GET /api/logs/export` (Etapa 7).
- `.env` / `.env.example` — nova variável `LOGS_ATIVOS` (Etapa 1).
- `src/components/utils/exportarPlanilha.ts` — chamada ao endpoint de log (Etapa 3).
- `src/components/Header.tsx` — novo botão "Visualizar Logs" (Etapa 6).
- `src/App.tsx` — nova rota `/logs` (Etapa 6).

**Arquivos Criados:**
- `src/scripts/utils/registrarLog.ts` *(nome sugerido)* — utilitário central de escrita do log, com resolução do arquivo mensal (Etapa 1).
- `data/logs/<AAAA-MM>.jsonl` *(arquivos novos, gerados em runtime — um por mês)* (Etapa 1).
- `src/pages/logs.tsx` *(nome sugerido)* — tela de visualização (Etapa 6).
- `src/services/logsApi.ts` *(nome sugerido)* — client para `POST /api/logs` (Etapa 3) e `GET /api/logs` (Etapa 5).
- `src/components/logs/*` *(nomes a definir)* — tabela, modal de detalhe, abas, filtros, busca e botão de exportação da tela de logs (Etapas 6 e 7).
- `src/scripts/utils/exportarLogs.ts` *(nome sugerido)* — leitura dos arquivos mensais selecionados, conversão pro formato escolhido (CSV com o esquema de achatamento descrito em Decisões, ou JSON) e, quando for mais de 1 mês, empacotamento em `.zip`. Roda no servidor, atrás do `GET /api/logs/export` (Etapa 7).

---

## Demanda 10 — Refatoração do Sistema de Duplicatas

**Status:** ✅ Concluída
**Esforço estimado:** Dias — 15 etapas, a maioria de baixo risco e independentes entre si a partir da Etapa 4; Etapas 0–3 são sequenciais
**Depende de:** —
**Bloqueia:** —

### Contexto

O status `duplicado` é hoje um dos 5 valores possíveis do campo `status` de `EmailRecord` (`válido`/`inválido`/`duplicado`/`deletado`/`enviado`), calculado automaticamente quando dois ou mais registros ativos compartilham o mesmo e-mail. Como a trava `status_alterado` impede que um status definido manualmente seja recalculado, uma sequência real de ações (deletar dois de três duplicados → o terceiro vira `válido`/`inválido` automaticamente → é editado manualmente → um dos deletados é restaurado) deixa dois registros com o mesmo e-mail em estados divergentes e sem vínculo visual entre si (um mostra `duplicado`, o outro mostra o status manual) — um bug de modelagem de dados confirmado como ainda presente no código atual (`TStatus` ainda inclui `'duplicado'`).

### A solução proposta

Desacoplar "duplicado" de `status`: `status` passa a ter só 4 valores (`válido`/`inválido`/`deletado`/`enviado`); duplicidade vira uma flag calculada em runtime (nunca persistida, considerando só registros **ativos** — deletados nunca contam). Deixa de existir um badge "duplicado" próprio: o registro sempre mostra seu status real, e ganha um **ícone de alerta** ao lado (`IconeAlerta`, já existente no projeto) sempre que o e-mail estiver duplicado — com tooltip "Este registro está duplicado" e clique exclusivo do ícone para abrir o modal (o badge/select do status real mantém sua função normal de edição, sem sobreposição de clique). Um registro pode ser `válido` **e** duplicado, `inválido` **e** duplicado, ou `enviado` **e** duplicado — este último é o caso mais importante na prática, pois sinaliza risco de envio repetido para a mesma pessoa. `deletado` nunca recebe o ícone. A trava `status_alterado`/`backup_dados` continua igual, mas deixa de decidir se um registro "pode ser visto como duplicado".

### Etapas de Implementação `[Inicial]`

1. Migração dos dados existentes (`status: 'duplicado'` → recalculado para `válido`/`inválido`).
2. Modelo de dados (`types/email.ts`, `EmailStatus.ts`) — remover `'duplicado'` de `TStatus`, extrair `calcularEmailsDuplicados`.
3. Script de sincronização (`sync.ts`) — parar de atribuir `'duplicado'`.
4. Estado derivado central (`emails.tsx`) — calcular `emailsDuplicados` uma vez, via `useMemo`.
5. Contadores (`EmailCounters.tsx`, `emailData.ts`).
6. Filtros (`emailData.ts`, `EmailToolbar.tsx`) — **checkpoint de produto**: filtros de status passam a poder se sobrepor.
7. Ordenação por status (`STATUS_ORDEM_EXIBICAO`).
8. Tabela principal (`EmailTable.tsx`) — remove o badge "duplicado"; ícone de alerta clicável (com tooltip) ao lado do status real, independente de qual seja.
9. Handlers de edição manual (`emails.tsx`) — **checkpoint de produto**: libera edição de registros duplicados.
10. Remoção de código morto (`StatusUpdateConflict.tsx`).
11. Revisão de `DuplicadosModal.tsx`/`DuplicadosConflitoModal.tsx`.
12. Exportação (`ExportarModal.tsx`, `exportarPlanilha.ts`) — deduplicação ao exportar com checkboxes sobrepostos.
13. Conferência do assistente de importação (`statsPreliminares.ts`, `EtapaRevisao.tsx`, `EtapaInformacoes.tsx`).
14. QA do cenário original e regressão.
15. Atualização da especificação do sistema.

Detalhamento completo de cada etapa, critérios de aceite e roteiro de teste manual em `public/RefatoracaoSistemadeDuplicatas.md`.

### Arquivos Alterados (previstos)

- `src/types/email.ts`, `src/components/EmailStatus.ts` — modelo de status e cálculo de duplicidade.
- `src/scripts/sync.ts` — sincronização via terminal.
- `src/pages/emails.tsx`, `src/components/EmailTable.tsx`, `src/components/EmailToolbar.tsx`, `src/components/utils/emailData.ts` — estado derivado, tabela, filtros, contadores.
- `src/components/ExportarModal.tsx`, `src/components/utils/exportarPlanilha.ts` — exportação.
- Assistente de importação (`statsPreliminares.ts`, `EtapaRevisao.tsx`, `EtapaInformacoes.tsx`) — só conferência, sem alteração esperada.

### Arquivos Removidos (previstos)

- `src/components/StatusUpdateConflict.tsx` — código morto após a Etapa 9.

---

## Demanda 11 — Backup/Exportação Completa do Sistema

**Status:** Registrado
**Esforço estimado:** Dias
**Depende de:** —
**Bloqueia:** —

### Contexto

Hoje existe exportação por projeto (planilha/CSV, via `ExportarModal.tsx`) e um script de migração pontual (`migrar-backup-dados`), mas nenhum jeito de exportar o sistema inteiro. Todos os dados vivem só em `data/active/`, `data/trash/` e `data/logs/`, em arquivos locais sem nenhuma cópia de segurança — se essa pasta for perdida (disco, exclusão acidental, reinstalação da máquina), não há como recuperar nada.

### Escopo

**Cobre:**
- Exportar um pacote único (`.zip`) contendo `data/active/`, `data/trash/` e `data/logs/` inteiros, com timestamp no nome do arquivo, baixável pela interface.
- Restaurar o sistema a partir de um pacote gerado pelo próprio Malote — com um passo de confirmação explícito no frontend, já que é uma operação destrutiva (substitui o `data/` atual).
- Validação básica do pacote antes de aplicar a restauração (estrutura mínima esperada, mensagem de erro clara se o arquivo não for um backup válido do sistema).

**Não cobre nesta fase:**
- Backup automático/agendado — esta demanda é só sob demanda (botão "Exportar backup"), não um cron.
- Armazenamento remoto/nuvem — só download local, o mesmo modelo do restante do sistema.
- Merge entre um backup restaurado e os dados atuais — restaurar é substituição total do `data/`, não uma mesclagem seletiva.

### Decisões em aberto

- **Formato do pacote:** `.zip` simples (mais direto) vs. um pacote com `manifest.json` próprio (versão do schema de dados, hash de integridade) — o segundo facilita detectar backups de versões antigas/incompatíveis do sistema, se o modelo de dados mudar no futuro (ex.: depois da Demanda 10).
- **Onde fica o botão na interface:** dentro de algum menu de "Configurações" (mesmo lugar cogitado para o histórico da Demanda 4, se ela for retomada) ou uma tela própria.
- **Granularidade da restauração:** o pacote sempre substitui `data/` inteiro, ou o usuário pode escolher restaurar só alguns projetos específicos de dentro do pacote?

### Etapas de Implementação `[Inicial]`

> Quebra preliminar — revisar ao iniciar, principalmente a decisão de formato do pacote (zip simples vs. manifest com versão/hash), que muda a Etapa 4.

**Etapa 1 — Endpoint de exportação**
- Novo endpoint (`GET /api/backup`, seguindo o padrão dos demais em `vite.config.ts`) que lê `data/active/`, `data/trash/` e `data/logs/` e monta um `.zip`, devolvido como download.

**Etapa 2 — Botão de exportar na interface**
- UI que dispara o download do backup (local a decidir — ver "Decisões em aberto").

**Etapa 3 — Endpoint de importação**
- Novo endpoint (`POST /api/backup`) que recebe o `.zip`, valida a estrutura mínima esperada, e substitui `data/` — reaproveitando o padrão de escrita segura já usado em outros pontos do projeto (gravar em local temporário e só então `fs.renameSync` para o destino final, para não deixar o sistema num estado parcialmente restaurado se a operação falhar no meio).

**Etapa 4 — Confirmação e validação na interface**
- Fluxo de confirmação explícito antes de restaurar (é destrutivo).
- Mensagens de erro claras quando o arquivo enviado não é um backup válido do Malote.

**Etapa 5 — Teste manual**
- Gerar um backup, mover/apagar `data/`, restaurar, e confirmar que projetos, lixeira e logs voltam idênticos ao estado original.

### Arquivos Necessários

**Arquivos Alterados:**
- `vite.config.ts` — dois novos endpoints (exportar/importar backup).

**Arquivos Criados:**
- Utilitário de empacotamento/leitura do `.zip` *(local a decidir — dentro de `vite.config.ts` ou em `src/scripts/utils/backup.ts`)*.
- Componente de UI para exportar/restaurar *(nome sugerido: `BackupModal.tsx`)*.

**Dependência nova:** nenhuma lib de `.zip` está no projeto hoje — precisa escolher uma (ex.: `archiver` para escrever, `adm-zip`/`unzipper` para ler).

---

## Demanda 12 — Testes Automatizados

**Status:** Registrado
**Esforço estimado:** Dias (setup do runner + primeira leva de testes)
**Depende de:** —
**Bloqueia:** —

### Contexto

O projeto não tem nenhum teste automatizado — não há Jest, Vitest, nem qualquer arquivo `*.test.*`/`*.spec.*`. Toda validação até hoje é manual, ou limitada a `tsc --noEmit`/`eslint`. As áreas com histórico de bug sutil e maior risco de regressão silenciosa — cálculo de status/duplicados, merge de conflito na reimportação, filtros e contadores — não têm nenhuma rede de segurança automatizada.

> ⚠️ **Nota técnica sobre o runner:** este documento registra a demanda com **Jest**, como pedido. Vale registrar também que o projeto é 100% ESM (`"type": "module"` no `package.json`, `moduleResolution: "bundler"` e `verbatimModuleSyntax` no `tsconfig`) — o ambiente nativo do próprio Vite, que já roda o projeto. O Jest funciona nesse cenário, mas historicamente exige configuração adicional não trivial para ESM + TypeScript (via `ts-jest` ou `babel-jest`, ajustes de resolução de módulo, mocks de `import.meta.env`). O Vitest, por rodar sobre o mecanismo do próprio Vite, tende a funcionar sem essa configuração extra, usando o mesmo `tsconfig` e o mesmo resolvedor de módulos que o `npm run dev`/`npm run build` já usam. Fica como decisão em aberto abaixo — não mudei a escolha, só deixei o trade-off registrado para quando a Etapa 1 começar.

### Escopo

**Cobre:**
- Setup do runner de testes e configuração de TypeScript/ESM correspondente.
- Testes unitários para a lógica pura do sistema, priorizados por risco:
  - `src/scripts/utils/calcularMerge.ts` (cenários de conflito da Demanda 3);
  - `src/components/EmailStatus.ts` (regras de status, incluindo o comportamento hoje inconsistente do "duplicado" — ver Demanda 10);
  - `src/components/utils/emailData.ts` (filtros, ordenação, contadores);
  - `src/scripts/utils/validateEmail.ts`, `src/components/utils/slugify.ts`, `src/components/utils/restaurarCampos.ts`, `src/components/utils/paginacao.ts`.
- Um script `npm test` para rodar a suíte.

**Não cobre nesta fase:**
- Testes de componentes React (React Testing Library) — a prioridade inicial é a lógica de dados, não a interface.
- Testes end-to-end (Playwright/Cypress) contra a API embutida no `vite.config.ts`.
- Integração em pipeline de CI — não existe CI configurado no repositório hoje; esta demanda cobre só a suíte local.

### Decisões em aberto

- **Jest (como pedido) vs. Vitest** — ver nota técnica acima.
- **Meta de cobertura:** exigir um número mínimo (ex.: cobertura alta em `calcularMerge.ts` e `EmailStatus.ts`, por serem os módulos historicamente mais frágeis) ou não ter meta numérica, só garantir os cenários certos?
- **Convenção de localização dos arquivos de teste:** `*.test.ts` ao lado de cada módulo, ou centralizados em pastas `__tests__/`?

### Etapas de Implementação `[Inicial]`

> Quebra preliminar — revisar ao iniciar, principalmente a escolha do runner (Etapa 1), que muda toda a configuração subsequente.

**Etapa 1 — Setup do runner**
- Instalar e configurar o runner escolhido, com suporte a TypeScript e ESM compatível com o `tsconfig` atual.

**Etapa 2 — `EmailStatus.ts`**
- Prioridade 1: é onde mora o cálculo de status/duplicados, incluindo o bug já mapeado na Demanda 10.

**Etapa 3 — `calcularMerge.ts`**
- Cenários de conflito da reimportação de planilha (Demanda 3): atributo alterado, registro corrigido, registro enviado, registro deletado revivido, registro sumido.

**Etapa 4 — `emailData.ts` e `paginacao.ts`**
- Filtros, ordenação, contadores e paginação.

**Etapa 5 — Módulos restantes**
- `validateEmail.ts`, `slugify.ts`, `restaurarCampos.ts`.

**Etapa 6 — Integração ao fluxo de verificação**
- Adicionar `npm test` ao README, ao lado de `lint`/`build`, como parte do checklist manual antes de commitar.

### Arquivos Necessários

**Arquivos Alterados:**
- `package.json` — novo(s) devDependency e script `test`.
- `README.md` — menção ao `npm test` no checklist de verificação.

**Arquivos Criados:**
- Arquivo de configuração do runner escolhido, na raiz do projeto.
- Um `*.test.ts` por módulo listado no Escopo (local exato a confirmar na Etapa 1, conforme a "Convenção de localização" acima).

---

## Demanda 2 — Variáveis no Texto (merge tags)

**Status:** Registrado
**Esforço estimado:** Dias
**Depende de:** —
**Bloqueia:** Demanda 1 (para o "renderizar por destinatário" funcionar de fato — ver Escopo)

### Contexto

O título/corpo do e-mail (`EmailConteudo`) é hoje um texto único e estático para todos os registros da planilha — não existe nenhum `{{nome}}` ou placeholder dinâmico. Para uma ferramenta de disparo em massa, personalização por destinatário costuma ser básico.

### Escopo

**Cobre:**
- Novo botão "Criar Variável" na toolbar do editor (`EmailEditorToolbar.tsx`), ao lado do botão "Criar Botão" já existente.
- Popover para escolher, dentre as colunas identificadas pela planilha (`identifyColumns.ts`), qual variável inserir no texto.
- Inserção da variável como um elemento atômico no editor (não editável por dentro), similar em espírito ao node de botão já existente.
- Visualização da variável no editor com o nome da coluna (ex.: `[ NomeAluno ]`), não com um valor real — não há "registro ativo" no contexto de edição do template.

**Não cobre nesta fase:**
- Substituição de fato da variável pelo valor do registro — isso só acontece no momento do envio, e portanto depende da Demanda 1 existir (ver "Decisões em aberto" abaixo). Sem a Demanda 1, esta demanda entrega só a parte de inserir/visualizar a variável no template.
- Lógica condicional dentro da variável (ex.: "se o campo estiver vazio, mostrar outro texto").
- Formatação automática por tipo de dado (datas, números) — o valor é inserido como string bruta da célula.

### Exemplo de uso

```
Olá, [ NomeAluno ]!

Parabéns por concluir o curso [ NomeCurso ] no dia [ DataConclusão ]!

Os certificados serão enviados no dia [ DataEnvio ]!
```

### Decisões em aberto

- **Onde a substituição de fato acontece:** só faz sentido no momento do disparo (Demanda 1) ou também deveria existir um modo de "pré-visualização" que renderiza o e-mail com os dados de um registro específico, mesmo sem enviar de verdade? Um modo de pré-visualização entregaria valor mesmo sem a Demanda 1 pronta.
- **Comportamento quando a célula está vazia:** a variável deveria renderizar como string vazia, manter o placeholder visível (`[ NomeAluno ]`), ou usar um valor de fallback configurável?
- **Nome de exibição da variável:** usar o nome exato da coluna da planilha (`NomeAluno`) ou permitir um apelido mais amigável na hora de inserir?

### Etapas de Implementação `[Inicial]`

> Quebra preliminar — revisar ao iniciar, principalmente a decisão sobre pré-visualização (pode virar uma etapa própria se for aprovada).

**Etapa 1 — Node customizado no Tiptap**
- Criar extensão de node (não mark, pelo mesmo motivo do `NoBotao.ts`: é um elemento atômico que precisa se comportar como bloco/inline não editável por dentro).
- Renderizar como `<span data-variavel="NomeColuna" contenteditable="false">[ NomeColuna ]</span>` (ou equivalente).

**Etapa 2 — Sanitização**
- Adicionar `data-variavel` à allowlist de `sanitizarHtml.ts` (`ALLOWED_ATTR`) — `span` já está permitido, falta o atributo novo.

**Etapa 3 — Botão e popover na toolbar**
- Novo item `variavel` em `EmailEditorToolbar.tsx`, seguindo o mesmo padrão de popover já usado (`ToolbarPopover`).
- Popover lista as colunas disponíveis (via `identifyColumns.ts`/headers da planilha do projeto atual).
- Clique insere a variável no cursor atual, via `editor.chain().focus().insertContent(...)`, no mesmo padrão já usado pelo `EmojiPickerFlutuante`.

**Etapa 4 — Exportação email-safe**
- Verificar se `emailHtmlInline.ts` precisa de algum tratamento especial para a variável ao gerar o HTML "email-safe" (provavelmente não, se for só um `span` com texto dentro — mas validar).

**Etapa 5 — Substituição por valor real (depende da decisão em aberto)**
- Se aprovado o modo de pré-visualização: nova função que recebe o HTML do template + um `EmailRecord`, e substitui cada `<span data-variavel="X">` pelo valor de `registro[X]`.
- Se não: esta etapa fica registrada aqui, mas só é implementada junto da Demanda 1.

### Arquivos Necessários

**Arquivos Fonte:**
- `src/components/editor/extensoes/NoBotao.ts` — padrão de referência para a criação de um nó atômico customizado no Tiptap (Etapa 1).
- `src/components/editor/ToolbarPopover.tsx` — popover já existente, reaproveitado sem alteração para listar as colunas disponíveis (Etapa 3).
- `src/components/EmojiPickerFlutuante.tsx` — padrão já usado de inserção via `editor.chain().focus().insertContent(...)` (Etapa 3).
- `src/scripts/utils/identifyColumns.ts` — fonte das colunas identificadas da planilha, listadas no popover (Etapa 3).

**Arquivos Alterados:**
- `src/components/EmailEditorToolbar.tsx` — novo item `variavel` na toolbar, ao lado do botão "Criar Botão" já existente (Etapa 3).
- `src/components/utils/sanitizarHtml.ts` — adiciona `data-variavel` à allowlist `ALLOWED_ATTR` (Etapa 2).
- `src/components/utils/emailHtmlInline.ts` — possível tratamento especial ao gerar o HTML "email-safe" (a confirmar, Etapa 4).

**Arquivos Criados:**
- `src/components/editor/extensoes/NoVariavel.ts` *(nome sugerido)* — extensão de nó customizado do Tiptap para a variável (Etapa 1).
- `src/components/utils/substituirVariaveis.ts` *(nome sugerido, condicional à decisão em aberto sobre pré-visualização)* — função que recebe o HTML do template + um `EmailRecord` e substitui cada variável pelo valor real (Etapa 5).

---

## Demanda 6 — Armazenamento Duplo (Banco + Local)

**Status:** Registrado
**Esforço estimado:** Semanas
**Depende de:** —
**Bloqueia:** Demanda 1 (recomendado, não bloqueante)

### Contexto

O armazenamento local (arquivo JSON por projeto) já existe e funciona. Esta demanda adiciona a opção de também persistir os dados de uma planilha em um banco de dados real, o que exige uma camada de requisições e rotas que hoje não existe formalmente (o middleware do Vite é o único "backend" atual, e é limitado ao dev server).

Esta demanda se sobrepõe conceitualmente à seção 9 ("Planos Futuros") de `DEVME.md`, que já antecipa backend real e persistência em banco como parte da visão de longo prazo do projeto — vale consultar essa seção para não divergir das decisões já registradas lá.

### Escopo

**Cobre:**
- Escolha e configuração de um banco de dados (SQLite recomendado para manter o espírito "local-first" do projeto — arquivo único, sem servidor externo a instalar; Postgres se a hospedagem já for um objetivo próximo).
- Camada de acesso a dados via ORM/query builder tipado (Drizzle ou Prisma, para manter consistência com o restante do projeto em TypeScript).
- O middleware do `vite.config.ts` (ou seu sucessor) passa a gravar no banco em vez de sobrescrever o JSON diretamente.
- O JSON local passa a ser **exportação/fallback**, não a fonte de verdade primária — sem sincronização bidirecional em tempo real entre os dois.

**Não cobre nesta fase:**
- Sincronização bidirecional automática entre banco e arquivo local (fonte de verdade passa a ser uma só: o banco; o arquivo é gerado a partir dele, não o contrário).
- Multiusuário/autenticação — fora do escopo desta demanda especificamente, mesmo sendo um pré-requisito natural para essa visão de longo prazo.
- Migração automática de dados já existentes em `data/*/emails.json` para o banco — se necessário, é uma etapa própria, não coberta aqui por padrão (ver Etapa 4 abaixo, marcada como opcional).

### Decisões em aberto

- **SQLite vs. Postgres:** SQLite é mais simples e mantém o projeto rodando 100% local sem infraestrutura extra; Postgres antecipa a fase de hospedagem (seção 9 de `DEVME.md`) mas exige um servidor de banco rodando. Recomenda-se SQLite nesta fase, migrando para Postgres somente quando a hospedagem real entrar em pauta.
- **Papel do JSON depois desta mudança:** vira só um export manual (via `ExportarModal`, já existente) ou continua sendo gravado automaticamente a cada alteração, como um "backup espelho"? Isso muda o design da Etapa 3.

### Etapas de Implementação `[Inicial]`

> Quebra preliminar — revisar por completo ao iniciar; esta é a demanda com maior chance de o desenho mudar depois de decisões técnicas (ORM escolhido, SQLite vs. Postgres).

**Etapa 1 — Escolha de banco e ORM**
- Decidir SQLite vs. Postgres (ver decisão em aberto) e Drizzle vs. Prisma.
- Modelar o schema equivalente a `EmailsData`/`EmailRecord` (`types/email.ts`) no formato relacional.

**Etapa 2 — Camada de acesso a dados**
- Criar o módulo de acesso ao banco (queries de leitura/escrita equivalentes ao que `emailsApiPlugin` faz hoje com o arquivo).

**Etapa 3 — Migração do middleware**
- Middleware do `vite.config.ts` passa a chamar a camada de acesso ao banco em vez de `fs.writeFileSync` diretamente.
- Decidir e implementar o papel do JSON local (export manual vs. backup automático — ver decisão em aberto).

**Etapa 4 — Migração de dados existentes (opcional, se necessário)**
- Script único de importação dos arquivos `data/*/emails.json` já existentes para o banco recém-criado, para não perder os projetos já em uso.

**Etapa 5 — Validação de compatibilidade**
- Conferir que todo o restante do sistema (leitura de projetos via `projetos.ts`, exportação, etc.) continua funcionando com a nova fonte de dados — vários pontos do código hoje assumem leitura estática de arquivo (`import.meta.glob`), que deixa de fazer sentido com um banco por trás.

### Arquivos Necessários

**Arquivos Fonte:**
- `src/types/email.ts` — modelo `EmailRecord`/`EmailsData` usado como base para o schema relacional (Etapa 1).
- `vite.config.ts` — `emailsApiPlugin` atual, referência do que a camada de acesso a banco precisa substituir (Etapa 2).
- `data/active/projeto-teste/emails.json`, `data/active/chamada-alunos-ibm/emails.json` — dados existentes usados na migração opcional para o banco (Etapa 4).
- `DEVME.md` (seção 9, "Planos Futuros") — decisões já registradas a não divergir.

**Arquivos Alterados:**
- `vite.config.ts` — middleware passa a chamar a camada de acesso ao banco em vez de `fs.writeFileSync` diretamente (Etapa 3).
- `src/data/projetos.ts` — leitura de projetos precisa deixar de assumir arquivo estático (`import.meta.glob`) e passar a consultar o banco (Etapa 5).

**Arquivos Criados:**
- Schema do banco (ORM escolhido — Drizzle ou Prisma) *(ex.: `src/db/schema.ts` ou `prisma/schema.prisma`, a definir na Etapa 1)*.
- `src/db/emailsRepository.ts` *(nome sugerido)* — camada de acesso a dados (queries de leitura/escrita equivalentes ao `emailsApiPlugin` atual) (Etapa 2).
- Arquivo de configuração do banco/ORM na raiz do projeto (ex.: `drizzle.config.ts`), se SQLite/Drizzle for a escolha.
- `data/emails.db` *(nome sugerido, se SQLite for escolhido)* — arquivo único do banco local.
- `src/scripts/migrarParaBanco.ts` *(nome sugerido, opcional — Etapa 4)* — script único de importação dos `data/*/emails.json` existentes para o banco.

---

## Demanda 1 — Envio Automático dos E-mails

**Status:** Registrado
**Esforço estimado:** Semanas — tratar como uma etapa prioritária do próprio sistema
**Depende de:** Demanda 6 (recomendado, não bloqueante — ver observação em Escopo)
**Bloqueia:** —

### Contexto

Hoje o sistema organiza destinatários: importa planilhas, valida e-mails, identifica duplicados e permite selecionar os registros para um disparo controlado.

A visão de longo prazo é transformar o sistema em um **disparador controlado de e-mails com proteção anti-spam**: o sistema passa a enviar de fato, não apenas organizar quem vai receber. O objetivo é evitar que envios em massa (dezenas ou centenas de uma vez) façam o remetente ser identificado como spam pelos provedores (Gmail, Outlook etc.), através de um envio **fatiado em blocos, espaçado no tempo**.

### Escopo

**Cobre:**
- Seleção de destinatários (reaproveitando os filtros/seleção já existentes na tabela).
- Definição de título/corpo do e-mail (reaproveitando `EmailConteudo`).
- Divisão do envio em blocos, com intervalo de tempo configurável entre eles.
- Execução automática, sobrevivendo ao fechamento da aba do navegador.
- Registro de sucesso/falha por e-mail enviado.
- Controle básico do disparo: pausar, retomar, cancelar.

**Não cobre nesta fase:**
- Templates de e-mail reaproveitáveis entre disparos distintos (cada disparo usa o `EmailConteudo` do projeto no momento em que é disparado).
- Métricas de abertura/clique (tracking) — fora do escopo, sistema não hospeda pixel/link tracking.
- Envio por múltiplos provedores simultâneos (só uma conta remetente configurada por vez).
- Fila com prioridade entre disparos concorrentes — na primeira versão, um disparo por vez.

### Exemplo concreto de uso

- 100 e-mails selecionados;
- Divididos em 5 blocos de 20;
- Intervalo de 10 minutos entre blocos;
- Resultado: a cada 10 minutos, o sistema dispara automaticamente 20 e-mails, até completar os 5 blocos (40 minutos no total).

### Por que é a demanda mais complexa do lote

Não é uma questão de volume de código, é estrutural: hoje **não existe backend persistente**. O middleware do Vite (`emailsApiPlugin`) só roda em `npm run dev` e só grava dados quando o navegador está aberto fazendo a requisição. Um "disparo" precisa sobreviver ao fechamento da aba — o que implica:
- Um processo servidor real (Node standalone, não middleware de dev server) rodando o scheduler.
- Persistência de estado do disparo (pendente/em andamento/pausado) independente da sessão do navegador.
- Integração com Microsoft Graph API (`Mail.Send`) — cadastro de app no Azure AD, fluxo OAuth, tokens com refresh — ou, como alternativa mais simples, SMTP direto via Nodemailer.

### Decisões em aberto

- **Provedor de envio:** Microsoft Graph API (mais "nativo" ao fluxo atual via Outlook, porém exige OAuth/Azure AD) vs. SMTP direto (mais simples de implementar, porém depende de um relay/servidor SMTP disponível e configurado). Afeta diretamente a Etapa 3 abaixo.
- **Limite diário de envio:** contas comuns do Microsoft 365/Gmail têm teto de e-mails por dia — o sistema deveria bloquear/avisar antes de configurar um disparo que ultrapasse esse teto, ou deixar por conta do usuário?
- **Link de descadastro:** incluir automaticamente em todo e-mail disparado, ou deixar como responsabilidade do conteúdo digitado pelo usuário?
- **Relação com a Demanda 6:** essa demanda pode, tecnicamente, ser implementada sobre o armazenamento em arquivo atual (um JSON de "disparo" por projeto), mas fica mais robusta com um banco real por trás (evita corrupção de arquivo em escrita concorrente do scheduler). Tratar como recomendado, não bloqueante, para não travar o início desta demanda esperando a Demanda 6.

### Etapas de Implementação `[Inicial]`

> Quebra preliminar — revisar por completo ao iniciar esta demanda, especialmente a decisão de provedor de envio (Graph API vs. SMTP), que muda a Etapa 3 inteira.

**Etapa 1 — Modelo de dados do Disparo**
- Definir o tipo `Disparo`/`Campanha`: registros selecionados (IDs), referência ao `EmailConteudo` usado, tamanho de bloco, intervalo entre blocos, status (`pendente | em_andamento | pausado | concluido | cancelado`), progresso (blocos enviados, horário do próximo bloco), log de envio (data/hora, sucesso/falha por e-mail).
- Local de persistência a decidir (arquivo dedicado por projeto, ou já a estrutura da Demanda 6, se estiver pronta).

**Etapa 2 — Tela de configuração do disparo**
- UI para: selecionar registros (reaproveitando seleção já existente em `emails.tsx`), definir/reaproveitar título e corpo, definir quantidade de blocos ou tamanho de bloco, definir intervalo entre blocos.
- Validação: intervalo mínimo razoável, tamanho de bloco não maior que a seleção total.

**Etapa 3 — Capacidade real de envio**
- Implementar o client de envio (Graph API ou SMTP, conforme decisão em aberto acima).
- Testar envio unitário antes de plugar no scheduler.

**Etapa 4 — Scheduler**
- Processo Node standalone (fora do dev server do Vite) que verifica periodicamente disparos com bloco pendente cujo horário já chegou, e o executa.
- Precisa rodar independente do navegador estar aberto.

**Etapa 5 — Tratamento de falhas e controle do usuário**
- Registrar falhas de envio de um bloco sem travar o restante do disparo.
- Implementar pausar/retomar/cancelar.
- Implementar reenvio apenas dos e-mails que falharam.

**Etapa 6 — Boas práticas anti-spam**
- Checagem de limite diário de envio da conta usada.
- Opção de incluir link de descadastro.
- Revisão de conteúdo quanto a padrões que costumam disparar filtro de spam (excesso de maiúsculas, links suspeitos).

### Arquivos Necessários

**Arquivos Fonte:**
- `src/pages/emails.tsx` — seleção/filtros de destinatários já existentes, reaproveitados na tela de configuração do disparo (Etapa 2).
- `src/types/email.ts` — `EmailConteudo`, reaproveitado como título/corpo do disparo (Etapa 1).
- Estrutura de persistência da Demanda 6 (se pronta) — recomendada como base de armazenamento do estado do disparo (Etapa 1).

**Arquivos Alterados:**
- `src/pages/emails.tsx` — integração com a nova tela de configuração de disparo, expondo a seleção de registros já existente (Etapa 2).

**Arquivos Criados:**
- `src/types/disparo.ts` *(nome sugerido)* — tipo `Disparo`/`Campanha` (registros selecionados, conteúdo, tamanho/intervalo de blocos, status, progresso, log de envio) (Etapa 1).
- `src/components/DisparoConfigModal.tsx` *(nome sugerido)* — tela/modal de configuração do disparo (Etapa 2).
- `src/server/emailSender.ts` *(nome sugerido)* — client de envio real (Microsoft Graph API ou SMTP, conforme decisão em aberto) (Etapa 3).
- `src/server/scheduler.ts` *(nome sugerido)* — processo Node standalone que executa os blocos pendentes, independente do navegador estar aberto (Etapa 4).
- `src/services/disparoApi.ts` *(nome sugerido)* — client para configurar, pausar, retomar, cancelar e consultar o disparo.

---

## Demanda 8 — Sistema de Seleção de Temas

**Status:** ✅ Concluída
**Esforço estimado:** Dias
**Depende de:** —
**Bloqueia:** —

### Contexto

O sistema possuía uma alternância simples entre os temas claro e escuro, mas o `variables.css` passou a conter uma coleção de temas com identidades visuais próprias. A seleção precisava deixar de tratar os temas como apenas dois modos e oferecer uma experiência organizada para uma coleção extensa.

### Escopo

**Cobre:**
- Catálogo centralizado com metadados, classificação, modo, descrição e cores de preview para todos os temas existentes.
- Item "Escolher Tema" na Header e modal com filtros combinados por tipo e modo.
- Preview imediato sem persistência durante a seleção.
- Confirmação, cancelamento, fechamento por `X`, `ESC` ou backdrop, com retorno de foco.
- Persistência pelo ID do tema, fallback seguro para Claro e layout responsivo com lista rolável.

**Não cobre nesta fase:**
- Criação ou alteração de paletas de cores existentes.
- Temas definidos fora dos blocos já presentes em `variables.css`.
- Personalização livre de cores pelo usuário.

### Decisões

- O registro central fica em `src/data/temas.ts` e usa `data-theme` apenas por ID.
- Claro é o padrão; preferências inválidas também retornam para Claro.
- `aplicarTema` atualiza somente o preview em memória; `definirTema` confirma e persiste.

### Etapas de Implementação `[Inicial]`

**Etapa 1 — Inventário e registro de temas**
- Identificar todos os seletores `[data-theme]` de `variables.css`.
- Criar os metadados tipados e as três cores representativas de cada tema.

**Etapa 2 — Contexto e persistência**
- Substituir o contrato Light/Dark por IDs de temas.
- Aplicar o tema visualmente sem persistir previews e validar o fallback.

**Etapa 3 — Modal e Header**
- Remover "Trocar tema" e inserir "Escolher Tema" abaixo de "Deletar planilha".
- Implementar filtros, cards com radio, cores e ícone de modo.

**Etapa 4 — Acessibilidade e validação**
- Reaproveitar `Dialog` para foco, teclado, ESC, backdrop e retorno de foco.
- Validar build, lint, responsividade e referências do mecanismo antigo.

### Arquivos Alterados

- `index.html` — Claro como tema inicial do documento.
- `Demandas.md` — registro desta demanda.
- `src/components/Header.tsx` — novo item e abertura do seletor.
- `src/components/Icons.tsx` — ícone do seletor.
- `src/contexts/ThemeContext.tsx` — catálogo de IDs, preview e persistência separada.
- `src/index.css` — estilos do catálogo e remoção do toggle antigo.

### Arquivos Criados

- `src/data/temas.ts` — registro centralizado dos temas.
- `src/components/ThemeSelectorModal.tsx` — modal de seleção e preview.