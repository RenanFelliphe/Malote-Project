# Sistema de Organização e Envio de E-mails — Especificação (v3)

> **Escopo desta versão:** esta fase do projeto roda **localmente**, sem hospedagem, sem geração de slug e sem página dinâmica de importação. O objetivo imediato é ler planilhas já existentes (hoje, 2) e organizar o envio dos e-mails. A visão de longo prazo (importação via interface, cards, rotas dinâmicas, hospedagem) está descrita na seção **9. Planos Futuros**.

---

## 1. Objetivo

Criar um sistema local para organizar e facilitar o envio de e-mails em massa por meio de uma interface visual. O sistema deverá:

1. Importar uma planilha (`.csv` ou `.xlsx`);
2. Sincronizar seus dados com um arquivo JSON;
3. Exibir uma interface HTML/React para consulta e gerenciamento;
4. Buscar, filtrar, ordenar e selecionar registros;
5. Copiar e-mails para envio em massa;
6. Atualizar e persistir os status dos registros.

O sistema não realizará o envio de e-mails. Seu objetivo é apenas organizar os destinatários.

### Stack técnica

O projeto seguirá a mesma linguagem e estrutura do projeto de referência `multiverso.riopombavalley`:

- **React 19** + **TypeScript** + **Vite** + **react-router-dom**;
- Organização de pastas: `src/components`, `src/pages`, `src/data`, `src/types`, `src/components/utils`;
- Um script Node independente (fora do bundle do Vite) cuidará da leitura da planilha e sincronização com o JSON — ele não faz parte da aplicação React, é executado manualmente via terminal.

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

## 2.2 Persistência

Todas as alterações deverão ser persistidas imediatamente no arquivo JSON.

Não deverá existir botão **Salvar**.

O sistema não utilizará `localStorage` como mecanismo principal de armazenamento.

## 2.3 Sincronização

**Nesta fase (local, sem hospedagem), a sincronização é disparada manualmente pelo terminal**, executando um script Node (ex.: `node src/scripts/sync.ts caminho/para/planilha.csv`). Esse script lê a planilha informada e sincroniza os dados com o JSON correspondente.

> Esse é um dos três modelos possíveis de disparo de sincronização (comando manual / watcher automático / botão de importação na UI). Optamos pelo comando manual por ser o mais simples de implementar agora, e por ser adequado a um ambiente 100% local, sem múltiplos usuários e sem necessidade de backend. Quando o projeto migrar para hospedagem (seção 9), esse mecanismo será substituído por importação via interface, com backend próprio.

### Identificação de registros

**Os registros deverão ser identificados pelo campo `id`, que representa a ordem original do registro na planilha.** É esse campo — e não o e-mail ou o nome — que determina se uma linha da planilha corresponde a um registro já existente no JSON durante a sincronização.

Durante a sincronização:

- novos registros (cujo `id` não existe no JSON) deverão ser adicionados;
- registros existentes (cujo `id` já existe no JSON) deverão ser atualizados apenas nas informações provenientes da planilha (nome, e-mail);
- alterações manuais deverão ser preservadas;
- registros com `status_alterado = false` deverão ser reavaliados automaticamente;
- registros com `status_alterado = true` deverão manter seu status atual.

### Fluxo de sincronização

```text
Rodar script (node .../sync.ts planilha.csv)
        ↓
Identificar colunas
        ↓
Sincronizar com JSON (por id)
        ↓
Atualizar registros
        ↓
Validar e-mails (regex)
        ↓
Identificar duplicados
        ↓
Aplicar prioridades
        ↓
Gravar JSON atualizado
        ↓
Interface React lê o JSON e renderiza
```

---

## 3. Importação

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

## Estrutura do JSON

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

### Campos

- **id:** ordem original do registro na planilha;
- **nome:** nome do usuário;
- **email:** endereço de e-mail;
- **status:** situação atual do registro;
- **status_alterado:** indica que o status foi definido manualmente;
- **last_updated:** data e hora da última alteração persistida.

Sempre que qualquer alteração persistente ocorrer, `last_updated` deverá ser atualizado.

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

## 5.3 status_alterado

Sempre que o usuário alterar manualmente um status, o sistema deverá definir:

`status_alterado = true`

Enquanto esse atributo for verdadeiro, o status não poderá ser recalculado automaticamente durante sincronizações.

## 5.4 Duplicados

Um registro será considerado duplicado quando existir mais de um registro com o mesmo endereço de e-mail, independentemente do nome.

Ao filtrar por duplicados, todos os registros pertencentes ao grupo duplicado deverão ser exibidos.

## 5.5 Contadores

O sistema deverá exibir:

- total de registros;
- válidos;
- inválidos;
- duplicados;
- deletados;
- enviados.

Todos os contadores deverão respeitar o status efetivo do registro.

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

# 8. Etapas de Implementação (Fase Atual — Local)

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

# 9. Planos Futuros (Visão de Longo Prazo)

A fase descrita na seção 8 resolve a necessidade imediata: ler as planilhas atuais e organizar o envio, rodando localmente. Uma vez que essa base estiver funcionando, o projeto evoluirá para um sistema real, multiusuário/multiplanilha, hospedado — inspirado na estrutura observada no projeto `multiverso.riopombavalley`, adaptada para as necessidades deste sistema. Essa visão inclui:

## 9.1 Página inicial com cards

Uma página `index` substituirá a leitura direta de um único JSON. Ela exibirá **um card para cada planilha** já importada no sistema, permitindo múltiplas planilhas gerenciadas simultaneamente (hoje seriam 2, no futuro qualquer quantidade).

## 9.2 Componente único e reutilizável de renderização

`emails.tsx` deixará de apontar para um JSON fixo e passará a ser um **modelo reutilizável**: um único componente capaz de renderizar qualquer planilha importada, recebendo como parâmetro qual conjunto de dados carregar — da mesma forma que o `CourseLesson.tsx` do projeto de referência é reaproveitado para todos os cursos.

## 9.3 Importação via interface (sem terminal)

O botão "Importar" abrirá o seletor de arquivos do sistema operacional, permitirá escolher a planilha e definir um nome (que deverá ser único entre as planilhas já existentes). Isso substituirá o comando manual `node .../sync.ts` usado na fase atual — a sincronização passa a ser disparada pelo próprio usuário, pela interface.

## 9.4 Rotas dinâmicas e slug

Cada planilha importada gerará uma URL própria, derivada do nome escolhido (`toSlug`, como no projeto de referência). Diferente do projeto de referência, porém, essa geração **não poderá ocorrer em tempo de build** (via `import.meta.glob`), pois o sistema hospedado precisa aceitar novas planilhas em tempo real, sem exigir rebuild/redeploy a cada importação. Isso exige rotas verdadeiramente dinâmicas (ex.: `/emails/:slug`), resolvidas em tempo de execução.

## 9.5 Backend e persistência

Diferente do projeto de referência (que é 100% estático, sem backend), este sistema precisará de:
- um backend que receba o upload da planilha, execute a sincronização e persista os dados;
- uma camada de persistência compatível com hospedagem (banco de dados como SQLite/Postgres, ou armazenamento de arquivos em um serviço com filesystem persistente — já que ambientes serverless têm filesystem efêmero);
- endpoints para: listar planilhas (para gerar os cards do `index`), importar nova planilha, e servir/atualizar os dados de uma planilha específica.

## 9.6 Hospedagem

O sistema será hospedado (ex.: VPS, Render, Railway, ou similar com filesystem/persistência adequada — evitando plataformas puramente serverless caso a persistência continue baseada em arquivos). A escolha final de hospedagem dependerá da decisão entre arquivo JSON persistente vs. banco de dados.

## 9.7 Resumo da transição

| Aspecto | Fase atual (local) | Fase futura (hospedada) |
|---|---|---|
| Disparo da sincronização | comando manual no terminal | botão "Importar" na interface |
| Quantidade de planilhas | 2, fixas | N, dinâmicas |
| Rotas | única página fixa | rotas dinâmicas por slug |
| Geração de página | nenhuma (página única) | criada em tempo real, sem rebuild |
| Persistência | arquivo JSON local | banco de dados ou storage persistente |
| Backend | não existe | necessário |
