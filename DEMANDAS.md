# DEMANDAS.md

> Este documento reúne as demandas levantadas para evolução do sistema, além da especificação já formalizada em `Especificacao_Sistema_Emails_v3.md`. Diferente da especificação (que descreve o que **já foi decidido e está pronto para ser implementado**), este arquivo registra objetivos e ideias em diferentes estágios de maturidade — desde melhorias pontuais até a visão de longo prazo do projeto — para que não se percam entre uma conversa e outra.
>
> As demandas estão organizadas na ordem recomendada de execução (não pela numeração de identificação, que é fixa e não muda): **5 → 3 → 7 → 4 → 2 → 6 → 1**.

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
| 5 | Edição Individual de Registro | Mapeado | Dias | — | 3 (novo requisito: conflito de sync) |
| 3 | Atualizar Planilha via UI | Mapeado | Dias | 5 (modelo `backup_dados`) | — |
| 7 | Mapeamento de ID Personalizado | Registrado | Horas–dias | — | — |
| 4 | Histórico de Alterações | Registrado | Horas–dias (versão simples) | — | — |
| 2 | Variáveis no Texto (merge tags) | Registrado | Dias | — | 1 (para "fechar o ciclo") |
| 6 | Armazenamento Duplo (Banco + Local) | Registrado | Semanas | — | 1 (recomendado) |
| 1 | Envio Automático dos E-mails | Registrado | Semanas | 6 (recomendado) | — |

---

## Demanda 5 — Edição Individual de Registro

**Status:** Mapeado
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

**Status:** Mapeado
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

**Status:** Registrado
**Esforço estimado:** Horas–dias
**Depende de:** —
**Bloqueia:** —

### Contexto

Surgiu durante o destrinchamento da Demanda 3, como parte da seção "Colunas" do fluxo Atualizar Dados: a ideia original era permitir selecionar, na hora de remapear colunas, qual coluna da planilha deveria ser usada como `id` do registro. Só que hoje **nenhum** dos dois pontos de entrada (wizard de importação nem a futura Demanda 3) tem esse seletor — o `id` é sempre a ordem da linha na planilha, ou uma coluna de ID detectada automaticamente por `identifyColumns.ts` sem controle explícito do usuário sobre qual coluna usar quando há mais de uma candidata.

Foi retirada do escopo da Demanda 3 porque, para fazer sentido, precisa nascer nos dois lugares ao mesmo tempo — se nascesse só na atualização, o `id` usado para casar registros na reimportação poderia divergir silenciosamente do `id` que o projeto usou na criação.

### Escopo

**Cobre:**
- Novo controle (`<select>`) na etapa de mapeamento, tanto no `EtapaMapeamento.tsx` (wizard de importação, criação de projeto) quanto na seção "Colunas" da Demanda 3 (`AtualizarDadosModal`), para escolher explicitamente qual coluna da planilha representa o `id` do registro.
- Comportamento padrão preservado quando o usuário não escolhe nada: mesma regra atual (ordem da linha, ou coluna detectada automaticamente por `identifyColumns.ts`).
- Validação de unicidade dos valores da coluna escolhida como ID (avisar se houver valores repetidos, já que isso quebra o casamento de registros na sincronização).

**Não cobre nesta fase:**
- Migração de `id` para projetos já existentes que mudarem de estratégia de identificação (ex.: projeto criado sem coluna de ID explícita passa a ter uma) — o risco de desalinhamento entre reimportações ao trocar de estratégia de ID no meio do caminho de um projeto já existente é uma nota de atenção a levantar na implementação, não uma migração automática coberta aqui.

### Decisões em aberto

- Se a coluna de ID escolhida tiver valores vazios ou duplicados, o sistema deve bloquear a confirmação ou só avisar e seguir com o fallback de ordem de linha para os casos problemáticos?

### Etapas de Implementação `[Inicial]`

> Quebra preliminar — revisar ao iniciar e ao ver como a Demanda 3 evoluiu (esta demanda toca os dois mesmos pontos de mapeamento que ela usa).

**Etapa 1 — Seletor de coluna de ID**
- Novo `<select>` na etapa de mapeamento, listando as colunas identificadas pela planilha, com opção "Nenhuma (usar ordem da linha)" como padrão.

**Etapa 2 — Validação de unicidade**
- Ao escolher uma coluna, verificar duplicidade/vazios nos valores e exibir aviso (conforme decisão em aberto).

**Etapa 3 — Reaproveitar no wizard de importação**
- Adicionar o seletor em `EtapaMapeamento.tsx` (criação de projeto).

**Etapa 4 — Reaproveitar na Demanda 3**
- Adicionar o mesmo seletor na seção "Colunas" do `AtualizarDadosModal` (Demanda 3), com a mesma validação.

### Arquivos Necessários

**Arquivos Fonte:**
- `src/scripts/utils/identifyColumns.ts` — lógica atual de detecção automática de colunas, base para a nova opção explícita de ID.
- `src/components/import/EtapaMapeamento.tsx` — ponto de inserção do seletor no wizard de importação (Etapa 3).
- `src/components/atualizar/AtualizarDadosModal.tsx` *(criado pela Demanda 3)* — ponto de inserção do seletor na seção "Colunas" (Etapa 4).

**Arquivos Alterados:**
- `src/components/import/EtapaMapeamento.tsx` — novo seletor de coluna de ID (Etapa 3).
- `src/components/atualizar/AtualizarDadosModal.tsx` — novo seletor de coluna de ID (Etapa 4).
- `src/scripts/utils/identifyColumns.ts` — validação de unicidade dos valores da coluna escolhida (Etapa 2).

**Arquivos Criados:**
- Nenhum arquivo novo previsto — a demanda estende componentes já existentes/planejados por outras demandas.

---

## Demanda 4 — Histórico de Alterações

**Status:** Registrado
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