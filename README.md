# Sistema de Organização e Envio de E-mails

## Visão geral

Este projeto é uma aplicação **local** para organizar, validar e gerenciar listas de e-mails importadas de planilhas (`.csv` ou `.xlsx`). Ele transforma uma planilha em uma interface web onde é possível:

- consultar os registros de forma organizada, com paginação;
- buscar por nome e e-mail simultaneamente;
- filtrar por status (podendo combinar mais de um ao mesmo tempo);
- ordenar por múltiplos critérios com prioridade (ex.: primeiro por Status, depois por ordem alfabética);
- selecionar registros e copiar nomes/e-mails para a área de transferência;
- alterar o status de um registro individualmente ou em massa;
- excluir (logicamente) e restaurar registros;
- visualizar rapidamente quais registros compartilham o mesmo e-mail (duplicados);
- manter um arquivo JSON como fonte oficial dos dados, salvo automaticamente a cada alteração (sem botão "Salvar").

**O sistema não envia e-mails.** Sua função é apenas organizar e preparar os destinatários para um envio posterior feito por fora da aplicação (ex.: copiando os e-mails para o serviço de disparo utilizado).

## Objetivo do projeto

Facilitar o trabalho de lidar com grandes listas de contatos vindas de planilhas (hoje, formulários/relatórios de treinamentos), especialmente quando:

- a planilha é a fonte inicial dos dados e pode ser sincronizada novamente no futuro (nova exportação, novos inscritos etc.);
- é preciso revisar, classificar e organizar os registros antes de disparar e-mails;
- é necessário remover duplicidades, validar endereços de e-mail e manter um histórico de alterações sem perder o que já foi feito manualmente.

A especificação completa do projeto está em [public/Especificacao_Sistema_Emails_v3.md](public/Especificacao_Sistema_Emails_v3.md) — é o documento de referência mais detalhado, incluindo regras de negócio, decisões de design da interface e o roadmap de longo prazo (seção 9). O arquivo [public/etapas.txt](public/etapas.txt) contém anotações de implementação da funcionalidade mais recente (a página inicial/Home).

> **Importante:** este README descreve o estado atual do projeto. Sempre que uma funcionalidade nova for implementada, atualize também este arquivo.

---

## Tecnologias utilizadas

- **React 19** + **TypeScript** + **Vite** — interface e bundler.
- **React Router** — navegação entre a Home e a página de e-mails.
- **Node.js** (via `ts-node`) — execução do script de sincronização, fora do bundle do Vite.
- **csv-parse** — leitura de planilhas `.csv`.
- **xlsx (SheetJS)** — leitura de planilhas `.xlsx`/`.xls`.
- **react-icons** — ícones da interface.
- Um middleware próprio do Vite (em [vite.config.ts](vite.config.ts)) expõe uma pequena API local (`/api/emails`) usada só em modo de desenvolvimento para persistir alterações no JSON.

---

## Como executar o sistema

### 1. Pré-requisitos

- Node.js instalado (recomendado LTS mais recente);
- npm.

### 2. Instalar dependências

Na raiz do projeto:

```bash
npm install
```

### 3. Rodar em modo de desenvolvimento

```bash
npm run dev
```

A aplicação abre em:

```text
http://localhost:5173/
```

Nesse modo, o próprio Vite expõe a rota `/api/emails`, que grava diretamente em [data/emails.json](data/emails.json) a cada alteração feita na interface (não existe botão "Salvar" — toda ação já persiste).

### 4. Gerar build de produção

```bash
npm run build
```

O resultado vai para a pasta [dist](dist). Para servir esse build localmente e conferir o resultado:

```bash
npm run preview
```

> ⚠️ O build de produção **não inclui** a API `/api/emails` (ela só existe no servidor de desenvolvimento do Vite). Hoje o projeto ainda não tem um backend real para persistência fora do `npm run dev` — ver seção "Limitações atuais".

### 5. Checar problemas de lint

```bash
npm run lint
```

---

## Como sincronizar uma planilha (nova ou atualizada)

A sincronização é o processo que lê uma planilha (`.csv` ou `.xlsx`) e atualiza [data/emails.json](data/emails.json), preservando qualquer alteração manual já feita (status trocado na interface, exclusões, etc.).

### Passo a passo

1. Coloque o arquivo da planilha dentro da pasta [data](data).
2. Abra um terminal na raiz do projeto.
3. Rode o script de sincronização usando o comando já configurado em [package.json](package.json):

```bash
npm run sync -- data/seu-arquivo.csv
```

Substitua `seu-arquivo.csv` pelo nome real do arquivo (aceita também `.xlsx`).

Por padrão, o resultado é gravado em `data/emails.json`. Para gravar em outro caminho, use `--out`:

```bash
npm run sync -- data/seu-arquivo.csv --out=data/outro-arquivo.json
```

> **Windows / PowerShell:** o script `sync` definido no `package.json` usa a sintaxe `VARIAVEL=valor comando`, que funciona em bash/zsh (Linux, macOS, Git Bash), mas **não é reconhecida pelo PowerShell nativo**. Se `npm run sync` falhar no PowerShell, rode o comando equivalente manualmente:
>
> ```powershell
> $env:TS_NODE_PROJECT = 'tsconfig.scripts.json'
> node --loader ts-node/esm src/scripts/sync.ts data/seu-arquivo.csv
> ```

### O que a sincronização faz

1. Lê a planilha indicada (CSV ou XLSX), detectando automaticamente o delimitador no caso de CSV (vírgula, ponto e vírgula ou tabulação).
2. Identifica quais colunas da planilha representam **ID** (opcional), **Nome** e **E-mail**, comparando os cabeçalhos com uma lista de nomes conhecidos (ver [src/scripts/utils/identifyColumns.ts](src/scripts/utils/identifyColumns.ts)).
3. Casa cada linha da planilha com um registro já existente no JSON pelo `id` (ou usa a posição da linha como `id`, se a planilha não tiver coluna de ID). Registros já existentes têm nome/e-mail atualizados; novos registros são criados.
4. Valida a sintaxe de cada e-mail (regex simples, sem checar domínio/DNS) e identifica duplicados (mesmo e-mail normalizado em mais de um registro).
5. Recalcula o status de todo registro cujo status **não** tenha sido alterado manualmente (`status_alterado: false`), respeitando a prioridade: `enviado > deletado > duplicado > válido/inválido`. Registros alterados manualmente na interface nunca são sobrescritos pela sincronização.
6. Grava o JSON final, ordenado por `id`, em [data/emails.json](data/emails.json) (ou no caminho definido em `--out`).
7. Imprime no terminal um resumo: quantas linhas foram lidas, quantos registros são novos, quantos foram atualizados e os contadores finais por status.

Se a planilha tiver nomes de coluna muito diferentes dos já conhecidos, é necessário adicionar os novos nomes em [src/scripts/utils/identifyColumns.ts](src/scripts/utils/identifyColumns.ts) (listas `ID_COLUMNS`, `NOME_COLUMNS` e `EMAIL_COLUMNS`).

---

## Fluxo de dados

```text
Planilha (.csv / .xlsx) em data/
        ↓
src/scripts/sync.ts  (rodado manualmente via terminal)
        ↓
data/emails.json  (fonte oficial dos dados)
        ↓
Interface React (src/pages/emails.tsx)
        ↓
Alterações do usuário (status, exclusão, restauração)
        ↓
API local do Vite (/api/emails) → regrava data/emails.json imediatamente
```

---

## Outras funcionalidades da interface

- **Contadores**: mostram o total de registros e a quantidade em cada status (válidos, inválidos, duplicados, deletados, enviados), sempre refletindo o estado atual.
- **Busca**: um único campo busca por nome ou e-mail ao mesmo tempo, com debounce (aguarda a pessoa parar de digitar antes de filtrar).
- **Filtros por status**: cada botão de status funciona como um interruptor independente — é possível combinar, por exemplo, "Válidos" + "Inválidos" ao mesmo tempo. O botão "Todos" marca/desmarca tudo de uma vez.
- **Ordenação em cascata**: é possível definir uma hierarquia de critérios (ID, ordem alfabética, status) por arrastar-e-soltar ou pelos botões ▲/▼. O primeiro da lista manda; os seguintes só desempatam.
- **Quantidade de registros exibidos**: controla quantos registros aparecem por página (paginação) na tabela.
- **Seleção de registros**: feita por checkbox, respeitando uma regra importante — não é possível selecionar simultaneamente registros "deletados" e "não deletados". Um clique em "Selecionar todos" considera apenas os registros da página exibida.
- **Cópia em massa**: os ícones ao lado dos cabeçalhos "Nome" e "E-mail" copiam, para a área de transferência, os valores dos registros selecionados (separados por `;`).
- **Atualização de status**: pode ser feita registro a registro (select inline na própria linha da tabela) ou em massa (ícone de edição no cabeçalho da coluna Status, aplicando o novo status a todos os selecionados). Não é possível definir manualmente o status "duplicado" (é sempre calculado pelo sistema) nem "deletado" por esse caminho (só pelo botão de exclusão).
- **Exclusão lógica**: marca os registros selecionados como "deletado" (não remove do JSON). Se a seleção incluir registros já "enviados", abre um modal de conflito, pois registros enviados nunca podem ser deletados diretamente — o modal permite revisar e confirmar apenas os elegíveis.
- **Restauração**: reverte registros "deletados" (ou com status alterado manualmente) de volta ao cálculo automático de status.
- **Modal de duplicados**: ao clicar no badge "duplicado" de um registro, abre uma lista com todos os registros que compartilham aquele mesmo e-mail.
- **Tema claro/escuro**: alternável pelo botão no cabeçalho, com a preferência salva no navegador (`localStorage`) e detecção inicial da preferência do sistema operacional.
- **Home / página inicial** (`/`): mostra "cards" das planilhas já processadas — hoje, um único card estático apontando para `/emails`. Já existe um botão "Importar planilha" na tela, mas ele **ainda não tem funcionalidade** (é um placeholder visual para a futura importação via interface, descrita nos planos futuros).

---

## Estrutura do projeto

### Pastas principais

- [data](data): entrada e saída de dados — planilhas de origem e o JSON oficial dos registros.
- [public](public): documentação do projeto (especificação e anotações de etapas), copiada para o build final.
- [src](src): todo o código-fonte da aplicação e do script de sincronização.
- [dist](dist): build de produção gerado por `npm run build` (não deve ser editado manualmente).

### Arquivos e pastas em detalhe

#### Raiz do projeto

- [package.json](package.json): lista as dependências e define os scripts (`dev`, `build`, `lint`, `preview`, `sync`).
- [vite.config.ts](vite.config.ts): configuração do Vite. Também define o middleware `emailsApiPlugin`, que cria a rota `/api/emails` (só ativa em `npm run dev`) para persistir o array de registros em `data/emails.json` sempre que a interface faz uma alteração.
- [tsconfig.json](tsconfig.json) / [tsconfig.app.json](tsconfig.app.json) / [tsconfig.node.json](tsconfig.node.json): configurações do TypeScript para a aplicação React e para as ferramentas de build.
- [tsconfig.scripts.json](tsconfig.scripts.json): configuração do TypeScript usada especificamente pelo script de sincronização (`src/scripts`), que roda fora do bundle do Vite, via Node/ts-node.
- [eslint.config.js](eslint.config.js): regras de lint do projeto.
- [index.html](index.html): HTML raiz usado pelo Vite em desenvolvimento e como base do build.

#### Pasta [data](data)

- [data/emails.json](data/emails.json): **fonte oficial dos dados**. É o arquivo lido pela interface e regravado tanto pela sincronização (`sync.ts`) quanto pelas ações do usuário na tela (via API local do Vite).
- [data/ibm.csv](data/ibm.csv): exemplo de planilha de origem já utilizada, no formato exportado por um sistema de relatórios de treinamentos (colunas como "Aluno – Nome", "Aluno – E-mail" etc.).

#### Pasta [public](public)

- [public/Especificacao_Sistema_Emails_v3.md](public/Especificacao_Sistema_Emails_v3.md): documento de referência com objetivo, arquitetura, regras de negócio, comportamento detalhado da interface e o roadmap de longo prazo do projeto (seção 9). É a fonte mais completa sobre o "porquê" das decisões do sistema.
- [public/etapas.txt](public/etapas.txt): anotações de implementação da funcionalidade mais recente (a página Home com cards). Serve como checklist/histórico do que foi (ou será) feito nessa etapa.

#### Pasta [src](src) — aplicação React

- [src/main.tsx](src/main.tsx): ponto de entrada da aplicação. Monta o React na página, envolvendo tudo com o `ThemeProvider` (tema claro/escuro) e o `BrowserRouter` (rotas).
- [src/App.tsx](src/App.tsx): define as rotas da aplicação — `/` (Home), `/emails` (lista de e-mails) e uma rota coringa que também cai na Home.
- [src/index.css](src/index.css): estilos globais da aplicação (variáveis de cor, layout, componentes visuais, tema claro/escuro, responsividade).

#### Pasta [src/pages](src/pages)

- [src/pages/home.tsx](src/pages/home.tsx): página inicial (`/`). Exibe um cabeçalho, o botão "Importar planilha" (ainda sem ação — placeholder) e uma grade de "cards", cada um representando uma planilha já processada. Hoje a lista é estática (um único item apontando para `/emails`); no futuro, virá de dados reais conforme múltiplas planilhas forem suportadas (ver seção 9 da especificação).
- [src/pages/emails.tsx](src/pages/emails.tsx): página principal do sistema (`/emails`). Concentra todo o estado da aplicação — registros carregados do JSON, busca, filtros, ordenação, paginação, seleção — e conecta os componentes de interface às regras de negócio (validação, status, persistência). É o "cérebro" da tela de e-mails.

#### Pasta [src/components](src/components)

- [src/components/EmailCounters.tsx](src/components/EmailCounters.tsx): exibe os cartões de contagem (total, válidos, inválidos, duplicados, deletados, enviados).
- [src/components/EmailToolbar.tsx](src/components/EmailToolbar.tsx): barra de busca, filtros por status, controle de ordenação e input de quantidade de registros exibidos.
- [src/components/EmailTable.tsx](src/components/EmailTable.tsx): a tabela principal de registros. Renderiza cada linha (ID, nome, e-mail, status), os checkboxes de seleção, os botões de copiar nome/e-mail, o select de alteração de status (individual e em massa) e o botão de deletar/restaurar no cabeçalho.
- [src/components/OrdenacaoPrioridade.tsx](src/components/OrdenacaoPrioridade.tsx): controle visual (parecido com um `<select>`) que permite reordenar, por arrastar-e-soltar ou pelos botões ▲/▼, a hierarquia de critérios de ordenação (ID, ordem alfabética, status).
- [src/components/QuantidadeInput.tsx](src/components/QuantidadeInput.tsx): campo numérico customizado (com setas de incrementar/decrementar) usado para definir quantos registros aparecem por página.
- [src/components/Paginacao.tsx](src/components/Paginacao.tsx): controles de navegação entre páginas da tabela (anterior, próxima, ir para página específica).
- [src/components/ConflitoExclusaoModal.tsx](src/components/ConflitoExclusaoModal.tsx): modal exibido quando o usuário tenta excluir uma seleção que contém registros "enviados". Mostra separadamente os registros que não podem ser excluídos e os que podem, permitindo confirmar apenas a exclusão dos elegíveis.
- [src/components/DuplicadosModal.tsx](src/components/DuplicadosModal.tsx): modal exibido ao clicar no badge "duplicado" de um registro, listando todos os registros que compartilham aquele mesmo e-mail.
- [src/components/ThemeToggle.tsx](src/components/ThemeToggle.tsx): botão de alternância entre tema claro e escuro.
- [src/components/Icons.tsx](src/components/Icons.tsx): centraliza todos os ícones usados na interface (a partir da biblioteca `react-icons`), com nomes em português (ex.: `IconeCopiar`, `IconeLixeira`).
- [src/components/EmailStatus.ts](src/components/EmailStatus.ts): regras de validação de e-mail e de recálculo automático de status. É compartilhado entre a interface (ação "Restaurar") e o script de sincronização, para garantir que as duas partes apliquem exatamente a mesma regra.

#### Pasta [src/components/utils](src/components/utils)

- [src/components/utils/emailData.ts](src/components/utils/emailData.ts): funções puras para calcular contadores, filtrar por status, buscar por nome/e-mail e ordenar os registros em cascata por múltiplos critérios.
- [src/components/utils/paginacao.ts](src/components/utils/paginacao.ts): calcula o total de páginas e o intervalo de registros a exibir, a partir da quantidade total, do tamanho de página e da página atual.
- [src/components/utils/clipboard.ts](src/components/utils/clipboard.ts): função utilitária para copiar uma lista de valores para a área de transferência (com fallback para navegadores/contextos sem suporte à Clipboard API).

#### Pasta [src/contexts](src/contexts)

- [src/contexts/ThemeContext.tsx](src/contexts/ThemeContext.tsx): contexto global de tema (claro/escuro). Lê a preferência salva no navegador ou a preferência do sistema operacional, e mantém o tema sincronizado entre o atributo `data-theme` do HTML (usado pelo CSS) e o `localStorage`.

#### Pasta [src/services](src/services)

- [src/services/emailsApi.ts](src/services/emailsApi.ts): camada responsável por enviar o array atualizado de registros para a API local do Vite (`PUT /api/emails`), persistindo a alteração em `data/emails.json`.

#### Pasta [src/types](src/types)

- [src/types/email.ts](src/types/email.ts): definição central dos tipos usados no sistema — o formato de um registro (`EmailRecord`), os status possíveis e sua ordem de prioridade, os status que podem ser definidos manualmente e o formato dos contadores.

#### Pasta [src/scripts](src/scripts) — script de sincronização (roda fora do navegador, via Node)

- [src/scripts/sync.ts](src/scripts/sync.ts): script principal de sincronização. Lê os argumentos da linha de comando, carrega a planilha e o JSON existente, casa os registros por ID, valida e-mails, identifica duplicados, aplica as regras de prioridade de status e grava o JSON atualizado. É o único ponto de entrada para trazer dados novos de uma planilha para o sistema.
- [src/scripts/utils/readSheet.ts](src/scripts/utils/readSheet.ts): leitura de planilhas `.csv` (com detecção automática de delimitador) e `.xlsx`/`.xls`, sempre retornando o mesmo formato de linhas (objetos chave/valor por cabeçalho), independentemente do formato de origem.
- [src/scripts/utils/identifyColumns.ts](src/scripts/utils/identifyColumns.ts): identifica quais colunas da planilha representam ID, Nome e E-mail, comparando os cabeçalhos com listas de nomes conhecidos (ex.: "E-mail", "Aluno – E-mail"). É o arquivo a editar quando uma nova planilha tiver nomes de coluna diferentes dos já suportados.
- [src/scripts/utils/validateEmail.ts](src/scripts/utils/validateEmail.ts): validação sintática de e-mail (regex simples) e normalização (trim + minúsculas) para comparação/deduplicação, usada pelo script de sincronização.

---

## Regras de negócio atuais

- **Status possíveis**: `válido`, `inválido`, `duplicado`, `deletado`, `enviado`.
- **Prioridade de cálculo automático** (da maior para a menor): `enviado > deletado > duplicado > válido/inválido`. Só "duplicado" e "válido/inválido" são de fato recalculados automaticamente — "enviado" e "deletado" só existem por ação manual do usuário.
- **`status_alterado`**: indica que o status foi definido manualmente pelo usuário. Enquanto for `true`, nem a sincronização nem a ação "Restaurar" recalculam aquele registro automaticamente.
- **Validação de e-mail**: apenas uma regex simples de sintaxe (`algo@algo.algo`) — não verifica existência de conta, domínio ou DNS.
- **Duplicados**: dois ou mais registros com o mesmo e-mail normalizado (ignorando maiúsculas/minúsculas e espaços), independentemente do nome.
- **Restrição para enviados**: registros com status "enviado" nunca podem ser excluídos diretamente — uma seleção que os inclua abre o modal de conflito.
- **Regra de seleção**: não é possível selecionar simultaneamente registros "deletados" e "não deletados" na mesma operação.
- **Persistência imediata**: qualquer alteração feita na interface (status, exclusão, restauração) é salva instantaneamente em [data/emails.json](data/emails.json) via a API local do Vite — não existe um botão "Salvar" separado.

---

## Limitações atuais

- Roda apenas localmente: a API de persistência (`/api/emails`) só existe no servidor de desenvolvimento do Vite (`npm run dev`); o build de produção (`npm run build` / `npm run preview`) não tem backend algum.
- Não há banco de dados — tudo é persistido em um único arquivo JSON local.
- A importação de novas planilhas ainda depende do terminal (`npm run sync`); o botão "Importar planilha" na Home existe apenas visualmente, sem funcionalidade.
- Existe uma única planilha/JSON gerenciado por vez (`data/emails.json`); a Home já tem a estrutura visual de múltiplos cards, mas os dados ainda são estáticos (um item fixo).
- A sincronização depende dos nomes de coluna já conhecidos; planilhas com cabeçalhos muito diferentes exigem ajuste manual em `identifyColumns.ts`.
- O sistema não envia e-mails — apenas organiza e prepara os destinatários.

---

## Planos futuros

Com base na visão de longo prazo descrita na seção 9 da [especificação](public/Especificacao_Sistema_Emails_v3.md), os próximos passos naturais do projeto são:

1. **Página inicial dinâmica**: a Home passará a exibir um card para cada planilha realmente importada (hoje é uma lista estática com um item).
2. **Componente único e reutilizável**: `emails.tsx` deixará de apontar para um JSON fixo e passará a carregar qualquer planilha importada, recebendo o conjunto de dados como parâmetro.
3. **Importação via interface**: o botão "Importar planilha" passará a abrir o seletor de arquivos do sistema operacional, permitindo escolher a planilha e definir um nome — substituindo o comando manual `npm run sync`.
4. **Rotas dinâmicas por slug**: cada planilha importada ganhará uma URL própria (ex.: `/emails/:slug`), resolvida em tempo de execução (sem exigir rebuild a cada nova planilha).
5. **Backend e persistência real**: um backend receberá o upload da planilha, executará a sincronização e persistirá os dados em um banco (SQLite/Postgres) ou em armazenamento de arquivos compatível com hospedagem.
6. **Hospedagem**: o sistema deixará de ser apenas local e passará a rodar em um ambiente hospedado (VPS, Render, Railway ou similar), preservando o filesystem/persistência necessária.

---

## Observações úteis

- [data/emails.json](data/emails.json) é sempre a fonte oficial consultada pela interface — não edite manualmente sem necessidade, pois a próxima sincronização ou alteração na tela pode sobrescrever mudanças feitas fora do fluxo normal.
- [data/ibm.csv](data/ibm.csv) é um exemplo real de planilha já usada no processo de sincronização, útil para testar o script sem precisar de uma planilha nova.
- A pasta [dist](dist) é gerada automaticamente por `npm run build` — não deve ser editada manualmente, pois qualquer alteração é perdida no próximo build.

---

## Resumo rápido

Para começar a usar o projeto:

```bash
npm install
npm run dev
```

Para importar/atualizar uma planilha:

```bash
npm run sync -- data/nova-planilha.csv
```

(No PowerShell nativo do Windows, use o comando alternativo descrito na seção "Como sincronizar uma planilha".)
