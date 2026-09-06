# Malote

## Visão geral

O **Malote** é uma aplicação local, single-user, para organizar, importar e gerenciar múltiplas listas de e-mails a partir de planilhas (CSV/XLSX). Cada lista é um **projeto** independente, com sua própria rota, seus próprios dados e seu próprio histórico. A aplicação permite:

- importar uma planilha diretamente pela interface, via assistente de importação;
- consultar, buscar, filtrar, ordenar e paginar os registros de cada projeto;
- editar registros individualmente ou em massa (status, campos, conteúdo do e-mail);
- identificar duplicados e restaurar registros deletados (lixeira, por projeto);
- personalizar o visual da interface por tema;
- acompanhar um log de alterações de todo o sistema, por projeto ou geral;
- atualizar um projeto existente a partir de uma nova versão da planilha, com resolução de conflitos.

A especificação original do sistema está em [DEVME.md](DEVME.md); as demandas de evolução — concluídas, em andamento e planejadas — estão registradas e detalhadas em [DEMANDAS.md](DEMANDAS.md), com planners individuais mais aprofundados em [public/](public).

> ⚠️ Tanto `DEVME.md` quanto parte do histórico de commits descrevem uma versão inicial do projeto (um único `data/emails.json`, sem múltiplos projetos, sem importação pela interface). Essa versão foi superada pela arquitetura atual descrita abaixo — `DEMANDAS.md` é a fonte mais confiável do estado presente do sistema.

---

## Tecnologias utilizadas

- React 19 + TypeScript
- Vite (também hospeda a API local — ver seção **Arquitetura**)
- React Router (uma rota por projeto, gerada dinamicamente)
- TipTap (editor de texto rico do conteúdo dos e-mails)
- SheetJS (`xlsx`) e leitura própria para CSV/XLSX
- `ts-node` para os scripts de terminal (sincronização e migração)

---

## Arquitetura

**Não há um backend separado.** Toda a "API" do sistema (`/api/projetos`, `/api/emails`, `/api/lixeira`, `/api/logs`) é implementada dentro de [vite.config.ts](vite.config.ts), registrada via o hook `configureServer` do Vite — ou seja, roda **apenas quando o servidor de desenvolvimento (`npm run dev`) está ativo**.

Isso tem uma consequência importante: `npm run build` gera um `dist/` puramente estático (front-end), **sem nenhum backend funcional** — as chamadas a `/api/*` não têm quem as responda fora do `vite dev`. Na prática, hoje o Malote só funciona rodando `npm run dev` continuamente; `npm run build`/`npm run preview` não produzem uma versão utilizável de forma independente.

### Fluxo de dados

```text
Planilha (.csv/.xlsx)
   ↓
Assistente de importação (interface) — ou script de terminal (npm run sync)
   ↓
data/active/<slug-do-projeto>/emails.json
   ↓
API local (vite.config.ts, via configureServer)
   ↓
Interface React (uma rota por projeto)
```

Cada ação de criação, exclusão, restauração, edição ou envio gera também uma linha em `data/logs/<AAAA-MM>.jsonl`, consultável pela tela `/logs`.

---

## Como executar o projeto

### 1. Pré-requisitos

- Node.js
- npm

### 2. Instalar dependências

```bash
npm install
```

### 3. Rodar a aplicação

```bash
npm run dev
```

A aplicação (interface **e** API) fica disponível em `http://localhost:5173/`. Este comando precisa continuar rodando enquanto o sistema estiver em uso — ver a ressalva na seção **Arquitetura** sobre `npm run build`.

### Outros scripts disponíveis

| Script | Uso |
|---|---|
| `npm run build` | `tsc -b` + `vite build` — checagem de tipos e build estático do front-end (sem API funcional, ver **Arquitetura**) |
| `npm run lint` | ESLint sobre todo o projeto |
| `npm run preview` | Serve o `dist/` gerado pelo build (sujeito à mesma limitação de API) |
| `npm run sync -- <planilha> --slug=<slug>` | Importa/sincroniza uma planilha por terminal, fora da interface (ver abaixo) |
| `npm run migrar-backup-dados` | Script de migração de dados (`src/scripts/migrarBackupDados.ts`) |

---

## Projetos: importação e organização

Um "projeto" é uma lista de e-mails independente, identificada por um **slug** (nome da pasta em `data/active/<slug>/`), definido uma única vez no momento da importação.

### Importar pela interface (fluxo normal)

Na tela inicial, o assistente de importação (`ImportWizardModal`, em `src/components/import/`) guia o processo em etapas: escolher a planilha, mapear as colunas (nome, e-mail e, opcionalmente, uma coluna de ID personalizado — ver `EtapaMapeamento.tsx`/`ColunaSeletora.tsx`), revisar e confirmar. O projeto criado passa a ter sua própria rota (`/<slug>`) automaticamente, sem precisar registrar nada manualmente em código — a descoberta de projetos é dinâmica, via `src/data/projetos.ts`.

### Importar por terminal (alternativa)

```bash
npm run sync -- data/sua-planilha.csv --slug=nome-do-projeto
```

Esse comando:

- lê a planilha (`src/scripts/sync.ts`, `src/scripts/utils/readSheet.ts`);
- identifica colunas de nome, e-mail e ID;
- cria ou atualiza `data/active/nome-do-projeto/emails.json`;
- recalcula os status básicos (válido/inválido/duplicado).

### Atualizar um projeto existente

Um projeto já criado pode ser atualizado a partir de uma nova versão da planilha diretamente pela interface (`AtualizarDadosModal.tsx`/`AtualizarRegistrosModal.tsx`), com uma tela de resolução de conflitos campo a campo (`MergeCampoConflito.tsx`) quando um mesmo registro mudou tanto na planilha nova quanto na base atual, e uma seção para registros que desapareceram da planilha nova (`RegistrosSumidosSection.tsx`).

### Lixeira

Projetos e registros individuais deletados vão para `data/trash/`, com timestamp no nome da pasta, e podem ser restaurados pela lixeira lateral (`LixeiraSidebar.tsx`) — inclusive com resolução de conflito quando o slug já foi reutilizado por outro projeto (`ConflitoRestauracaoModal.tsx`, `ConflitoExclusaoModal.tsx`).

---

## Regras de negócio atuais

- **Status possíveis** (`TStatus`, em `src/types/email.ts`): `válido`, `inválido`, `duplicado`, `deletado`, `enviado`.
- Duplicidade é calculada por endereço de e-mail normalizado; **um registro só pode ter um único status por vez**, o que inclui uma inconsistência de modelagem conhecida — ver a ressalva abaixo.
- Validação sintática de e-mail por regex.
- Edição individual de registro com backup automático dos campos anteriores, permitindo desfazer (`restaurarCampos.ts`).
- Persistência imediata em `data/active/<slug>/emails.json` a cada alteração, via API local.
- Todo evento relevante (criar/editar/deletar/restaurar projeto ou registro, confirmar envio, etc.) é registrado em `data/logs/<AAAA-MM>.jsonl`, com uma taxonomia fixa de tipos de ação — consultável na tela `/logs`, com exportação (`ExportarLogsModal.tsx`).
- Temas visuais da interface são selecionáveis e persistidos (`ThemeContext.tsx`, `ThemeSelectorModal.tsx`, `utils/temas.ts`).

> ⚠️ **Inconsistência conhecida:** por `status` ser um único campo, um registro não pode ser simultaneamente "duplicado" e "válido"/"inválido" — em certas sequências de deletar/restaurar/editar manualmente, dois registros com o mesmo e-mail podem ficar em estados divergentes e sem vínculo visual entre si. A correção já está mapeada na **Demanda 10** (`public/RefatoracaoSistemadeDuplicatas.md` e `DEMANDAS.md`), ainda não implementada.

---

## Limitações atuais

- **Sem backend real fora do modo de desenvolvimento** — ver seção **Arquitetura**. O sistema depende de `npm run dev` estar rodando.
- **Sem testes automatizados** — não há Jest/Vitest nem arquivos `*.test.*`/`*.spec.*` no projeto; toda validação até hoje é manual.
- **Sem banco de dados** — persistência em arquivos JSON locais por projeto, sem serviço remoto.
- A sincronização por terminal depende da estrutura de colunas da planilha; planilhas com nomes de coluna muito diferentes podem exigir ajuste no código de identificação de colunas.
- `npm audit` reporta vulnerabilidades nas dependências, incluindo problemas conhecidos e sem correção disponível no pacote `xlsx` (prototype pollution / ReDoS) — relevante por o sistema fazer parsing de planilhas externas.
- Inconsistência de modelagem do status "duplicado" — ver seção anterior.

---

## Estrutura do projeto

### Pastas principais

- [data/active](data/active): dados de cada projeto ativo (`<slug>/emails.json`, planilha original).
- [data/trash](data/trash): projetos e registros deletados, recuperáveis pela lixeira.
- [data/logs](data/logs): logs de alteração do sistema, um arquivo `.jsonl` por mês.
- [public](public): documentação de referência e planners de cada demanda de evolução.
- [src](src): código-fonte da aplicação.

### Arquivos principais

#### Raiz

- [package.json](package.json): scripts e dependências.
- [vite.config.ts](vite.config.ts): configuração do Vite **e** toda a API local (projetos, e-mails, lixeira, logs) — ver **Arquitetura**.
- [DEMANDAS.md](DEMANDAS.md): registro vivo de todas as demandas de evolução do sistema, seu status e detalhamento.
- [DEVME.md](DEVME.md): especificação original do sistema (parcialmente desatualizada — ver aviso no topo deste README).

#### Pasta [src](src)

- [src/App.tsx](src/App.tsx): rotas da aplicação — uma por projeto, geradas dinamicamente a partir de `src/data/projetos.ts`, mais `/` (Home) e `/logs`.
- [src/data/projetos.ts](src/data/projetos.ts): descoberta dinâmica de todos os projetos existentes em `data/active/*/emails.json`.
- [src/pages](src/pages): `home.tsx` (lista de projetos), `emails.tsx` (página principal de um projeto), `logs.tsx` (tela de logs), `notFound.tsx`.
- [src/components](src/components): componentes de interface — tabela (`EmailTable.tsx`), toolbar (`EmailToolbar.tsx`), contadores (`EmailCounters.tsx`), paginação (`Paginacao.tsx`), editor de e-mail rico (`EmailEditorRico.tsx` + `editor/`), lixeira (`LixeiraSidebar.tsx`), temas (`ThemeSelectorModal.tsx`), modais de conflito e duplicados, entre outros.
- [src/components/import](src/components/import): assistente de importação de planilha (`ImportWizardModal.tsx` e etapas).
- [src/components/atualizar](src/components/atualizar): atualização de um projeto existente a partir de nova planilha.
- [src/components/utils](src/components/utils): funções de busca, filtro, ordenação, exportação, slugify, temas.
- [src/contexts/ThemeContext.tsx](src/contexts/ThemeContext.tsx): contexto de tema visual.
- [src/services](src/services): camada de chamadas à API local.
- [src/scripts/sync.ts](src/scripts/sync.ts): script de sincronização via terminal.
- [src/scripts/utils](src/scripts/utils): leitura de planilha, identificação de colunas, validação de e-mail, cálculo de merge de conflitos.
- [src/types/email.ts](src/types/email.ts): tipos e status usados no sistema.

---

## Melhorias e planos futuros

O roteiro completo, com esforço estimado e ordem recomendada de execução, está em [DEMANDAS.md](DEMANDAS.md). Em linhas gerais, o que ainda está por vir:

- corrigir a inconsistência de modelagem do status "duplicado" (Demanda 10);
- variáveis/merge tags no texto dos e-mails (Demanda 2);
- armazenamento duplo, banco + local (Demanda 6);
- envio automático dos e-mails (Demanda 1).

---

## Resumo rápido

```bash
npm install
npm run dev
```

Para importar uma nova planilha por terminal, em vez de pela interface:

```bash
npm run sync -- data/nova-planilha.csv --slug=nome-do-projeto
```
