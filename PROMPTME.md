 **AVISO:** Este arquivo não é para humanos. Ele é contexto denso para ser colado em uma conversa com uma IA (ChatGPT, Claude, Gemini, Cursor, Copilot etc.) para que ela entenda **todo o projeto** sem precisar ler o repositório inteiro. Se você é uma IA lendo isto: trate este documento como a fonte de verdade sobre arquitetura, convenções e regras de negócio. Se o código divergir deste arquivo, avise o usuário da divergência em vez de assumir silenciosamente qual dos dois está certo.

---

# 1. Visão Geral do Projeto

**Nome:** Sistema de Organização e Envio de E-mails (`sistema-emails`).

**Objetivo:** aplicação web **local** (roda no computador do usuário, sem hospedagem) que importa uma planilha (`.csv`/`.xlsx`) de contatos, sincroniza esses dados com um arquivo JSON, e oferece uma interface React para consultar, buscar, filtrar, ordenar, selecionar, alterar status e excluir/restaurar registros de e-mail antes de um envio em massa feito por fora do sistema.

**Problema que resolve:** listas de contatos exportadas de formulários/sistemas de relatórios de treinamento chegam bagunçadas, com possíveis duplicatas, e-mails inválidos e necessidade de rastrear quais contatos já receberam e-mail. Fazer isso manualmente em planilha é lento e propenso a erro. O sistema centraliza essa curadoria em uma interface dedicada.

**O sistema NÃO envia e-mails.** Ele apenas prepara/organiza os destinatários (ex.: para copiar e colar em outra ferramenta de disparo).

**Público-alvo:** uma única pessoa/operador rodando o projeto localmente (não é multiusuário, não tem login, não tem hospedagem — ver seção 19 "Dívidas Técnicas").

**Principais funcionalidades:**
- Sincronização de planilha → JSON via script de terminal (`npm run sync`).
- Tabela com busca (nome+e-mail), filtros multi-seleção por status, ordenação em cascata por múltiplos critérios, paginação.
- Seleção de registros com cópia em massa (nome/e-mail) para a área de transferência.
- Atualização de status individual (select inline) ou em massa (ícone no cabeçalho da coluna Status).
- Exclusão lógica (soft delete) com regra especial para registros "enviados" (modal de conflito).
- Restauração de registros excluídos/alterados manualmente, devolvendo-os ao cálculo automático de status.
- Modal de duplicados (mostra todos os registros com o mesmo e-mail).
- Tema claro/escuro persistido no navegador.
- Página Home (`/`) com "cards" de planilhas — hoje estática/mock, preparando terreno para múltiplas planilhas no futuro.

**Fluxo geral da aplicação:**
```
Planilha (.csv/.xlsx) em data/
   → script src/scripts/sync.ts (rodado manualmente via terminal)
   → data/emails.json (fonte oficial dos dados)
   → interface React lê o JSON no build (import estático)
   → usuário interage (busca/filtra/ordena/seleciona/altera status/exclui/restaura)
   → cada alteração é persistida IMEDIATAMENTE via PUT /api/emails (middleware do Vite)
   → dados regravados em data/emails.json
```
Não existe botão "Salvar" — toda mutação na UI já dispara a persistência.

---

# 2. Stack Tecnológica

| Tecnologia | Papel | Por que existe |
|---|---|---|
| **React 19** | UI declarativa | Framework de interface escolhido pelo autor original, reaproveitando padrões de um projeto de referência (`multiverso.riopombavalley`). |
| **TypeScript** | Tipagem estática | Evita erros de forma de dados (registro de e-mail, status) espalhados por muitos componentes. |
| **Vite** | Bundler + dev server | Build rápido; também hospeda um middleware customizado (`emailsApiPlugin`) que funciona como um mini-backend local só em `npm run dev`. |
| **react-router-dom** | Rotas | Navegação entre Home (`/`) e a tela de e-mails (`/emails`). |
| **Node.js + ts-node** | Execução do script de sincronização | O script (`src/scripts/sync.ts`) roda **fora** do bundle do Vite, direto no terminal, porque manipula arquivos do sistema (fs) — algo que não faz sentido rodar no navegador. |
| **csv-parse** | Parse de CSV | Usado só pelo script de sincronização (Node), não pelo React. |
| **xlsx (SheetJS)** | Leitura de `.xlsx`/`.xls` | Mesma observação acima — só no script de sincronização. |
| **react-icons (Feather/Fi)** | Ícones | Todos centralizados em `src/components/Icons.tsx`. |
| **ESLint + typescript-eslint** | Lint | Configurado em `eslint.config.js`. |

**Gerenciamento de estado:** não há Redux/Zustand/Context genérico de dados. O estado da tela de e-mails vive inteiramente em `useState`/`useMemo` dentro de `src/pages/emails.tsx` (component-local state, "levantado" só até onde é necessário). O único Context global é `ThemeContext` (tema claro/escuro), porque é algo realmente transversal a toda a aplicação.

**Gerenciamento de rotas:** `react-router-dom` com `<Routes>`/`<Route>` declaradas em `src/App.tsx`. Duas rotas reais (`/` e `/emails`) mais uma coringa `*` que cai na Home.

**Armazenamento:**
- **Fonte de dados**: arquivo `data/emails.json` (array de objetos `EmailRecord`), lido como import estático do TypeScript (`import emailsJson from '../../data/emails.json'`) — ou seja, o JSON é "compilado" no bundle a cada `npm run dev`/`npm run build`. Isso significa que alterações feitas fora do fluxo do Vite (ex.: rodando `sync.ts` com o servidor de dev já aberto) exigem reload da página para refletir na UI, já que o import é estático.
- **Persistência de alterações da UI**: via `fetch('/api/emails', { method: 'PUT' })`, atendido pelo middleware Vite que sobrescreve `data/emails.json` inteiro a cada chamada.
- **Preferência de tema**: `localStorage` (chave `'tema-preferido'`).
- **Não há banco de dados.** Não há backend real fora do dev server do Vite.

**Build/Preview/Lint:**
- `npm run dev` → Vite dev server + API local.
- `npm run build` → `tsc -b && vite build` (typecheck + bundle), saída em `dist/`.
- `npm run preview` → serve o build de `dist/` (sem a API `/api/emails` — build de produção não tem persistência).
- `npm run lint` → ESLint.
- `npm run sync` → roda o script de sincronização (ver seção 5).

---

# 3. Estrutura das Pastas

```
sistema-emails/
├── data/                → entrada/saída de dados (planilhas + JSON oficial)
├── public/              → documentação do projeto (não é "public" de assets estáticos comuns)
├── src/
│   ├── components/      → componentes de UI reutilizáveis da tela de e-mails
│   │   └── utils/       → funções puras usadas pelos componentes (filtro, busca, ordenação, paginação, clipboard)
│   ├── contexts/        → contexto React global (hoje só ThemeContext)
│   ├── pages/           → componentes de página/rota (Home, Emails)
│   ├── scripts/         → código Node que roda fora do navegador (sincronização)
│   │   └── utils/       → funções puras usadas só pelo script de sincronização
│   ├── services/        → chamadas HTTP para a API local do Vite
│   └── types/           → tipos TypeScript centrais do domínio
├── dist/                → build de produção gerado por `npm run build` (NÃO editar manualmente)
```

### `data/`
**Responsabilidade:** guardar as planilhas de origem e o JSON oficial (`emails.json`).
**Quando criar arquivo aqui:** ao adicionar uma nova planilha para importar, ou ao gerar um JSON de saída alternativo via `--out=`.
**Quando NÃO criar aqui:** não é lugar para código — apenas dados.

### `public/`
**Responsabilidade:** documentação de referência (`Especificacao_Sistema_Emails_v3.md`, `etapas.txt`). **Atenção:** neste projeto, `public/` não guarda assets estáticos típicos de app (imagens, favicon) — guarda documentos Markdown/txt que acompanham o build.
**Quando criar arquivo aqui:** ao registrar uma nova especificação, decisão de design ou checklist de etapa de implementação.

### `src/components/`
**Responsabilidade:** componentes de apresentação reutilizados pela tela de e-mails (tabela, toolbar, modais, contadores, paginação, ícones, toggle de tema).
**Quando criar componente aqui:** quando uma peça de UI tem responsabilidade própria e é usada (ou pode vir a ser usada) em mais de um lugar, ou quando teria mais de ~100 linhas se ficasse dentro de `emails.tsx`.
**Quando NÃO criar aqui:** lógica de página inteira (isso vai em `pages/`); funções sem JSX (isso vai em `components/utils/` ou `types/`).

### `src/components/utils/`
**Responsabilidade:** funções **puras** (sem JSX, sem estado, sem efeitos) que processam dados de `EmailRecord[]`: filtro, busca, ordenação, contadores, paginação, cópia para clipboard.
**Quando criar arquivo aqui:** nova transformação/derivação de dados usada pela UI, que não depende de `useState`/`useEffect`.
**Quando NÃO criar aqui:** lógica que só faz sentido no Node (isso vai em `scripts/utils/`), mesmo que pareça duplicar responsabilidade — ver observação sobre `EmailStatus.ts` abaixo.

### `src/contexts/`
**Responsabilidade:** estado verdadeiramente global compartilhado por toda a árvore de componentes.
**Quando criar contexto aqui:** somente quando o estado precisa ser acessado por componentes muito distantes na árvore E mudar de contexto local para prop-drilling seria impraticável (hoje, só o tema se qualifica). **Não crie um Context para o estado da tabela de e-mails** — ele já é local a `emails.tsx` de propósito.

### `src/pages/`
**Responsabilidade:** um componente por rota. Cada página monta os componentes de `components/`, mantém o estado de tela e conecta eventos às funções de negócio.
**Quando criar página aqui:** ao adicionar uma nova rota em `App.tsx`.

### `src/scripts/`
**Responsabilidade:** código que roda em Node via terminal (`ts-node`), fora do bundle do Vite/navegador. Hoje contém só `sync.ts`.
**Quando criar arquivo aqui:** para uma nova operação de linha de comando sobre os dados (ex.: um script de exportação, backup, migração).
**Quando NÃO criar aqui:** qualquer coisa que precise rodar no navegador — isso é `src/components`, `src/pages` ou `src/services`.

### `src/scripts/utils/`
**Responsabilidade:** funções puras usadas exclusivamente pelo script de sincronização (leitura de planilha, identificação de colunas, validação de e-mail no contexto Node).
**Observação importante de duplicação intencional:** existe uma **duplicação parcial e proposital** entre `src/scripts/utils/validateEmail.ts` (Node) e `src/components/EmailStatus.ts` (browser) — ambos implementam `isValidEmail`/`normalizeEmail` com a mesma regex. Isso existe porque o script de sincronização não pode importar código pensado para o browser (e vice-versa, por causa de como o `tsconfig.scripts.json` e o bundle do Vite são configurados separadamente). **Se a regra de validação mudar, ela precisa ser atualizada nos dois lugares.** Isso é uma dívida técnica conhecida (ver seção 19).

### `src/services/`
**Responsabilidade:** chamadas HTTP entre o React e a API local do Vite. Hoje só `emailsApi.ts` (persistência de `emails.json`).
**Quando criar arquivo aqui:** nova rota de API adicionada ao middleware do `vite.config.ts` que precise ser chamada pela UI.

### `src/types/`
**Responsabilidade:** modelo de dados central do domínio (`EmailRecord`, `TStatus`, `TStatusManual`, `EmailCounters`, `TFiltro`) e as constantes de prioridade/ordem associadas.
**Quando modificar:** ao adicionar um novo status, um novo campo ao registro, ou um novo tipo de filtro — **mudanças aqui tendem a se propagar para muitos arquivos** (ver seção 17, "Arquivos Críticos").

### `dist/`
Gerado automaticamente. Nunca editar manualmente — qualquer alteração é sobrescrita no próximo `npm run build`.

---

# 4. Estrutura dos Arquivos (arquivo a arquivo)

## Raiz

- **`package.json`** — dependências e scripts (`dev`, `build`, `lint`, `preview`, `sync`). Modificar ao adicionar dependência ou novo script de terminal.
- **`vite.config.ts`** — configuração do Vite **e** definição do middleware `emailsApiPlugin`, que implementa a rota `PUT /api/emails` (grava `data/emails.json` inteiro a cada chamada). Quem usa: `src/services/emailsApi.ts` (cliente HTTP) e, indiretamente, toda a UI que persiste dados. **Alto risco:** se este arquivo quebrar, a aplicação para de salvar qualquer alteração feita na tela (mas continua funcionando "visualmente" até o reload, já que o estado em memória é otimista).
- **`tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json`** — configuração TS da aplicação React/Vite.
- **`tsconfig.scripts.json`** — configuração TS **separada**, usada apenas pelo script de sincronização (`include: ["src/scripts", "src/types"]`). Por isso `sync.ts` só pode depender de `src/types` e de módulos dentro de `src/scripts` — não pode importar nada de `src/components`.
- **`eslint.config.js`** — regras de lint.
- **`index.html`** — HTML raiz do Vite.

## `data/`

- **`data/emails.json`** — **fonte oficial dos dados.** Array de `EmailRecord`. Lido como import estático por `src/pages/emails.tsx`. Regravado por (a) `sync.ts` e (b) o middleware `/api/emails`. **Nunca editar manualmente com o servidor de dev aberto sem depois recarregar a página** — o React não vai perceber a mudança sozinho (import estático, não é fetch).
- **`data/ibm.csv`** — exemplo real de planilha de origem (exportação de sistema de treinamentos, colunas como `Aluno – Nome`, `Aluno – E-mail`).

## `public/`

- **`public/Especificacao_Sistema_Emails_v3.md`** — especificação funcional completa (arquitetura, regras de negócio detalhadas por seção numerada, roadmap de longo prazo na seção 9). **Este é o documento de maior autoridade sobre o "porquê" das regras de negócio.** Sempre que uma regra de negócio parecer ambígua no código, checar este arquivo antes de assumir comportamento.
- **`public/etapas.txt`** — anotações da implementação mais recente (a página Home). Funciona como changelog/checklist da última funcionalidade em andamento.

## `src/` — raiz

- **`src/main.tsx`** — bootstrap do React: `createRoot` + `ThemeProvider` + `BrowserRouter` + `<App />`. Modificar apenas para adicionar providers globais novos.
- **`src/App.tsx`** — declaração de rotas: `/` → `Home`, `/emails` → `Emails`, `*` → `Home`. Modificar ao adicionar nova página.
- **`src/index.css`** — todo o CSS da aplicação (variáveis de cor `--color-*`, `--radius-*`, `--shadow-*`, `--transition-*`, temas claro/escuro via `[data-theme]`, responsividade em `@media (max-width: 720px)`). Convenção: toda nova funcionalidade visual ganha uma seção própria neste arquivo, comentada com o nome da funcionalidade (ex.: "/* Home / Dashboard de planilhas */").

## `src/pages/`

- **`src/pages/home.tsx`** — página `/`. Renderiza cabeçalho + `ThemeToggle`, botão "Importar planilha" (**onClick vazio/no-op — placeholder visual**, não implementado ainda) e uma grade de `PlanilhaCard`. Hoje `planilhas` é um array estático com um único item apontando para `/emails`. **Isto é temporário por design**: será substituído por dados reais quando o sistema suportar múltiplas planilhas (seção 9 da especificação). Quem depende: nada além de `App.tsx` (rota `/`).
- **`src/pages/emails.tsx`** — página `/emails`, o **componente mais importante do projeto**. Contém: estado de registros (`registros`), busca (`termoBusca`), filtros (`statusFiltrados`), ordenação (`ordenacao`), seleção (`selecionados`), quantidade por página (`quantidade`), página atual (`paginaAtual`), estado de modais (`grupoDuplicadoAberto`, `conflitoExclusao`) e erro de salvamento (`erroSalvamento`). Orquestra todo o pipeline: filtro → busca → ordenação → paginação (via `processarRegistros` + `calcularPaginacao`), e todos os handlers de mutação (`handleAtualizarStatus`, `handleAtualizarStatusIndividual`, `deletarRegistros`, `handleDeletarClick`, `handleRestaurar`). Toda mutação passa por `persistirRegistros`, que faz **atualização otimista** (atualiza o estado local imediatamente) e reverte se `salvarEmails` falhar. **Qualquer nova regra de negócio sobre o ciclo de vida de um registro provavelmente precisa tocar este arquivo.**

## `src/components/`

- **`EmailCounters.tsx`** — cartões de contagem por status. Props: `{ contadores: EmailCounters }`. Sem estado próprio. Depende de `CONTADOR_LABELS` (`utils/emailData.ts`).
- **`EmailToolbar.tsx`** — busca (com debounce de 250ms via `useState` local + `useEffect`), botões de filtro (switches independentes), `OrdenacaoPrioridade` e `QuantidadeInput`. Props recebem tanto o valor atual quanto o callback de mudança de cada controle (padrão "controlled component" espelhado no pai). Estado local: apenas o texto de busca "não confirmado" (antes do debounce).
- **`EmailTable.tsx`** — a tabela principal. Responsabilidades: renderizar linhas, checkbox de seleção (com `selecionavel()` desabilitando o "grupo oposto" — não pode misturar deletados e não-deletados), badges/selects de status (`renderStatus`, com três variações: duplicado=badge clicável, deletado=badge não clicável, demais=select inline), botões de copiar nome/e-mail no cabeçalho (com feedback "Copiado!" temporizado), e o ícone de deletar/restaurar no cabeçalho (alterna conforme `todosSelecionadosDeletados`). Estado local: `colunaCopiada` (feedback visual) e `selectMassaAberto` (dropdown de atualização em massa). **Este é o componente com mais regras de UI condicionais do projeto — qualquer alteração aqui deve ser testada contra os três casos de `renderStatus`.**
- **`OrdenacaoPrioridade.tsx`** — dropdown customizado (não é um `<select>` nativo) que mostra o critério de ordenação primário e, ao abrir, permite reordenar a lista completa de critérios por drag-and-drop HTML5 nativo ou pelos botões ▲/▼. Estado local: `aberto`, índices de drag-and-drop, e uma string de anúncio para leitores de tela (`aria-live`).
- **`Paginacao.tsx`** — navegação entre páginas (anterior/primeira/campo de página atual editável/última/próxima). Estado local: texto do input de página (para permitir digitação antes de confirmar com Enter ou blur).
- **`QuantidadeInput.tsx`** — campo numérico customizado (não usa `<input type="number">` de propósito, para ter controle total do estilo das setas) com incrementar/decrementar, long-press para repetição, e atalhos para ir direto ao mínimo/máximo. Estado local: `texto` (buffer de digitação).
- **`ConflitoExclusaoModal.tsx`** — modal exibido quando uma seleção a excluir contém registros "enviado". Duas seções: "Enviados" (somente leitura) e "A Deletar" (com checkboxes, todos pré-selecionados, e "Selecionar Todos"). Props: `enviados`, `aDeletar`, `onCancelar`, `onConfirmar(idsParaDeletar: Set<number>)`.
- **`DuplicadosModal.tsx`** — modal somente leitura mostrando todos os registros que compartilham um e-mail (inclusive os que já foram alterados manualmente para outro status — mostra o grupo completo para dar contexto). Props: `registros`, `onFechar`.
- **`ThemeToggle.tsx`** — botão `role="switch"` que alterna tema via `useTheme()`. Autocontido, sem props obrigatórias (só `className` opcional).
- **`Icons.tsx`** — reexporta ícones de `react-icons/fi` com nomes em português e tamanhos fixos por uso (`IconeCopiar`, `IconeLixeira`, `IconeEditarStatus`, `IconeRestaurar`, `IconeFechar`, `IconeTemaClaro`, `IconeTemaEscuro`, `IconePaginaAnterior`, `IconePaginaProxima`, `IconeBuscarPagina`, `IconeImportar`, `IconePlanilha`). **Convenção obrigatória:** todo ícone novo usado na UI deve ser adicionado aqui, nunca importado diretamente de `react-icons` dentro de um componente.
- **`EmailStatus.ts`** — (não é `.tsx`, é lógica pura) validação de e-mail (`isValidEmail`, regex simples) e recálculo automático de status (`recalcularStatusAutomatico`). Compartilhado entre a ação "Restaurar" (`emails.tsx`) e — **conceitualmente** — o script de sincronização, embora o script tenha sua própria cópia em `scripts/utils/validateEmail.ts` por causa da separação de bundles (ver observação na seção 3). Este é o arquivo que define a regra de prioridade `enviado > deletado > duplicado > válido/inválido` do lado do browser.

## `src/components/utils/`

- **`emailData.ts`** — funções puras de leitura/derivação: `calcularContadores`, `filtrarPorStatusMultiplo`, `buscar` (nome+e-mail, case-insensitive), `compararPorCriterio`/`ordenar` (ordenação em cascata por hierarquia de critérios), e `processarRegistros` (pipeline completo: filtro → busca → ordenação). Também define constantes: `FILTROS`, `TODOS_OS_STATUS`, `STATUS_ORDEM_EXIBICAO`, `CONTADOR_LABELS`, `ORDENACAO_PADRAO`, `CRITERIO_ORDENACAO_LABELS`. **Nenhuma função aqui muta o array recebido.**
- **`paginacao.ts`** — `calcularPaginacao(totalRegistros, registrosPorPagina, paginaAtualInformada)`: calcula `totalPaginas`, corrige `paginaAtual` para os limites válidos, e retorna o intervalo `{ inicio, fim }` de índices a exibir.
- **`clipboard.ts`** — `copiarTexto(valores: string[])`: junta os valores com `;` e copia via Clipboard API, com fallback para `document.execCommand('copy')` em contextos sem suporte.

## `src/contexts/`

- **`ThemeContext.tsx`** — `ThemeProvider` (monta estado do tema, sincroniza `data-theme` no `<html>` e `localStorage`) + hook `useTheme()` (lança erro se usado fora do provider). Preferência inicial: `localStorage` → `prefers-color-scheme` do SO → `'light'` como último recurso.

## `src/services/`

- **`emailsApi.ts`** — `salvarEmails(registros: EmailRecord[])`: `PUT /api/emails` com o array completo serializado. Lança erro se a resposta não for `ok`, para que `persistirRegistros` (em `emails.tsx`) possa reverter o estado otimista.

## `src/types/`

- **`email.ts`** — o **contrato de dados central** do projeto:
  - `TStatus = 'válido' | 'inválido' | 'duplicado' | 'deletado' | 'enviado'`
  - `STATUS_PRIORIDADE` — ordem de prioridade para recálculo automático.
  - `TFiltro` — igual a `TStatus` + `'todos'`.
  - `TStatusManual = 'válido' | 'inválido' | 'enviado'` — subconjunto que pode ser setado manualmente pelo usuário (nunca `'duplicado'` nem `'deletado'` diretamente).
  - `STATUS_MANUAIS` — lista ordenada usada nos `<select>`s da UI.
  - `interface EmailRecord { id, nome, email, status, status_alterado, last_updated }`.
  - `interface EmailCounters { total, válido, inválido, duplicado, deletado, enviado }`.

## `src/scripts/`

- **`sync.ts`** — script de terminal, ponto de entrada único para trazer dados de uma planilha para o JSON. Pipeline: `parseArgs` → `readSheet` → `loadExistingJson` → `syncRecords` (casa por `id`, cria/atualiza) → `applyStatusRules` (valida e-mail, detecta duplicado, aplica prioridade, preservando `status_alterado === true`) → `writeJson` (ordenado por `id`). Imprime um resumo no console ao final. Uso: `node --loader ts-node/esm src/scripts/sync.ts <planilha> [--out=caminho.json]`, tipicamente via `npm run sync -- <planilha>`.

## `src/scripts/utils/`

- **`readSheet.ts`** — `readSheet(filePath)`: dispatcha para `readCsv` (com detecção automática de delimitador: vírgula/`;`/tab, comparando contagens na primeira linha) ou `readXlsx` (primeira aba do workbook, `defval: ''` para células vazias não sumirem). Retorna sempre `SheetRow[]` (`Record<string,string>`), independentemente do formato de origem.
- **`identifyColumns.ts`** — `ID_COLUMNS`, `NOME_COLUMNS`, `EMAIL_COLUMNS` são listas **hardcoded** de nomes de coluna aceitos (comparação case-insensitive e com trim). `identifyColumns(headers)` retorna `{ idColumn, nomeColumn, emailColumn }`, lançando erro se nenhuma coluna de e-mail for encontrada (ID e Nome são opcionais). `pickFirstFilled(row, candidates)` pega o primeiro valor não vazio dentre colunas candidatas (útil quando há mais de uma pergunta de e-mail no formulário de origem). **Este é o arquivo a editar quando uma planilha nova tiver cabeçalhos com nomes diferentes dos já suportados.**
- **`validateEmail.ts`** — cópia, para uso em Node, de `isValidEmail`/`normalizeEmail` (mesma regex de `EmailStatus.ts`, ver observação de duplicação intencional na seção 3).

---

# 5. Fluxo da Aplicação (passo a passo detalhado)

```
Planilha (.csv/.xlsx)
   ↓
Leitura (readSheet.ts) — normaliza para SheetRow[] independente do formato
   ↓
Identificação de colunas (identifyColumns.ts) — acha ID/Nome/E-mail nos cabeçalhos
   ↓
Casamento por ID (sync.ts:syncRecords) — funde com o JSON já existente, preservando status manual
   ↓
Validação de e-mail (validateEmail.ts) — regex simples de sintaxe
   ↓
Identificação de duplicados (sync.ts:applyStatusRules) — agrupamento por e-mail normalizado
   ↓
Aplicação de prioridade de status (enviado > deletado > duplicado > válido/inválido)
   ↓
Gravação em data/emails.json (writeJson) — ordenado por id
   ↓
─────────────────────────────────────────────
   ↓ (na próxima vez que a app React for buildada/recarregada)
Import estático do JSON (emails.tsx: import emailsJson from '../../data/emails.json')
   ↓
Estado inicial (useState(registrosIniciais))
   ↓
Pipeline de exibição (processarRegistros): filtro por status → busca → ordenação em cascata
   ↓
Paginação (calcularPaginacao) — corta o resultado processado no intervalo da página atual
   ↓
Renderização (EmailTable + EmailCounters + Paginacao)
   ↓
Interação do usuário: seleção (checkbox), cópia (nome/e-mail), alteração de status, exclusão, restauração
   ↓
Atualização de estado local (otimista, via setRegistros)
   ↓
Persistência (persistirRegistros → salvarEmails → PUT /api/emails → middleware do Vite → sobrescreve data/emails.json)
   ↓
Em caso de falha na persistência: reverte o estado local para o valor anterior e mostra erroSalvamento
```

**Exportação/envio real de e-mails:** fora do escopo do sistema. O "fim" do fluxo dentro da aplicação é: usuário seleciona registros → copia nome/e-mail (`copiarTexto`) → cola em outra ferramenta.

---

# 6. Fluxo de Dados

- **Origem:** planilhas do mundo real (exportadas de um sistema de relatórios de treinamento), colocadas manualmente em `data/`.
- **Transformação:** feita inteiramente pelo script `sync.ts` e seus utilitários (`readSheet`, `identifyColumns`, `validateEmail`). A transformação nunca acontece no navegador.
- **Percurso dentro do sistema:** `data/*.csv|xlsx` → `data/emails.json` → import estático em `emails.tsx` → estado React → de volta para `data/emails.json` via API.
- **Quem altera os dados:**
  - O script `sync.ts` altera nome/e-mail e recalcula status automático (respeitando `status_alterado`).
  - A UI altera status (individual/massa), exclui (soft delete) e restaura, sempre através dos handlers de `emails.tsx`.
- **Quem consome os dados:** exclusivamente a página `emails.tsx` e os componentes que ela renderiza (`EmailCounters`, `EmailToolbar`, `EmailTable`, `Paginacao`, modais). A Home (`home.tsx`) **não** consome `emails.json` — hoje é 100% mock.
- **Onde são armazenados:** um único arquivo `data/emails.json`, sem banco de dados, sem storage remoto.
- **Importante:** como o JSON é importado estaticamente pelo bundler, alterações feitas por fora (rodando `sync.ts` com o dev server já aberto) só aparecem na UI depois de um **reload manual da página** — o Vite pode até fazer HMR do módulo, mas o estado React (`useState(registrosIniciais)`) já foi inicializado e não vai re-ler o import sozinho.

---

# 7. Regras de Negócio

### O que é um "registro"
Um objeto `EmailRecord`: `{ id, nome, email, status, status_alterado, last_updated }`. O `id` representa a ordem original da linha na planilha (ou o valor de uma coluna de ID, se existir e for numérica) e é a chave usada para casar registros entre sincronizações.

### Status possíveis e seus significados
- **`válido`** — e-mail passa na regex de sintaxe e não é duplicado.
- **`inválido`** — e-mail não passa na regex de sintaxe (`algo@algo.algo`).
- **`duplicado`** — existe mais de um registro com o mesmo e-mail normalizado (trim + minúsculas), independentemente do nome. Calculado automaticamente, **nunca** manual.
- **`deletado`** — exclusão lógica (soft delete). Só alcançável pelo botão de exclusão (nunca por select manual de status).
- **`enviado`** — marcado manualmente pelo usuário para indicar que aquele contato já recebeu o e-mail. Uma vez "enviado", **não pode ser excluído diretamente** (ver regra de conflito abaixo).

### Prioridade de status (da maior para a menor)
```
enviado > deletado > duplicado > válido/inválido
```
Só "duplicado" e "válido/inválido" são recalculados automaticamente (pelo script de sync ou pela ação "Restaurar"); "enviado" e "deletado" só existem por ação manual explícita do usuário.

### `status_alterado`
Booleano que trava o recálculo automático. Quando `true`, nem `sync.ts` nem `recalcularStatusAutomatico` tocam no status daquele registro. É setado para `true` sempre que o usuário altera o status manualmente (individual ou em massa) ou exclui um registro. É zerado de volta para `false` pela ação "Restaurar" — depois disso, o registro "volta a ser processado normalmente pelo sistema".

### Regra de seleção
Não é permitido selecionar simultaneamente registros do grupo "deletado" e do grupo "ativo" (todos os demais status). A UI desabilita visualmente os checkboxes do "grupo oposto" enquanto há uma seleção em andamento (`selecionavel()` em `EmailTable`, `grupoDoStatus()` em `emails.tsx`).

### Restrição para "enviados"
Registros "enviado" nunca são excluídos silenciosamente. Se uma seleção a excluir contiver algum "enviado", abre-se o `ConflitoExclusaoModal`, que separa visualmente "Enviados" (não excluíveis, somente leitura) de "A Deletar" (elegíveis, pré-selecionados, editável) — o usuário confirma explicitamente quais elegíveis de fato excluir.

### Atualização de status em massa
Ao aplicar um novo status a uma seleção, registros com status atual `'duplicado'` dentro da seleção **são ignorados** (não mudam) — porque "duplicado" nunca é um destino manual válido, é sempre calculado.

### Contadores
Refletem sempre o status **efetivo atual** de cada registro (não um snapshot da sincronização).

### Validação de e-mail
Apenas sintaxe (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`). Não verifica domínio, DNS ou existência real da caixa postal — decisão explícita da especificação.

### Persistência
Toda mutação na UI é gravada **imediatamente** em `data/emails.json` (sem botão "Salvar"). Em caso de falha de rede/gravação, a UI reverte para o estado anterior e mostra uma mensagem de erro (`erroSalvamento`).

---

# 8. Estrutura dos Estados

Todos vivem em `src/pages/emails.tsx`, como `useState` local (não há estado global de dados):

| Estado | Finalidade | Quem altera | Quem consome | Cuidados |
|---|---|---|---|---|
| `registros` | Array completo de `EmailRecord`, a "verdade" em memória | `persistirRegistros` (via todos os handlers de mutação) | quase toda a árvore de componentes (direta ou indiretamente via `registrosProcessados`) | é a única fonte que deve ser persistida via `salvarEmails` |
| `termoBusca` | Termo de busca confirmado (pós-debounce) | `EmailToolbar` via `onTermoBuscaChange` | `processarRegistros` | debounce vive dentro de `EmailToolbar`, não aqui |
| `statusFiltrados` | `Set<TStatus>` dos status marcados no filtro | `alternarFiltro` | `processarRegistros` | conjunto vazio = nenhum registro exibido (não "todos") |
| `ordenacao` | Hierarquia de critérios (`TOrdenacao`, array ordenado) | `OrdenacaoPrioridade` via `onOrdenacaoChange` | `processarRegistros` | ordem no array = prioridade; primeiro manda |
| `selecionados` | `Set<number>` de IDs selecionados | `alternarSelecao`, `alternarSelecaoTodos`, resetado após mutações (exceto quando `preservarSelecao: true`) | `EmailTable`, contagem exibida, handlers de ação em massa | nunca deve misturar grupo "deletado" com "ativo" |
| `quantidade` | Registros por página | `QuantidadeInput` via `EmailToolbar` | `calcularPaginacao` | reseta `paginaAtual` para 1 ao mudar |
| `paginaAtual` | Página atual da tabela | `Paginacao` | `calcularPaginacao` | corrigido automaticamente para os limites válidos dentro de `calcularPaginacao` |
| `grupoDuplicadoAberto` | Registros do grupo de duplicados aberto no modal (ou `null`) | `handleClicarDuplicado` / fechamento do modal | `DuplicadosModal` | `null` = modal fechado |
| `conflitoExclusao` | `{ enviados, aDeletar } | null` | `handleDeletarClick` / confirmação / cancelamento | `ConflitoExclusaoModal` | `null` = modal fechado |
| `erroSalvamento` | Mensagem de erro de persistência (ou `null`) | `persistirRegistros` | renderização condicional no topo da página | limpo a cada nova tentativa de persistência |

Estados derivados via `useMemo` (não são `useState`, mas são "estado computado" importante): `contadores`, `registrosProcessados`, `paginacao`, `registrosExibidos`, `statusPorId`, `grupoSelecaoAtual`, `todosSelecionadosDeletados`.

Estado global fora de `emails.tsx`: **`tema`**, em `ThemeContext.tsx` (light/dark), consumido por `ThemeToggle` em qualquer página.

---

# 9. Componentes

Ver seção 4 para detalhes arquivo a arquivo. Resumo de dependências diretas:

- `EmailCounters` — recebe `contadores`; sem dependências de outros componentes.
- `EmailToolbar` — usa `OrdenacaoPrioridade` e `QuantidadeInput` internamente.
- `EmailTable` — usa `Icons.tsx` e `clipboard.ts`; é o componente mais "pesado" em regras condicionais.
- `Paginacao` — usa `Icons.tsx` (setas) e o tipo `PaginaInfo` de `utils/paginacao.ts`.
- `ConflitoExclusaoModal` / `DuplicadosModal` — autocontidos, recebem os registros já filtrados pelo pai.
- `ThemeToggle` — depende só de `ThemeContext`.

Boas práticas observadas no projeto (seguir ao criar novos componentes):
- Nomes de componente, props e funções internas **em português**, no domínio do problema (ex.: `alternarSelecao`, `handleDeletarClick`, `registrosExibidos`).
- Comentários JSDoc explicando o "porquê" de decisões não óbvias (não apenas repetir o que o código já diz).
- Toda função que muta a lista de registros retorna um **novo array/objeto** — nunca mutação direta.
- Handlers assíncronos de mutação sempre passam por `persistirRegistros`.

---

# 10. Hooks

O projeto **não define hooks customizados próprios** além do `useTheme()` (que tecnicamente é o hook de acesso ao `ThemeContext`). Todo o resto do estado usa os hooks nativos do React (`useState`, `useMemo`, `useEffect`, `useRef`).

- **`useTheme()`** (`contexts/ThemeContext.tsx`): retorna `{ tema, alternarTema, definirTema }`. Deve ser chamado só dentro de um `<ThemeProvider>` (lança erro caso contrário). Use quando um componente precisar ler ou mudar o tema.
- **Quando NÃO criar um hook customizado neste projeto:** para lógica que só é usada em um único componente — o padrão do projeto é manter `useState`/`useMemo` inline dentro do próprio componente/página (ver `emails.tsx`, `EmailTable.tsx`, `Paginacao.tsx`, `QuantidadeInput.tsx`, todos com bastante estado local sem extrair para hooks). Só extraia um hook customizado se a mesma lógica de estado precisar ser reaproveitada em 2+ componentes — isso ainda não aconteceu no projeto.

---

# 11. Funções Utilitárias

### `src/components/utils/emailData.ts`
- `calcularContadores(registros: EmailRecord[]): EmailCounters` — entrada: array de registros; saída: objeto de contagem por status; sem efeitos colaterais.
- `filtrarPorStatusMultiplo(registros, statusSelecionados: Set<TStatus>): EmailRecord[]` — filtra por pertencimento ao conjunto.
- `buscar(registros, termo: string): EmailRecord[]` — busca case-insensitive em nome OU e-mail.
- `ordenar(registros, hierarquia: TOrdenacao): EmailRecord[]` — ordenação estável em cascata; não muta o array de entrada (copia com spread antes de `sort`).
- `processarRegistros(registros, opcoes): EmailRecord[]` — compõe as três funções acima na ordem: filtro → busca → ordenação.

### `src/components/utils/paginacao.ts`
- `calcularPaginacao(totalRegistros, registrosPorPagina, paginaAtualInformada): PaginaInfo` — entrada: três números; saída: `{ totalPaginas, paginaAtual (corrigida), intervalo: { inicio, fim } }`; sem efeitos colaterais.

### `src/components/utils/clipboard.ts`
- `copiarTexto(valores: string[]): Promise<void>` — **efeito colateral:** escreve na área de transferência do sistema operacional (via Clipboard API ou fallback com `execCommand`). Junta valores com `;`, sem deduplicar.

### `src/components/EmailStatus.ts`
- `isValidEmail(email): boolean` — regex de sintaxe.
- `normalizeEmail(email): string` — trim + lowercase.
- `recalcularStatusAutomatico(records): EmailRecord[]` — entrada: array de registros; saída: novo array com status recalculado para os registros com `status_alterado === false`; não muta a entrada.

### `src/scripts/utils/readSheet.ts`
- `readSheet(filePath): SheetRow[]` — **efeito colateral:** lê arquivo do disco (`readFileSync`) e, no caso de xlsx, usa a lib `xlsx`. Detecta delimitador de CSV automaticamente.

### `src/scripts/utils/identifyColumns.ts`
- `identifyColumns(headers): ColumnMap` — entrada: array de strings (cabeçalhos); saída: `{ idColumn, nomeColumn, emailColumn }`; lança exceção se não achar coluna de e-mail.
- `pickFirstFilled(row, candidates): string` — retorna o primeiro valor não vazio entre colunas candidatas.

### `src/scripts/utils/validateEmail.ts`
- Mesma assinatura de `isValidEmail`/`normalizeEmail` do `EmailStatus.ts`, mas independente (para uso em Node).

---

# 12. Tipagens

Todas centralizadas em `src/types/email.ts` (ver detalhes na seção 4). Padrões usados:

- **Union types de string** para enums (`TStatus`, `TFiltro`, `TStatusManual`) — o projeto não usa `enum` do TypeScript, prefere union literals + arrays de constantes (`STATUS_PRIORIDADE`, `STATUS_MANUAIS`, `TODOS_OS_STATUS`) para poder iterar sobre os valores em runtime.
- **Tipos derivados por composição**: `TFiltro` é `TStatus | 'todos'`; `TStatusManual` é um subconjunto explícito de `TStatus`.
- **Interfaces** para formas de objeto (`EmailRecord`, `EmailCounters`, `ColumnMap`, `PaginaInfo`, `SheetRow` como alias de `Record<string,string>`).
- **Tipo local a um arquivo**, não centralizado, quando só faz sentido ali: `TCriterioOrdenacao`/`TOrdenacao` (em `emailData.ts`), `TTheme` (em `ThemeContext.tsx`), `TColunaCopiavel` (em `EmailTable.tsx`).
- Convenção de prefixo: tipos que representam um "T-algo" (`TStatus`, `TFiltro`, `TOrdenacao`, `TTheme`) usam prefixo `T`; interfaces de forma de dado (`EmailRecord`, `EmailCounters`) não usam prefixo.

---

# 13. Estilo de Código

- **Idioma:** nomes de funções, variáveis, componentes, props e classes CSS **em português** (domínio de negócio em português: `registros`, `selecionados`, `alternarFiltro`, `handleDeletarClick`, `EmailToolbar`). Nomes de tipos/tecnologias seguem inglês quando é convenção do ecossistema (`EmailRecord`, `TStatus`, `useState`).
- **Componentes:** `PascalCase`, `function NomeDoComponente(props) { ... }` (function declarations, não arrow functions atribuídas a `const`, exceto onde `export const` for necessário por outro motivo).
- **Funções auxiliares/handlers:** `camelCase`, verbos no infinitivo ou prefixo `handle`/`on` conforme o papel (`alternarSelecao` é lógica pura de estado; `handleDeletarClick` é o handler de evento que decide o fluxo; `onAlternarSelecao` é o nome da prop que recebe o callback).
- **Booleans:** prefixo implícito de pergunta (`todosSelecionadosDeletados`, `temSelecao`, `podeSelecionar`) em vez de prefixo `is`/`has` em inglês.
- **Constantes:** `SCREAMING_SNAKE_CASE` para valores fixos reais (`EMAIL_REGEX`, `DURACAO_FEEDBACK_COPIA_MS`, `ATRASO_DEBOUNCE_BUSCA`), `PascalCase`/`camelCase` para listas/mapas de configuração exportados (`STATUS_MANUAIS`, `CONTADOR_LABELS`, `FILTROS`).
- **Indentação:** 2 espaços, ponto e vírgula ao final das instruções.
- **Importações:** ordem observada — bibliotecas externas primeiro (React, react-router-dom, react-icons), depois `type` imports do domínio (`../types/email`), depois módulos locais (`./utils/...`, `../services/...`), sem linha em branco rígida entre grupos mas geralmente agrupados visualmente.
- **Comentários:** JSDoc (`/** ... */`) acima de funções e componentes não triviais, explicando **o porquê** de uma decisão (referenciando a seção da especificação, ex.: "seção 5.2", "seção 7") — não apenas descrevendo o que a linha seguinte faz. Comentários de uma linha (`//`) para justificar um trecho específico (ex.: por que um `useEffect` limpa um timeout).
- **Organização dentro de um componente de página** (`emails.tsx`): 1) imports; 2) tipos/funções auxiliares de módulo; 3) declaração do componente; 4) estados (`useState`); 5) valores derivados (`useMemo`); 6) handlers; 7) `return` do JSX. Handlers relacionados a uma mesma funcionalidade ficam próximos uns dos outros (ex.: todos os handlers de exclusão juntos).
- **Sem uso de bibliotecas de estilo/CSS-in-JS** — tudo em `index.css` puro, com convenção BEM-like informal (`toolbar-linha`, `toolbar-linha-1`, `status-badge`, `status-válido`).

---

# 14. Convenções do Projeto

- **Quando criar um componente novo em `src/components/`:** quando a peça de UI tem responsabilidade isolada e testável separadamente do resto da página, ou quando ela pode ser reaproveitada — mesmo que hoje só tenha um usuário (ex.: `ConflitoExclusaoModal`, `DuplicadosModal` só aparecem em `emails.tsx`, mas foram extraídos porque são unidades de UI completas e complexas).
- **Quando criar um hook customizado:** só quando a mesma lógica de estado precisar se repetir em 2+ lugares (ainda não aconteceu no projeto — ver seção 10).
- **Quando criar um utilitário em `components/utils/` vs `scripts/utils/`:** depende de onde o código roda. Browser (React) → `components/utils/`. Node (script de sincronização) → `scripts/utils/`. **Nunca importar um utilitário de Node dentro de um componente React, nem vice-versa** — os dois têm `tsconfig`s e bundlers diferentes.
- **Quando reutilizar código vs duplicar:** o projeto prefere reutilizar dentro do mesmo "lado" (browser ou Node), mas aceita duplicação **entre** os dois lados quando a alternativa exigiria acoplar o bundle do Vite ao ambiente Node (ver `EmailStatus.ts` vs `validateEmail.ts`). Ao alterar uma regra de validação de e-mail, **sempre atualizar os dois arquivos**.
- **Quando separar em múltiplos arquivos vs manter junto:** um componente de página (`pages/`) pode crescer bastante (orquestração de estado), mas qualquer bloco de JSX com responsabilidade própria e mais de ~50-80 linhas deve virar um componente em `components/`.
- **Convenção de status manual vs automático:** ao adicionar uma nova forma de alterar status, decidir explicitamente se ela deve respeitar `status_alterado` (travar recálculo automático) — a resposta quase sempre é sim, exceto para a própria ação de restaurar.

---

# 15. Fluxo das Funcionalidades (como adicionar features seguindo o padrão)

### Adicionar um novo filtro de status
1. Se for um novo **valor de status**, adicionar em `TStatus` (`src/types/email.ts`) e decidir sua posição em `STATUS_PRIORIDADE`.
2. Adicionar ao array `TODOS_OS_STATUS` e `FILTROS` (rótulo) em `src/components/utils/emailData.ts`.
3. Adicionar uma classe CSS `status-<novo>` em `src/index.css`.
4. Se o novo status deve ser calculado automaticamente, ajustar `recalcularStatusAutomatico` (`EmailStatus.ts`) **e** `applyStatusRules` (`sync.ts`) — os dois precisam ficar consistentes.
5. Se o novo status pode ser setado manualmente, adicionar a `TStatusManual`/`STATUS_MANUAIS`.

### Adicionar um novo botão de ação na tabela
1. Adicionar o ícone em `src/components/Icons.tsx` (nunca importar `react-icons` direto em outro arquivo).
2. Adicionar o botão em `EmailTable.tsx` (cabeçalho ou célula, conforme o escopo — individual vs em massa).
3. Adicionar a prop de callback correspondente na interface `Props` de `EmailTable`.
4. Implementar o handler em `emails.tsx`, seguindo o padrão: calcular o novo array de registros → chamar `persistirRegistros`.

### Adicionar uma nova coluna na tabela
1. Adicionar o campo em `EmailRecord` (`src/types/email.ts`) — **atenção:** isso afeta `sync.ts` (deve popular o campo) e possivelmente `identifyColumns.ts` (se vier de uma nova coluna da planilha).
2. Adicionar o `<th>`/`<td>` em `EmailTable.tsx`.
3. Se a coluna for buscável/filtrável/ordenável, estender `buscar`/`filtrarPorStatusMultiplo`/`ordenar` em `emailData.ts`.
4. Atualizar `data/emails.json` existente (ou rodar `sync.ts` novamente) para preencher o novo campo nos registros já existentes.

### Adicionar uma nova página/rota
1. Criar o arquivo em `src/pages/`.
2. Registrar a rota em `src/App.tsx`.
3. Se a página precisar de navegação a partir da Home, adicionar um item ao array `planilhas` (ou substituir o mock por dado real, se essa for a funcionalidade sendo implementada).

### Adicionar exportação de dados (ex.: exportar seleção para CSV)
1. Provavelmente um novo botão na `EmailTable` (cabeçalho, ao lado de copiar) ou na `EmailToolbar`.
2. Nova função utilitária em `components/utils/` (ex.: `exportarCsv.ts`), seguindo o padrão de `clipboard.ts` (função pura de I/O, sem estado).
3. Não depende do backend/script de sincronização — é uma ação client-side.

### Adicionar novo estado de UI (ex.: um novo modal)
1. `useState<TipoDoEstado | null>(null)` em `emails.tsx` (padrão: `null` = fechado).
2. Handler para abrir (`handleAbrirX`) e para fechar/confirmar/cancelar.
3. Renderização condicional (`{estado && <Modal ... />}`) próxima aos outros modais no final do JSX de `emails.tsx`.

### Adicionar nova validação (ex.: exigir domínio específico)
1. Se a validação impacta a sincronização, alterar `validateEmail.ts` (Node).
2. Se a validação impacta o cálculo dentro da UI (ação Restaurar), alterar `EmailStatus.ts` (browser).
3. **Lembrar de alterar os dois** — ver dívida técnica na seção 19.

---

# 16. Dependências Entre Arquivos (mapa)

```
main.tsx
  └─ ThemeProvider (contexts/ThemeContext.tsx)
       └─ BrowserRouter
            └─ App.tsx
                 ├─ pages/home.tsx
                 │    ├─ components/ThemeToggle.tsx → contexts/ThemeContext.tsx
                 │    └─ components/Icons.tsx
                 │
                 └─ pages/emails.tsx  ← "cérebro" da aplicação
                      ├─ data/emails.json (import estático)
                      ├─ types/email.ts
                      ├─ components/utils/paginacao.ts
                      ├─ components/utils/emailData.ts
                      ├─ components/EmailStatus.ts
                      ├─ services/emailsApi.ts → vite.config.ts (middleware /api/emails)
                      ├─ components/EmailCounters.tsx
                      ├─ components/EmailToolbar.tsx
                      │    ├─ components/OrdenacaoPrioridade.tsx
                      │    └─ components/QuantidadeInput.tsx
                      ├─ components/EmailTable.tsx
                      │    ├─ components/utils/clipboard.ts
                      │    └─ components/Icons.tsx
                      ├─ components/Paginacao.tsx
                      │    └─ components/Icons.tsx
                      ├─ components/ConflitoExclusaoModal.tsx
                      │    └─ components/Icons.tsx
                      ├─ components/DuplicadosModal.tsx
                      │    └─ components/Icons.tsx
                      └─ components/ThemeToggle.tsx

(fora do bundle React, roda via terminal)
src/scripts/sync.ts
  ├─ src/scripts/utils/readSheet.ts
  ├─ src/scripts/utils/identifyColumns.ts
  ├─ src/scripts/utils/validateEmail.ts
  └─ src/types/email.ts
       ↓ escreve
     data/emails.json
```

---

# 17. Arquivos Críticos

1. **`src/types/email.ts`** — qualquer mudança aqui (novo status, novo campo) se propaga potencialmente para `EmailStatus.ts`, `sync.ts`, `applyStatusRules`, `emailData.ts`, `EmailTable.tsx` e o CSS de badges de status. Alto risco de esquecer um dos pontos.
2. **`src/pages/emails.tsx`** — concentra praticamente toda a lógica de negócio da UI. Erros aqui afetam simultaneamente busca, filtro, ordenação, seleção, persistência e todos os modais.
3. **`src/scripts/sync.ts`** — único caminho para trazer dados novos para o sistema. Um bug aqui pode corromper `data/emails.json` (fonte oficial) silenciosamente, já que ele sobrescreve o arquivo inteiro.
4. **`vite.config.ts`** (middleware `emailsApiPlugin`) — se quebrar, nenhuma alteração feita na UI é persistida (mas a UI continua "funcionando" visualmente até o reload, escondendo o problema).
5. **`src/components/EmailStatus.ts` + `src/scripts/utils/validateEmail.ts`** — pares que precisam mudar juntos; divergência entre eles gera comportamento diferente entre "o que a sincronização calcula" e "o que a UI recalcula ao restaurar".
6. **`data/emails.json`** — não é código, mas é o dado mais crítico do sistema; não deve ser editado manualmente sem cuidado (import estático, sem validação de schema em runtime).

---

# 18. Pontos de Atenção

- **Não** permitir que o select de status individual (`EmailTable.renderStatus`) ofereça `'duplicado'` ou `'deletado'` como opção — isso quebraria a regra de que esses dois status são exclusivamente calculados/alcançados por outros caminhos.
- **Não** remover a checagem de `status_alterado` em `recalcularStatusAutomatico`/`applyStatusRules` — sem ela, qualquer sincronização ou "Restaurar" apagaria decisões manuais do usuário (ex.: um "enviado" viraria "válido" de novo).
- **Não** misturar utilitários de Node (`scripts/utils/`) com utilitários de browser (`components/utils/`) em um mesmo import — os `tsconfig`s são incompatíveis por design.
- **Não** editar `data/emails.json` manualmente enquanto o dev server está aberto sem depois recarregar a página — o import é estático, não reage a mudanças externas.
- **Não** editar arquivos dentro de `dist/` — são sobrescritos a cada build.
- **Cuidado ao alterar a ordem do pipeline** em `processarRegistros` (filtro → busca → ordenação) — a "quantidade" de registros exibidos (`QuantidadeInput`) é sempre aplicada **depois**, sobre o resultado já processado; inverter isso mudaria o significado de "quantidade" de "por página" para "primeiros N antes de filtrar".
- **Cuidado com a regra de seleção** (não misturar grupo "deletado" com "ativo") — qualquer nova ação em massa precisa continuar respeitando `grupoDoStatus`/`selecionavel`.
- **Erro comum:** esquecer de atualizar `validateEmail.ts` (Node) ao mudar a regra de e-mail em `EmailStatus.ts` (browser), ou vice-versa.
- **Erro comum:** adicionar um novo status em `TStatus` sem adicioná-lo em `STATUS_PRIORIDADE`, `TODOS_OS_STATUS`, `FILTROS` e `CONTADOR_LABELS` simultaneamente — a lista completa de lugares a tocar está na seção 15 ("Adicionar um novo filtro de status").
- **Armadilha de estilo:** `index.css` é um arquivo grande e monolítico com convenção de seções comentadas — ao adicionar CSS novo, sempre criar uma seção nova e comentada em vez de espalhar regras soltas.

---

# 19. Dívidas Técnicas

- **Sem backend real / sem hospedagem** — a persistência só existe em `npm run dev` (middleware do Vite); o build de produção (`npm run build`/`preview`) não tem onde salvar alterações.
- **Sem banco de dados** — um único arquivo JSON local, sem transações, sem controle de concorrência (dois processos escrevendo ao mesmo tempo podem se sobrescrever).
- **Importação de planilha só via terminal** — o botão "Importar planilha" na Home (`home.tsx`) é um placeholder visual sem `onClick` funcional.
- **Suporte a uma única planilha por vez** — `data/emails.json` é fixo; a Home já tem a estrutura visual de múltiplos cards, mas os dados continuam estáticos (mock com um item).
- **Duplicação de regra de validação de e-mail** entre `EmailStatus.ts` (browser) e `validateEmail.ts` (Node) — risco de divergência silenciosa se só um dos dois for atualizado.
- **Identificação de colunas hardcoded** (`identifyColumns.ts`) — planilhas com cabeçalhos muito diferentes dos já conhecidos exigem edição manual do código, não há configuração dinâmica.
- **Import estático do JSON** — exige reload manual da página após rodar `sync.ts` com o dev server já aberto.
- **Sem testes automatizados** identificados no repositório até o momento deste documento (verificar se isso mudou antes de assumir).

**Roadmap planejado (seção 9 da especificação, resumido):**
1. Home dinâmica (cards reais, não mock).
2. `emails.tsx` genérico/reutilizável (recebendo qual conjunto de dados carregar).
3. Importação via interface (substitui `npm run sync`).
4. Rotas dinâmicas por slug (`/emails/:slug`), resolvidas em runtime.
5. Backend real com persistência em banco (SQLite/Postgres) ou storage compatível com hospedagem.
6. Hospedagem (VPS/Render/Railway ou similar).

---

# 20. Histórico Arquitetural

- **Por que um script Node separado (`sync.ts`) em vez de importar a planilha direto no navegador?** Porque a leitura de arquivo do sistema (`fs`), parsing de CSV/XLSX e escrita de JSON são operações de servidor/CLI, não de browser. Rodar isso no bundle do Vite exigiria um backend completo — que ainda não existe (fase "local" do projeto, ver aviso no topo da especificação).
- **Por que `tsconfig.scripts.json` separado, em vez de reaproveitar o `tsconfig` da aplicação?** Porque o script roda em Node puro via `ts-node`, com módulos e tipos diferentes (`@types/node`) dos usados pelo bundle React/Vite. Manter configs separadas evita que tipos de DOM vazem para o script e vice-versa.
- **Por que duplicar `isValidEmail`/`normalizeEmail` em vez de compartilhar um único módulo?** Consequência direta da separação acima — um módulo verdadeiramente compartilhado exigiria que ambos os `tsconfig`s e bundlers concordassem em como resolvê-lo. A decisão foi aceitar a duplicação controlada (ambos comentam explicitamente essa relação) em vez de complicar o build.
- **Por que persistência imediata (sem botão "Salvar") em vez de um estado de rascunho?** Decisão de produto: o objetivo é que o JSON em disco esteja sempre sincronizado com o que a pessoa vê na tela, evitando perder trabalho por esquecer de salvar. O custo é uma chamada de rede a cada pequena alteração — aceitável para uso local/pessoal.
- **Por que atualização otimista com reversão em caso de erro (`persistirRegistros`)?** Para manter a interface responsiva (o usuário não espera a resposta do servidor para ver o efeito), mas sem esconder falhas de gravação — se a API falhar, o estado volta ao valor anterior e um erro é mostrado.
- **Por que `TStatusManual` é um subconjunto de `TStatus` em vez de reaproveitar o tipo inteiro nos selects?** Para que o próprio sistema de tipos impeça, em tempo de compilação, que alguém ofereça "duplicado" ou "deletado" como opção em um `<select>` de status manual — a regra de negócio fica garantida pelo TypeScript, não só por convenção de código.
- **Por que a Home hoje é um mock estático?** É uma etapa intermediária deliberada, documentada em `public/etapas.txt`: a estrutura visual (cards, botão de importar) foi construída primeiro, para que os dados dinâmicos e a importação via interface (fase futura, seção 9 da especificação) sejam encaixados depois sem redesenhar a tela.
- **Por que o projeto segue os padrões de um projeto de referência externo (`multiverso.riopombavalley`)?** Citado na especificação como inspiração de stack e estrutura de pastas — decisão de reaproveitar convenções já validadas em outro projeto do mesmo autor, em vez de desenhar do zero.

---

# 21. Glossário

- **Registro** — um item da lista de e-mails (`EmailRecord`): id, nome, e-mail, status, se foi alterado manualmente, quando foi atualizado pela última vez.
- **Status** — estado atual de um registro: `válido`, `inválido`, `duplicado`, `deletado`, `enviado`.
- **Status manual** — um dos status que o usuário pode atribuir diretamente (`válido`, `inválido`, `enviado`) — nunca `duplicado` nem `deletado` por esse caminho.
- **Status automático** — status calculado pelo sistema (sincronização ou "Restaurar"): `válido`/`inválido`/`duplicado`.
- **`status_alterado`** — flag que indica que o status atual foi definido manualmente e não deve ser recalculado automaticamente.
- **Duplicado** — registro que compartilha o mesmo e-mail (normalizado) com pelo menos outro registro.
- **Deletado** — registro logicamente excluído (soft delete); permanece no JSON, mas com status `deletado`.
- **Enviado** — registro marcado como já contatado; protegido contra exclusão direta.
- **Grupo (de seleção)** — "deletado" ou "ativo" (todos os não-deletados); usado para impedir seleção mista.
- **Sincronização** — processo de rodar `sync.ts` para importar/atualizar dados de uma planilha em `data/emails.json`.
- **Persistência imediata** — toda alteração feita na UI é salva no JSON sem necessidade de um botão "Salvar" explícito.
- **Restauração** — ação que zera `status_alterado` de um ou mais registros e deixa o sistema recalcular o status automaticamente de novo.
- **Conflito de exclusão** — situação em que uma seleção a excluir contém registros "enviado", exigindo confirmação explícita via modal.
- **Contadores** — totais por status exibidos no topo da tabela.
- **Hierarquia de ordenação** — lista ordenada de critérios (ID, alfabética, status) aplicados em cascata, onde o primeiro tem prioridade máxima.
- **Fase local** — estágio atual do projeto: roda só no computador do usuário, sem hospedagem, sem múltiplas planilhas reais, sem backend persistente além do dev server do Vite.

---

# 22. Guia para IAs

Se você (IA) está lendo este documento para responder uma pergunta sobre este projeto, siga estas diretrizes:

### Como navegar no projeto
1. Comece por este arquivo (`PROMPTME.md`) — ele deve responder a maioria das perguntas de arquitetura/regra de negócio sem precisar abrir nenhum arquivo de código.
2. Se precisar de detalhes de regra de negócio muito específicos (ex.: exatamente qual texto aparece em um modal, ou um caso de borda não coberto aqui), consulte `public/Especificacao_Sistema_Emails_v3.md`, que é a fonte de maior autoridade e está organizado por seções numeradas (referenciadas ao longo deste documento, ex.: "seção 5.2", "seção 7").
3. Só then abra o código-fonte real, e apenas o(s) arquivo(s) específico(s) indicado(s) pela seção 4 ou pelo mapa de dependências (seção 16) — evite varrer o projeto inteiro.

### Como responder perguntas
- Prefira responder com base neste documento antes de "adivinhar" com base em padrões genéricos de React/TypeScript — este projeto tem convenções próprias (nomes em português, ausência de hooks customizados, ausência de estado global de dados, persistência imediata sem botão salvar) que **divergem** de muitos boilerplates comuns.
- Se a pergunta for sobre "como implementar X", consulte primeiro a seção 15 (Fluxo das Funcionalidades) — ela já mapeia os arquivos tipicamente afetados para os tipos de mudança mais comuns.
- Se a pergunta for sobre "por que o código é assim", consulte a seção 20 (Histórico Arquitetural) antes de sugerir uma refatoração — várias decisões que parecem estranhas à primeira vista (duplicação de validação de e-mail, tsconfig separado, Home mockada) são **intencionais**, documentadas e ligadas a restrições reais do ambiente (separação Node/browser, fase local do produto).

### Como evitar sugerir soluções incompatíveis
- **Não** sugira mover a leitura de planilha para o navegador (File API) sem antes considerar que isso contradiz a arquitetura atual (sincronização via terminal, fase local) — se o usuário pedir isso, trate como uma decisão de produto que precisa ser explicitamente aceita, não uma "correção" implícita.
- **Não** sugira um estado global (Redux/Zustand/Context genérico) para os dados de e-mail — o projeto usa deliberadamente estado local em `emails.tsx`; só sugira mudar isso se o usuário pedir explicitamente algo que exija estado compartilhado entre páginas distantes.
- **Não** sugira unificar `EmailStatus.ts` e `validateEmail.ts` em um único módulo importado dos dois lados sem antes explicar a restrição de bundlers/tsconfig que motivou a separação (seção 20) — se o usuário quiser resolver essa dívida técnica, isso é uma escolha válida, mas deve ser apresentada como tal, não como "correção óbvia".
- **Não** presuma que existe backend, banco de dados, autenticação ou múltiplas planilhas reais — o projeto está na "fase local" (ver especificação, aviso do topo). Recursos da seção 9 (planos futuros) **não existem ainda**.

### Como manter o padrão do projeto
- Mantenha nomes em português para tudo relacionado ao domínio de negócio (variáveis, funções, componentes, classes CSS); reserve inglês para nomes de tecnologia/tipos que já são convenção do ecossistema.
- Ao adicionar uma nova regra sobre o ciclo de vida de status, sempre verificar se ela precisa ser espelhada tanto no lado browser (`EmailStatus.ts`) quanto no lado Node (`sync.ts`/`validateEmail.ts`).
- Ao adicionar uma nova ação de mutação de dados na UI, sempre canalizá-la através de `persistirRegistros` (padrão de atualização otimista + reversão em erro), não invente um caminho de persistência paralelo.
- Prefira estender as funções puras já existentes (`emailData.ts`, `paginacao.ts`) a criar novas camadas de abstração.

### Como identificar o local correto para implementar uma funcionalidade
- Use a seção 3 (pastas) e a seção 15 (fluxo de funcionalidades) como checklist. Em caso de dúvida entre `components/` e `pages/`: se a peça de UI tem estado/lógica própria de tela inteira ou representa uma rota, é `pages/`; se é uma peça reaproveitável dentro de uma página, é `components/`.
- Em caso de dúvida entre `components/utils/` e `scripts/utils/`: pergunte "isso roda no navegador ou no terminal?" — a resposta decide a pasta.

### Como evitar refatorações desnecessárias
- Não proponha reescrever `emails.tsx` em múltiplos hooks customizados só por "boas práticas genéricas" — o projeto optou deliberadamente por manter o estado centralizado ali (ver seção 10). Só sugira extrair um hook se a lógica realmente precisar ser reutilizada em outro componente.
- Não proponha trocar a store JSON por um banco de dados como primeira sugestão para qualquer problema — isso está no roadmap (seção 19), mas é uma mudança grande de arquitetura que deve ser tratada como tal, não como um pequeno ajuste.

### Quais arquivos normalmente precisam ser modificados juntos
- Novo status → `types/email.ts` + `EmailStatus.ts` + `sync.ts` (`applyStatusRules`) + `emailData.ts` (constantes) + `index.css` (classe do badge).
- Nova ação de mutação → handler em `emails.tsx` + prop/callback no componente correspondente (`EmailTable.tsx` ou outro) + (se necessário) novo ícone em `Icons.tsx`.
- Nova coluna de planilha aceita → `identifyColumns.ts` (listas de nomes de coluna) + possivelmente `types/email.ts` (`EmailRecord`) + `sync.ts` (`syncRecords`).
- Mudança na regra de validação de e-mail → `EmailStatus.ts` **e** `validateEmail.ts` (sempre os dois).

### Como propor mudanças minimizando impacto
- Prefira mudanças aditivas (novo campo opcional, nova função) a alterar assinaturas de funções já usadas em múltiplos lugares (`processarRegistros`, `persistirRegistros`, `EmailRecord`).
- Ao alterar `src/types/email.ts`, liste explicitamente, na sua resposta, todos os outros arquivos que também precisarão mudar (use a seção 17 e o "Quais arquivos normalmente precisam ser modificados juntos" acima como referência).
- Sempre que uma mudança de regra de negócio for proposta, verifique primeiro se ela está descrita na especificação (`public/Especificacao_Sistema_Emails_v3.md`) — se divergir do que está escrito lá, avise explicitamente que a especificação também precisaria ser atualizada.
PROMPTEOF