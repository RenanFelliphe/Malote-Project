# Malote — Especificação (v3)

> **Nota de atualização:** este documento é a especificação **original** (v3) do projeto, escrita quando o sistema ainda rodava sobre uma única planilha, um único arquivo JSON e sincronização exclusivamente por terminal. Parte da visão de longo prazo descrita na seção **9** já foi implementada — múltiplos projetos, importação pela interface, rotas dinâmicas por slug — mas **não da forma prevista** (sem backend real nem hospedagem; tudo continua rodando localmente, com a "API" embutida no próprio servidor de desenvolvimento do Vite). As seções abaixo foram atualizadas onde o comportamento real diverge do texto original; onde a seção 8 descrevia etapas de implementação, isso já foi concluído há tempos e fica registrado aqui como histórico. Para o estado atual completo e o roteiro de evolução em andamento, ver [DEMANDAS.md](DEMANDAS.md) e [README.md](README.md).

---

## 1. Objetivo

Criar um sistema local para organizar e facilitar o envio de e-mails em massa por meio de uma interface visual. O sistema deverá:

1. Importar uma planilha (`.csv` ou `.xlsx`);
2. Sincronizar seus dados com um arquivo JSON;
3. Exibir uma interface HTML/React para consulta e gerenciamento;
4. Buscar, filtrar, ordenar e selecionar registros;
5. Preparar e realizar o envio de e-mails em massa;
6. Atualizar e persistir os status dos registros.

O sistema organiza os destinatários e oferece suporte ao envio de e-mails.

### Stack técnica

O projeto seguiu a mesma linguagem e estrutura do projeto de referência `multiverso.riopombavalley`:

- **React 19** + **TypeScript** + **Vite** + **react-router-dom**;
- Organização de pastas: `src/components`, `src/pages`, `src/data`, `src/types`, `src/components/utils`;
- Um script Node independente (fora do bundle do Vite) cuida da leitura da planilha e sincronização com o JSON, executado manualmente via terminal — hoje coexistindo com a importação/atualização pela própria interface (ver seção 2.3).

---

## 2. Arquitetura

## 2.1 Fonte dos dados

O sistema utiliza duas fontes de dados:

### Planilha
- É apenas a fonte de importação.
- Nunca armazena alterações realizadas pelo sistema.

### JSON
- É a fonte oficial dos dados.
- Toda alteração realizada pela interface deverá ser gravada nele.
- **O arquivo JSON representa permanentemente o estado atual do sistema.** Ele é a única fonte de verdade consultada pela interface; a planilha só é lida no momento da importação/sincronização.
- **Atualização:** deixou de existir um único JSON — hoje cada projeto (planilha importada) tem o seu próprio, em `data/active/<slug>/emails.json`. `<slug>` é definido uma única vez na importação (ver seção 2.4) e usado tanto no nome da pasta quanto na rota da interface. A estrutura interna de cada arquivo está na seção 4.

## 2.2 Persistência

Todas as alterações deverão ser persistidas imediatamente no arquivo JSON.

Não deverá existir botão **Salvar**.

O sistema não utilizará `localStorage` como mecanismo principal de armazenamento.

**Atualização:** a persistência imediata é feita por uma API local embutida no próprio servidor de desenvolvimento do Vite (`vite.config.ts`, via `configureServer`), não por um backend separado. Isso significa que essa API só existe enquanto `npm run dev` está rodando — não há persistência funcional num build de produção (`npm run build`/`vite preview`). Ver README, seção "Arquitetura", para detalhes.

## 2.3 Sincronização

**Nesta fase (local, sem hospedagem), a sincronização é disparada manualmente pelo terminal**, executando um script Node (ex.: `node src/scripts/sync.ts caminho/para/planilha.csv`). Esse script lê a planilha informada e sincroniza os dados com o JSON correspondente.

> Esse é um dos três modelos possíveis de disparo de sincronização (comando manual / watcher automático / botão de importação na UI). Optamos pelo comando manual por ser o mais simples de implementar agora, e por ser adequado a um ambiente 100% local, sem múltiplos usuários e sem necessidade de backend. Quando o projeto migrar para hospedagem (seção 9), esse mecanismo será substituído por importação via interface, com backend próprio.

**Atualização:** o "quando" do parágrafo acima já aconteceu, parcialmente — a importação via interface (assistente em `src/components/import/`) e a atualização de um projeto existente a partir de nova planilha (`src/components/atualizar/`) já existem e coexistem com o script de terminal, que continua disponível como alternativa (`npm run sync -- <planilha> --slug=<slug>`). O que **não** aconteceu foi a migração para backend hospedado: ambos os caminhos (interface e terminal) escrevem no mesmo tipo de arquivo JSON local, através da mesma API embutida no Vite.

### Identificação de registros

**Os registros deverão ser identificados pelo campo `id`, que representa a ordem original do registro na planilha.** É esse campo — e não o e-mail ou o nome — que determina se uma linha da planilha corresponde a um registro já existente no JSON durante a sincronização.

**Atualização (Demanda 7 — Mapeamento de ID Personalizado):** por padrão o `id` continua sendo a ordem original da linha na planilha, mas agora é possível escolher, por projeto, uma coluna da própria planilha como origem do `id` (campo `colunaId` em `EmailsData`, seção 4). Isso é definido na importação e pode ser remapeado depois em "Atualizar Dados". Projetos que nunca usaram essa opção simplesmente não têm `colunaId` definido, e continuam se comportando exatamente como descrito abaixo.

Durante a sincronização:

- novos registros (cujo `id` não existe no JSON) deverão ser adicionados;
- registros existentes (cujo `id` já existe no JSON) deverão ser atualizados apenas nas informações provenientes da planilha (nome, e-mail);
- alterações manuais deverão ser preservadas;
- registros com `status_alterado = false` deverão ser reavaliados automaticamente;
- registros com `status_alterado = true` deverão manter seu status atual.

> **Atualização:** o campo booleano `status_alterado` foi substituído por `backup_dados` (ver seção 4) — mesma função de trava contra sobrescrita, generalizada também para `nome` e `email`, não só `status`. A regra acima continua valendo na prática: "status_alterado = true" hoje equivale a "existe uma chave `status` dentro de `backup_dados`".

### Fluxo de sincronização

```text
Rodar script (npm run sync -- planilha.csv --slug=projeto)
   — ou importar/atualizar pela interface —
        ↓
Identificar colunas (ou usar colunaId, se definido)
        ↓
Sincronizar com JSON do projeto (por id)
        ↓
Atualizar registros
        ↓
Validar e-mails (regex)
        ↓
Identificar duplicados
        ↓
Aplicar prioridades
        ↓
Gravar JSON atualizado (data/active/<slug>/emails.json)
        ↓
Interface React lê o JSON do projeto e renderiza
```

> **Atualização (Demanda 10):** "Identificar duplicados" e "Aplicar prioridades" deixaram de ser o mesmo passo. Duplicidade é calculada à parte (flag em runtime, seção 5.4), e "Aplicar prioridades" (seção 5.2) decide apenas entre `enviado`/`deletado`/`válido`/`inválido` — nenhuma das duas etapas depende da outra para decidir o status final de um registro.

---

## 3. Importação

> **Atualização:** o que segue descreve a identificação **automática** de colunas, usada tanto pelo script de terminal quanto como sugestão inicial no assistente de importação pela interface. O assistente (`ImportWizardModal`, `src/components/import/`) permite ao usuário revisar e ajustar manualmente esse mapeamento antes de confirmar — inclusive escolher uma coluna específica da planilha como origem do `id` dos registros (`colunaId`, Demanda 7 — Mapeamento de ID Personalizado), em vez de usar a ordem original da linha.

## 3.1 identifyColumns()

O sistema deverá possuir uma função responsável por identificar as colunas da planilha.

O desenvolvedor definirá manualmente quais nomes poderão representar:

- ID
- Nome
- E-mail

Para e-mail, poderá ser informada mais de uma coluna.

Exemplo:

```ts
const emailColumns = [
    "E-mail",
    "Digite seu melhor e-mail",
    "Informe seu e-mail"
];
```

A função deverá:

- procurar as colunas na ordem definida;
- utilizar a primeira coluna preenchida para cada registro;
- retornar erro caso nenhuma coluna seja encontrada.

---

# 4. Modelo de Dados

> **Atualização:** o modelo abaixo (um JSON com um array de registros direto na raiz) descreve a v3 original. A estrutura real, hoje, é um objeto por projeto — `data/active/<slug>/emails.json` — que envolve o array de registros com metadados do próprio projeto. Os campos de cada registro individual também evoluíram: veja o quadro "Estrutura atual" logo abaixo do exemplo original.

## Estrutura do JSON (original, v3)

```json
{
  "id": 1,
  "nome": "João",
  "email": "joao@gmail.com",
  "status": "válido",
  "status_alterado": false,
  "last_updated": "..."
}
```

### Campos (originais)

- **id:** ordem original do registro na planilha;
- **nome:** nome do usuário;
- **email:** endereço de e-mail;
- **status:** situação atual do registro;
- **status_alterado:** indica que o status foi definido manualmente;
- **last_updated:** data e hora da última alteração persistida.

Sempre que qualquer alteração persistente ocorrer, `last_updated` deverá ser atualizado.

## Estrutura atual (por projeto)

Cada arquivo `data/active/<slug>/emails.json` (tipo `EmailsData`, em `src/types/email.ts`) tem este formato:

```json
{
  "projeto": "Nome de exibição do projeto",
  "atualizado_em": "2026-09-05T19:19:31.000Z",
  "criado_em": "2026-08-01T10:00:00.000Z",
  "slug": "nome-do-projeto",
  "colunaId": "Matrícula",
  "email": {
    "titulo": "Assunto do e-mail",
    "conteudo": "<p>Corpo em HTML, editado no editor rico</p>",
    "atualizado_em": "2026-09-01T12:00:00.000Z"
  },
  "registros": [
    {
      "id": 1,
      "nome": "João",
      "email": "joao@gmail.com",
      "status": "válido",
      "backup_dados": { "email": "joao@antigo.com" },
      "last_updated": "2026-09-05T19:19:31.000Z"
    }
  ]
}
```

### Campos do projeto (`EmailsData`)

- **projeto:** nome de exibição, livre, definido no assistente de importação;
- **slug:** identidade real do projeto, usada como nome de pasta e na rota; gravada explicitamente a partir do primeiro soft delete, ausente em projetos que nunca passaram pela lixeira (nesse caso o nome da pasta em `data/active/` é a própria identidade);
- **colunaId:** nome da coluna da planilha usada como origem do `id` dos registros (Demanda 7); ausente = comportamento original ("gerar automaticamente", pela ordem da linha);
- **deletado_em:** presente só enquanto o projeto está na lixeira (`data/trash/`);
- **criado_em / atualizado_em:** datas de criação do projeto e da última escrita bem-sucedida no arquivo;
- **email:** título e corpo (HTML) do e-mail a ser enviado, mais a data da última edição desse conteúdo;
- **registros:** o array de `EmailRecord`, descrito abaixo.

### Campos de cada registro (`EmailRecord`)

- **id:** identificador do registro — ordem original da linha, ou o valor da coluna escolhida em `colunaId`;
- **nome / email:** dados do destinatário;
- **status:** situação atual do registro (seção 5.2);
- **backup_dados:** substitui o antigo `status_alterado` booleano — objeto com os valores originais de `nome`/`email` capturados na primeira edição manual (para permitir desfazer), e uma marcação booleana para `status` (mesmo papel de trava contra sobrescrita em sincronizações futuras, nunca lido como valor de status em si);
- **last_updated:** data/hora da última alteração persistida neste registro específico.

Sempre que qualquer alteração persistente ocorrer, `last_updated` (do registro) e `atualizado_em` (do projeto) deverão ser atualizados.

---

# 5. Regras de Negócio

## 5.1 Validação

A validação utilizará apenas uma regex simples de sintaxe de e-mail.

Não deverá verificar:

- existência da conta;
- domínio;
- DNS;
- qualquer validação externa.

**Status inicial:** após a importação, todo registro deverá ser classificado automaticamente como **válido**, **inválido** ou **duplicado**, respeitando a prioridade dos status definida em 5.2.

> **Atualização (Demanda 10 — Refatoração do Sistema de Duplicatas):** duplicidade deixou de ser um dos resultados possíveis dessa classificação inicial. Após a importação, todo registro é classificado automaticamente apenas como **válido** ou **inválido**; "duplicado" passou a ser calculado à parte, como uma flag independente (ver seção 5.4 atualizada), que pode coexistir com qualquer um dos 4 status reais.

## 5.2 Status

Os únicos status existentes são:

- válido
- inválido
- duplicado
- deletado
- enviado

### Prioridade

1. enviado
2. deletado
3. duplicado
4. válido / inválido

Sempre prevalecerá o status de maior prioridade.

> **Atualização (Demanda 10):** `duplicado` deixou de ser um valor de `status` — os únicos status existentes hoje são **válido**, **inválido**, **deletado** e **enviado**, com prioridade `enviado > deletado > válido/inválido` (sem posição própria para duplicidade, que não compete mais por prioridade nenhuma). O motivo da mudança e o modelo atual estão detalhados na seção 5.4 abaixo.

## 5.3 status_alterado

Sempre que o usuário alterar manualmente um status, o sistema deverá definir:

`status_alterado = true`

Enquanto esse atributo for verdadeiro, o status não poderá ser recalculado automaticamente durante sincronizações.

## 5.4 Duplicados

Um registro será considerado duplicado quando existir mais de um registro com o mesmo endereço de e-mail, independentemente do nome.

Ao filtrar por duplicados, todos os registros pertencentes ao grupo duplicado deverão ser exibidos.

> ⚠️ **Inconsistência conhecida (histórico — corrigida na Demanda 10):** por `duplicado` ser um valor de `status` — o mesmo campo usado para `válido`/`inválido`/`deletado`/`enviado` — um registro não podia ser "duplicado" e "válido" ao mesmo tempo. Em sequências reais de deletar/restaurar/editar manualmente, isso podia deixar dois registros com o mesmo e-mail em estados divergentes e sem vínculo visual entre si.

> **Atualização (Demanda 10 — Refatoração do Sistema de Duplicatas, concluída — ver `public/RefatoracaoSistemadeDuplicatas.md`):** a inconsistência acima foi corrigida migrando `duplicado` de valor de `status` para **flag calculada em runtime**, desacoplada do status real do registro:
>
> - `status` (`TStatus`, `src/types/email.ts`) passou a ter só 4 valores: `válido`, `inválido`, `deletado`, `enviado` — a definição de status em 5.2 e a prioridade nunca mais incluem `duplicado`.
> - Duplicidade é um `Set` de e-mails normalizados que aparecem mais de uma vez entre registros **ativos** (não `deletado`), calculado em runtime (`calcularEmailsDuplicados`, em `src/components/EmailStatus.ts`, com contraparte em `src/scripts/utils/validateEmail.ts` para o script de terminal) — nunca persistido como campo novo no JSON.
> - Na interface, o registro exibe seu status real (badge/select normal) e, ao lado, um ícone de alerta sempre que seu e-mail estiver no `Set` de duplicados — com tooltip e clique para abrir o modal de duplicados (`DuplicadosConflitoModal.tsx`). O status em si nunca mais mostra a palavra "duplicado".
> - Um registro pode ser `válido` **e** duplicado, `inválido` **e** duplicado, ou `enviado` **e** duplicado, simultaneamente — o cenário que causava a inconsistência (registro manual "congelado" num status enquanto seu par no mesmo grupo de e-mail ficava preso em "duplicado") deixa de ser possível, porque os dois fatos (status real e "está duplicado") não competem mais pelo mesmo campo.
> - `deletado` fica fora dessa combinação: um registro deletado já é ignorado no cálculo do grupo de duplicados e não recebe o ícone de alerta.
> - A trava de edição manual (seção 5.3/7) não muda — o que muda é que ela deixa de decidir também se um registro "pode ser visto como duplicado": um registro duplicado pode ser editado manualmente para qualquer status normal, com o ícone de alerta recalculado de forma independente da escolha manual (ver seção 7, "Atualizar Status", atualizada abaixo).

## 5.5 Contadores

O sistema deverá exibir:

- total de registros;
- válidos;
- inválidos;
- duplicados;
- deletados;
- enviados.

Todos os contadores deverão respeitar o status efetivo do registro.

> **Atualização (Demanda 10):** o contador "Duplicados" é a exceção prevista pela regra acima — desde que duplicidade deixou de ser um valor de `status` (seção 5.4), esse contador não respeita mais um status efetivo, e sim conta todo registro **ativo** (não `deletado`) cujo e-mail está na flag calculada, independentemente do seu status real. Um mesmo registro pode contar simultaneamente em "Duplicados" e em seu contador de status real (ex.: "Válidos"). Os demais 5 contadores continuam respeitando exatamente o status efetivo de cada registro, sem sobreposição entre si.

---

# 6. Interface

## Busca

Busca por:

- nome;
- e-mail.

A busca deverá considerar simultaneamente nome e e-mail, em uma única caixa de busca (não haverá campos de busca separados).

Deverá ser:

- parcial;
- case insensitive.

## Filtros

Os filtros disponíveis serão:

- Todos *(opção de filtro; não é um status)*
- Válidos
- Inválidos
- Duplicados
- Deletados
- Enviados

## Ordenação

- ID (ordem original da planilha)
- Ordem alfabética

## Tabela

Cada linha deverá apresentar:

- ID
- Nome
- E-mail
- Status

---

# 7. Modal "Listar E-mails"

> **Atualização:** este modal evoluiu para o `ExportarModal.tsx` atual, que além de copiar a lista para a área de transferência (como descrito abaixo) também exporta os registros selecionados em planilha (`utils/exportarPlanilha.ts`). O comportamento de seleção, filtro e cópia descrito nesta seção continua valendo.

O modal deverá permitir:

- definir a quantidade de registros;
- escolher um filtro, dentre as opções definidas na seção **6. Interface → Filtros** (Todos, Válidos, Inválidos, Duplicados, Deletados, Enviados);
- selecionar registros individualmente;
- selecionar todos;
- alternar visualmente entre nome e e-mail.

A troca entre nome e e-mail será apenas visual.

## Copiar

Copiará exclusivamente os registros selecionados.

Formato:

`email1@email.com;email2@email.com`

A ordem será exatamente a ordem exibida.

Caso existam e-mails duplicados selecionados, todos serão copiados.

## Atualizar Status

Permitirá alterar os registros selecionados para:

- válido
- inválido
- enviado

Toda alteração manual deverá definir:

`status_alterado = true`

**Não deverá ser possível alterar manualmente um registro para o status `duplicado`**, pois esse status é calculado automaticamente pelo sistema e não constitui uma opção de atualização manual.

> **Atualização (Demanda 10 — Etapa 8, `public/RefatoracaoSistemadeDuplicatas.md`):** a restrição acima deixou de fazer sentido do jeito que estava escrita — `duplicado` não é mais um valor de `status` (seção 5.2), então nunca foi, e continua não sendo, uma opção de destino manual nos SELECTs de status. O que mudou de fato é outra restrição, que existia antes desta demanda e foi removida: registros cujo e-mail está duplicado (a flag da seção 5.4) podiam ser bloqueados para atualização manual em massa/individual só por causa disso. Isso não existe mais — um registro duplicado pode ser normalmente atualizado para válido/inválido/enviado, com o ícone de alerta de duplicidade recalculado à parte, independente da escolha manual.

---

## Exclusão lógica

O sistema não removerá registros fisicamente.

Ao deletar um registro:

- seu status passará para `deletado`;
- `status_alterado` deverá ser definido como `true`.

Essa segunda regra é necessária para que uma nova sincronização não sobrescreva o status `deletado`.

## Restaurar

Quando todos os registros selecionados estiverem deletados, o botão mudará automaticamente para **Restaurar**.

Ao restaurar:

- `status_alterado` deverá voltar para `false`;
- o status será recalculado conforme as regras de prioridade do sistema, e o registro voltará a ser processado normalmente pelo sistema (sujeito a reavaliação em futuras sincronizações).

## Regra de seleção

Não será permitido selecionar simultaneamente registros deletados e não deletados.

Assim, o botão executará apenas uma ação por vez:

- Deletar
- Restaurar

---

## Restrição para enviados

Registros com status **enviado** não poderão ser deletados.

Caso a seleção contenha registros enviados, o sistema deverá abrir um modal de resolução de conflito.

### Seção "Enviados"

Exibir:

- quantidade;
- lista dos registros enviados.

Sem possibilidade de seleção.

### Seção "A Deletar"

Exibir:

- quantidade;
- lista dos registros elegíveis.

Todos previamente selecionados.

Também deverá existir a opção **Selecionar Todos**.

### Botões

- Cancelar
- Deletar

### Cancelar

- fecha o modal;
- cancela a deleção;
- preserva a seleção original.

### Deletar

- fecha o modal;
- altera para `deletado` (com `status_alterado = true`) apenas os registros selecionados na seção **A Deletar**;
- mantém inalterados os registros enviados.

---

# 8. Etapas de Implementação (Fase Atual — Local) — histórico

> **Atualização:** as 6 etapas abaixo descrevem a implementação **inicial** do projeto (versão de uma única planilha, um único JSON, sem interface de importação) e foram concluídas há tempos — o sistema evoluiu muito além delas desde então (múltiplos projetos, importação pela interface, lixeira, temas, logs, edição individual, mapeamento de ID, entre outros — ver `DEMANDAS.md`). Ficam registradas aqui como histórico de como o projeto começou, não como um roteiro pendente.

A implementação será feita em etapas pequenas e sequenciais. Cada etapa deve ser validada antes de avançar para a próxima.

## Etapa 1 — Estrutura do projeto e modelo de dados

**O que fazer:**
- Criar a estrutura de pastas seguindo o padrão do `multiverso.riopombavalley`: `data/` (planilhas e JSON), `src/scripts/` (script de sincronização), `src/types/` (tipos), `src/pages/` (componente `emails.tsx`).
- Definir a interface TypeScript do registro (`Registro` ou `EmailRecord`), com os campos: `id`, `nome`, `email`, `status`, `status_alterado`, `last_updated`.
- Definir o tipo/união dos status possíveis (`"válido" | "inválido" | "duplicado" | "deletado" | "enviado"`).
- Preparar um CSV de exemplo (ou usar uma das 2 planilhas reais) para testes.

**Critério de conclusão:** estrutura de pastas criada, tipos definidos, projeto Vite rodando localmente (`npm run dev`) exibindo uma página em branco/placeholder.

## Etapa 2 — Script de sincronização (planilha → JSON)

**O que fazer:**
- Implementar `identifyColumns()`: localizar colunas de ID, Nome e E-mail a partir de listas de nomes possíveis definidas pelo desenvolvedor, respeitando a ordem de prioridade e utilizando a primeira coluna preenchida.
- Implementar a leitura do `.csv` (e preparar suporte a `.xlsx`, se necessário).
- Implementar a sincronização por `id`: adicionar novos registros, atualizar nome/e-mail de registros existentes, preservar alterações manuais (`status_alterado = true`).
- Implementar a validação de e-mail via regex simples.
- Implementar a detecção de duplicados (mesmo e-mail, independentemente do nome).
- Implementar a aplicação das prioridades de status (enviado > deletado > duplicado > válido/inválido).
- Gravar o JSON atualizado em `data/`, atualizando `last_updated` nos registros alterados.
- Script deve ser executável via terminal, ex.: `node --loader ts-node/esm src/scripts/sync.ts data/planilha.csv`.

**Critério de conclusão:** rodar o script sobre uma planilha de teste e obter um JSON corretamente sincronizado, validado e com status calculados.

## Etapa 3 — Interface de leitura (`emails.tsx`)

**O que fazer:**
- Criar o componente que lê o JSON gerado pela Etapa 2 e renderiza a tabela (ID, Nome, E-mail, Status).
- Implementar os contadores (total, válidos, inválidos, duplicados, deletados, enviados), respeitando o status efetivo de cada registro.
- Implementar a busca única (nome + e-mail simultaneamente), parcial e case insensitive.
- Implementar os filtros (Todos, Válidos, Inválidos, Duplicados, Deletados, Enviados).
- Implementar a ordenação (por ID e por ordem alfabética).

**Critério de conclusão:** interface local exibindo os dados do JSON, com busca, filtro e ordenação funcionando corretamente.

## Etapa 4 — Modal "Listar E-mails" e cópia

**O que fazer:**
- Criar o modal com: campo de quantidade de registros, seletor de filtro (reaproveitando as opções da Etapa 3), seleção individual e "selecionar todos", alternância visual nome/e-mail.
- Implementar a função de copiar, respeitando exatamente a ordem exibida e o formato `email1@email.com;email2@email.com`.
- Garantir que e-mails duplicados selecionados sejam todos copiados.

**Critério de conclusão:** possível abrir o modal, selecionar registros, alternar entre nome/e-mail visualmente, e copiar a lista de e-mails corretamente formatada.

## Etapa 5 — Atualização de status e exclusão lógica

**O que fazer:**
- Implementar a atualização manual de status (válido, inválido, enviado) a partir da seleção, definindo `status_alterado = true` em cada alteração. Bloquear a opção `duplicado` como destino manual.
- Implementar a exclusão lógica (`status = deletado`, `status_alterado = true`).
- Implementar a troca automática do botão para "Restaurar" quando todos os selecionados estiverem deletados, incluindo o reset de `status_alterado = false` e o recálculo do status.
- Implementar a regra de seleção: impedir seleção simultânea de deletados e não deletados.
- Persistir todas as alterações imediatamente no JSON (sem botão salvar), atualizando `last_updated`.

**Critério de conclusão:** possível alterar status manualmente, deletar e restaurar registros, com persistência imediata e respeitando as regras de seleção.

## Etapa 6 — Modal de conflito para registros "enviados"

**O que fazer:**
- Detectar quando uma seleção destinada à exclusão contém registros com status `enviado`.
- Abrir o modal de conflito com as seções "Enviados" (somente visualização) e "A Deletar" (pré-selecionados, com opção "Selecionar Todos").
- Implementar os botões **Cancelar** (fecha o modal, preserva seleção original, nada é alterado) e **Deletar** (aplica `deletado` + `status_alterado = true` apenas aos registros da seção "A Deletar", mantendo os enviados intactos).

**Critério de conclusão:** ao tentar deletar uma seleção mista (enviados + outros), o modal de conflito é exibido corretamente e resolve a exclusão apenas para os registros elegíveis.

---

# 9. Planos Futuros (Visão de Longo Prazo) — status atual

> **Atualização:** parte relevante desta visão já foi implementada (9.1–9.4), mas **sem** a mudança de arquitetura que a seção original previa para viabilizá-la (backend real e hospedagem, 9.5–9.6) — tudo continua rodando localmente, com a "API" embutida no servidor de desenvolvimento do Vite. Cada subseção abaixo foi marcada com o status real.

A fase descrita na seção 8 resolveu a necessidade imediata: ler as planilhas atuais e organizar o envio, rodando localmente. A partir daí o projeto evoluiu — parcialmente na direção prevista aqui, parcialmente por outros caminhos (ver `DEMANDAS.md` para o roteiro real de evolução, incluindo itens não previstos nesta especificação original, como temas visuais e log de alterações).

## 9.1 Página inicial com cards — ✅ implementado

Existe uma página inicial (`src/pages/home.tsx`) que lista os projetos já importados, substituindo a leitura direta de um único JSON fixo.

## 9.2 Componente único e reutilizável de renderização — ✅ implementado

`src/pages/emails.tsx` não aponta mais para um JSON fixo: recebe `slug` e `dados` como props (via as rotas geradas em `src/App.tsx`) e renderiza qualquer projeto importado com o mesmo componente.

## 9.3 Importação via interface (sem terminal) — ✅ implementado, com o terminal ainda disponível

O assistente de importação (`ImportWizardModal`, `src/components/import/`) permite escolher a planilha pelo seletor de arquivos do sistema operacional e definir o nome do projeto (que gera o slug — seção 9.4), substituindo a necessidade do comando de terminal para o uso do dia a dia. Diferente do previsto, o comando manual (`npm run sync`) não foi removido: continua existindo como alternativa.

## 9.4 Rotas dinâmicas e slug — parcialmente implementado

Cada projeto importado gera uma URL própria (`/<slug>`), derivada do nome escolhido (`slugify.ts`). Porém, ao contrário do que esta seção previa, a descoberta dos projetos existentes **continua acontecendo via `import.meta.glob({ eager: true })`** (`src/data/projetos.ts`) — o mesmo mecanismo do projeto de referência que esta seção dizia que não serviria para um sistema hospedado. Isso funciona bem localmente, com o servidor de desenvolvimento do Vite reavaliando o glob a cada mudança nos arquivos, mas **não é** a resolução de rotas verdadeiramente dinâmica em tempo de execução que um sistema hospedado, sem rebuild a cada importação, exigiria — essa parte da visão original permanece válida e pendente.

## 9.5 Backend e persistência — ❌ não implementado (como previsto aqui)

Não existe um backend separado nem um banco de dados. O que existe é uma API local (rotas `/api/projetos`, `/api/emails`, `/api/lixeira`, `/api/logs`) implementada dentro do próprio `vite.config.ts`, via o hook `configureServer` — funcional apenas enquanto `npm run dev` está rodando, sem equivalente em build de produção. A persistência continua sendo por arquivo JSON local (um por projeto), não migrou para banco de dados nem para um serviço com filesystem remoto.

## 9.6 Hospedagem — ❌ não implementado

O sistema continua 100% local, de uso single-user, sem hospedagem.

## 9.7 Resumo da transição — atualizado

| Aspecto | Fase original (v3) | Previsto (v9, hospedado) | Estado real hoje |
|---|---|---|---|
| Disparo da sincronização | comando manual no terminal | botão "Importar" na interface | ambos coexistem (interface e `npm run sync`) |
| Quantidade de planilhas | 2, fixas | N, dinâmicas | N, dinâmicas — múltiplos projetos |
| Rotas | única página fixa | rotas dinâmicas por slug | rotas por slug, mas descobertas via `import.meta.glob` (não runtime puro) |
| Geração de página | nenhuma (página única) | criada em tempo real, sem rebuild | criada ao importar, mas ainda dependente do `vite dev` rodando |
| Persistência | arquivo JSON local | banco de dados ou storage persistente | arquivo JSON local, um por projeto — sem banco de dados |
| Backend | não existe | necessário | API embutida no `vite.config.ts` (só existe em modo dev, não é um backend separado) |
| Hospedagem | não existe | prevista | ainda não existe — sistema 100% local |
