# Refatoração: Sistema Emails multi-projeto (multi-página) — v2

> Documento de planejamento. Não implementa nada — descreve a demanda, o
> estado atual, o estado alvo e o passo a passo da refatoração, para
> execução posterior.
>
> **v2**: incorpora as decisões tomadas em cima da validação da v1 (todas
> as perguntas em aberto foram fechadas), corrige uma imprecisão sobre o
> modelo de referência (Multiverso) encontrada ao cruzar o plano com o
> código, e adiciona três seções novas ao final: "O que muda com essa
> refatoração?", "Pontos fracos e pontos fortes" e "Planos futuros e
> próximos passos".

---

## 1. Explicação da demanda

Hoje o Sistema Emails só suporta **uma planilha/projeto por vez**: os dados
vivem fixos em `data/emails.json` e são renderizados por uma única página
(`/emails`), com um único card fixo na Home.

A demanda é replicar, no Sistema Emails, o padrão de renderização dinâmica
já usado no projeto Multiverso (`multiverso.riopombavalley`), que resolve
"N cursos" a partir de "N arquivos de dados" sem precisar criar uma página
por curso. Aplicado ao Sistema Emails, isso significa:

1. **Um componente fixo** (`emails.tsx`) que renderiza qualquer projeto,
   sem duplicação de código por planilha.
2. **Importação dinâmica dos dados**: a pasta `data/` passa a ter uma
   subpasta por projeto, e o sistema descobre automaticamente todos os
   projetos existentes (sem precisar registrar cada um manualmente em
   código).
3. **Slug próprio por projeto**, definido no momento da importação, usado
   como nome da pasta e como URL da página.

Esta etapa **não inclui** a implementação do modal de importação em si
(isso já existe como wizard de interface, mas ainda não grava nada em
disco). O objetivo agora é só fazer o sistema suportar **múltiplos
projetos já existentes em disco**, com Home e rotas dinâmicas.

---

## 2. Como o sistema funciona hoje

### 2.1 Dados
- Existe um único arquivo `data/emails.json`, no formato `EmailsData`:
  ```json
  {
    "email": { "titulo": "", "conteudo": "", "atualizado_em": "" },
    "registros": [ { "id": 0, "nome": "", "email": "", "status": "", "status_alterado": false, "last_updated": "" } ]
  }
  ```
- Também existem, soltos na raiz de `data/`, dois CSVs de apoio:
  `data/ibm.csv` e `data/tabela_exemplo.csv` (não referenciados
  diretamente pela aplicação em runtime).

### 2.2 Leitura
- `src/pages/emails.tsx` importa o JSON **estaticamente e de forma fixa**:
  `import emailsJson from '../../data/emails.json'`.
- Não há nenhum mecanismo de descoberta de múltiplos arquivos.

### 2.3 Escrita/persistência
- `src/services/emailsApi.ts` faz `PUT /api/emails` a cada alteração
  (status, exclusão, edição do e-mail etc.), sempre enviando o objeto
  `EmailsData` completo (`{ email, registros }`).
- `vite.config.ts` registra um middleware de dev server
  (`emailsApiPlugin`) que valida esse formato e escreve diretamente em
  `data/emails.json` (caminho fixo, resolvido uma vez em
  `path.resolve(__dirname, 'data/emails.json')`), sem nenhum merge —
  é uma sobrescrita total do arquivo com o que o client mandou.
- Esse middleware só existe quando o servidor Vite está rodando
  (`vite dev` / `vite preview`) — não há backend HTTP separado.

### 2.4 Rotas
- `src/App.tsx` tem apenas duas rotas reais: `/` (Home) e `/emails`
  (página fixa), mais um fallback `*` → Home.

### 2.5 Home
- `src/pages/home.tsx` tem um array estático `planilhas: PlanilhaCard[]`
  com um único item, apontando pra `/emails`, com `titulo` e
  `descricao` fixos no código.

### 2.6 Importação (wizard)
- `ImportWizardModal` e os componentes em `src/components/import/` já
  implementam a interface de 4 etapas (Informações → Mapeamento →
  Definição → Revisão), incluindo os campos **Nome do Projeto** e
  **Nome do Arquivo** (`EstadoImportacao.nomeProjeto` /
  `nomeArquivoSlug`), com sincronização automática via `slugify()` /
  `slugifyDigitando()` (`src/components/import/utils/slugify.ts`).
- Porém, ao final do wizard, **nada é persistido em disco ainda** — é
  só interface, sem gravação real de novos projetos.

### 2.7 Modelo de referência (Multiverso)
- Cada curso é um módulo `.ts` em `src/data/cursos/*.ts`.
- `src/data/index.ts` usa
  `import.meta.glob('./cursos/*.ts', { eager: true })` para descobrir e
  carregar todos os módulos automaticamente, montando
  `CURSOS: { slug, curso }[]`.
- **Correção em relação à v1**: o slug de cada curso **não** vem do nome
  do arquivo/pasta — vem de `toSlug(curso.titulo)`, calculado em
  *runtime* a partir do campo `titulo` dentro do próprio módulo de dados
  (`src/data/index.ts`, linha `slug: toSlug(curso.titulo)`). O nome do
  arquivo (`FundamentosDeIANaNuvem.ts`) é só uma convenção de
  organização — não tem efeito nenhum na URL final. Isso não muda a
  decisão já tomada para o Sistema Emails (seção 3.1 abaixo mantém
  slug = nome da pasta, decidido no wizard), mas era uma imprecisão do
  documento original que valia registrar, já que o pedido original foi
  "replicar o padrão do Multiverso" e os dois mecanismos de slug são,
  de fato, diferentes.
- `App.tsx` gera uma `<Route>` por módulo/curso a partir desse array
  (`CURSOS.flatMap(...)`, uma rota por *módulo* dentro do curso, não uma
  rota por curso), passando os dados já resolvidos por *props* pro
  componente fixo `CourseLesson.tsx`. Há ainda uma rota adicional
  `/:cursoSlug/:numeromodulo?` (redirecionamento para o primeiro módulo)
  e um fallback `*` → `NotFoundCourse`.
- É um site 100% estático (sem escrita em runtime, build via
  `tsc -b && vite build`, deploy na Vercel).
- **Diferença relevante para o Sistema Emails**: o Multiverso tem dois
  níveis (curso → módulo), por isso precisa da rota de redirecionamento.
  O Sistema Emails tem só um nível (projeto), então o equivalente
  correto é mais simples: uma `<Route path="/:slug">` por projeto
  descoberto, sem necessidade de rota de redirecionamento — ver Etapa 4.

---

## 3. Como deve funcionar após a refatoração

### 3.1 Estrutura de dados
```
data/
  projeto-teste/
    emails.json
    sheet.csv
  outro-projeto/
    emails.json
    sheet.csv
```
- Cada subpasta de `data/` é um projeto. O nome da pasta **é** o slug
  (minúsculo, sem acento, com hífen), definido no wizard pelo campo
  "Nome do Arquivo" (`nomeArquivoSlug`) — decisão mantida, mesmo com a
  correção da seção 2.7: aqui o slug é fixo/gravado (definido uma vez no
  wizard), não recalculado em runtime a partir de um título, porque o
  Sistema Emails já tem um campo de slug dedicado e editável no wizard,
  o que o Multiverso não tem.
- `sheet.csv` é mantido apenas como **backup** do arquivo original
  importado — não é lido pela interface em runtime.
- `emails.json` ganha três novos campos no nível raiz — `projeto`,
  `atualizado_em` e `criado_em` — antes de `email`/`registros`:
  ```json
  {
    "projeto": "Nome do projeto",
    "atualizado_em": "2026-07-21T12:00:00.000Z",
    "criado_em": "2026-07-21T12:00:00.000Z",
    "email": { "titulo": "", "conteudo": "", "atualizado_em": "" },
    "registros": [ { "id": 0, "nome": "", "email": "", "status": "", "status_alterado": false, "last_updated": "" } ]
  }
  ```
  - `projeto`: nome de exibição, livre, sem slugificação — decidido no
    wizard pelo campo "Nome do Projeto".
  - `criado_em`: data/hora ISO de quando o projeto foi importado.
    Gravado uma única vez e nunca mais alterado depois.
  - `atualizado_em`: data/hora ISO da última escrita bem-sucedida no
    arquivo (qualquer alteração em `email` ou `registros`). É diferente
    de `email.atualizado_em`, que já existe e marca especificamente a
    última edição do **título/corpo do e-mail** — os dois campos
    coexistem e respondem perguntas diferentes ("quando o projeto como
    um todo mudou pela última vez" vs. "quando o conteúdo do e-mail foi
    editado pela última vez"). Ver decisão de quem grava esse campo na
    Etapa 8.

### 3.2 Descoberta e rotas
- O sistema descobre todos os projetos existentes em `data/*/emails.json`
  automaticamente (padrão `import.meta.glob`, eager), sem precisar de
  registro manual em código.
- Rotas passam a ser dinâmicas, uma por projeto encontrado, gerada por
  `.map()` sobre a lista de projetos descobertos — **no padrão exato do
  Multiverso** (uma `<Route>` por item da lista, e não uma rota genérica
  `/:slug` que resolve o projeto internamente por dentro do componente).
  Como o Sistema Emails só tem um nível (projeto, sem módulos), não há
  necessidade da rota de redirecionamento adicional que o Multiverso tem
  para o segundo nível.
- Existe uma rota de fallback (`*`) que renderiza uma página de
  **NotFound** dedicada quando o slug não corresponde a nenhuma rota
  gerada (comportamento automático do React Router: se nenhuma rota
  gerada bate com o slug da URL, cai direto no fallback — sem lógica
  manual de "achei/não achei" dentro do componente).

### 3.3 Componente fixo
- `emails.tsx` deixa de importar dado fixo e passa a ser um componente
  genérico: recebe os dados do projeto (já resolvidos pela rota, via
  *props* — mesmo padrão do `CourseLesson` no Multiverso) e renderiza
  normalmente, sem saber de onde os dados vieram.

### 3.4 Persistência
- Continua sem backend externo: o middleware do `vite.config.ts`
  continua sendo o mecanismo de escrita, mas passa a aceitar o **slug**
  como parte da rota da API (ex.: `PUT /api/emails/:slug`), resolvendo
  dinamicamente o caminho `data/<slug>/emails.json`, com validação para
  impedir escrita fora da pasta `data/` (proteção básica contra path
  traversal).
- **Decisão sobre como preservar `projeto`/`criado_em` (ponto antes em
  aberto)**: o merge é feito **no servidor (middleware)**, não no
  client. O client (`emailsApi.ts`) continua enviando só o que edita —
  `{ email, registros }` — sem precisar carregar/reenviar `projeto`,
  `criado_em` ou qualquer metadado futuro. O middleware:
  1. Lê o `emails.json` já existente naquele slug.
  2. Valida o corpo recebido (`{ email, registros }`, validação já
     existente).
  3. Monta o objeto final fazendo o merge: mantém `projeto` e
     `criado_em` do arquivo em disco, substitui `email`/`registros`
     pelo que veio na requisição, e define `atualizado_em` como o
     timestamp atual do **servidor** (não confia no relógio do client).
  4. Grava o objeto mesclado.
  - Motivo da escolha (server-side em vez de client-side): ver seção
    "Pontos fracos e pontos fortes" abaixo — em resumo, evita que
    `emails.tsx`/`emailsApi.ts` precisem conhecer e retransmitir campos
    que não editam, o que already resolve a escalabilidade futura da
    seção 3.6 (novos campos de metadado não exigem mudança no client) e
    remove o risco de um bug no front sobrescrever/apagar metadado por
    engano.

### 3.5 Home
- O array estático `planilhas` é substituído pela mesma fonte de dados
  usada nas rotas (`import.meta.glob` sobre `data/*/emails.json`).
- Cada card exibe **apenas o nome do projeto** (campo `projeto`), sem
  descrição — mudança em relação ao card atual, que tem título +
  subtítulo.
- **Ordenação dos cards (ponto antes em aberto)**: a Home ganha um botão
  de ordenação que reaproveita o componente já usado em `emails.tsx`
  para ordenar a tabela (`OrdenacaoPrioridade` + o par
  `TCriterioOrdenacao` / `CRITERIO_ORDENACAO_LABELS` de
  `components/utils/emailData.ts`), mas com um conjunto de critérios
  próprio, específico da Home:
  - `alfabetica` → "Ordem Alfabética" (por `projeto`)
  - `atualizado` → "Última Atualização" (por `atualizado_em`)
  - `criado` → "Data de Criação" (por `criado_em`)
  - **Ponto que ainda precisa ser fechado antes de implementar**: o
    `OrdenacaoPrioridade` original é uma lista de prioridade
    arrastável/multi-critério (o segundo critério só desempata quando o
    primeiro empata) — faz sentido para `emails.tsx`, onde há empates
    reais (vários registros com o mesmo status). Na Home, os três
    critérios (nome, última atualização, data de criação) dificilmente
    empatam entre projetos, então uma lista de prioridade com
    reordenação por arrastar-e-soltar é, na prática, uma seleção única
    "qual critério está no topo" — o resto da lista nunca chega a ser
    usado. Duas leitura possíveis do pedido:
    1. Reaproveitar o componente **tal como é** (dropdown com lista
       arrastável de 3 itens, ▲/▼ inclusos), aceitando que o
       comportamento de cascata/desempate existe mas raramente importa
       na prática — vantagem: zero componente novo, é literalmente o
       mesmo código com um `Record` de labels diferente.
    2. Criar uma variante mais simples do mesmo componente (mesmo visual
       de gatilho + dropdown, mas sem arrastar/▲▼, só clique para
       trocar o critério ativo) — vantagem: interação mais direta para
       um caso de uso que é, de fato, seleção única.
    Recomendação: opção 1, por ser reaproveitamento direto (menor
    esforço, já validado em produção na tabela de e-mails) — mas essa é
    uma escolha de UX que vale confirmar antes de começar a
    implementação, já que muda o componente a ser tocado.
  - Ordenação padrão sugerida ao carregar a Home (não especificada no
    pedido): `alfabetica` — mantém o comportamento hoje implícito do
    `import.meta.glob` (que ordena por path/nome de pasta). Confirmar ou
    trocar antes da implementação.

### 3.6 Slug duplicado
- Fica fora do escopo desta refatoração a validação de slug duplicado no
  wizard — será tratada depois, quando a gravação de novos projetos via
  importação for implementada de fato.

### 3.7 Tratamento de erros
- Mantido exatamente como descrito na v1 (seção 6 da validação): apenas
  slug inexistente → NotFound, e `PUT` para slug sem pasta
  correspondente → rejeitado. Os pontos adicionais levantados na
  validação (JSON malformado quebrando o `eager: true` inteiro, projeto
  sem campo `projeto`, pasta incompleta sem `emails.json`) foram
  conscientemente deixados de fora por decisão do responsável pelo
  projeto — não serão tratados nesta etapa.

---

## 4. O que será feito

1. Migrar a estrutura de `data/` de arquivo único para pasta por
   projeto, migrando o conteúdo atual para `data/projeto-teste/`.
2. Adicionar os campos `projeto`, `atualizado_em` e `criado_em` ao tipo
   `EmailsData` e ao `emails.json` migrado.
3. Criar o mecanismo de descoberta dinâmica dos projetos (glob sobre
   `data/*/emails.json`).
4. Trocar as rotas fixas (`/`, `/emails`) por rotas dinâmicas geradas
   por projeto (`/`, `/:slug` × N, `*` → NotFound), no padrão Multiverso.
5. Adaptar `emails.tsx` para ser um componente genérico, recebendo o
   projeto resolvido via *props* a partir da rota.
6. Adaptar a Home para gerar os cards dinamicamente a partir da mesma
   fonte de dados, exibindo o nome do projeto e um botão de ordenação.
7. Adaptar o middleware de persistência (`vite.config.ts`, com merge
   server-side) e o client (`emailsApi.ts`) para escrever no
   `emails.json` do slug correto.
8. Criar a página de NotFound.

---

## 5. Etapas da refatoração

### Etapa 1 — Migração de dados
- Criar `data/projeto-teste/`.
- Mover o `data/emails.json` atual para `data/projeto-teste/emails.json`,
  adicionando os campos `"projeto": "Projeto Teste"`, `"criado_em"` e
  `"atualizado_em"` (ambos com a data da migração, já que não existe
  histórico anterior) no topo do objeto, nessa ordem.
- Mover `data/tabela_exemplo.csv` para `data/projeto-teste/sheet.csv`
  (renomeado, já que o papel dele agora é o de backup padronizado por
  projeto).
- Remover `data/ibm.csv` (não faz parte da migração).
- Resultado esperado: `data/` passa a conter só a subpasta
  `projeto-teste/`, sem arquivos soltos na raiz.

### Etapa 2 — Tipos
- Atualizar `src/types/email.ts`: adicionar `projeto: string`,
  `atualizado_em: string` e `criado_em: string` à interface
  `EmailsData`, nessa ordem, antes de `email`/`registros`.
- Revisar `EMAIL_CONTEUDO_VAZIO`/valores default relacionados, se algum
  novo "estado vazio" de `EmailsData` precisar existir (ex.: para o
  caso de projeto sem registros ainda).

### Etapa 3 — Descoberta dinâmica dos projetos
- Criar um módulo (ex. `src/data/projetos.ts`, nome a definir na
  implementação) que:
  - Usa `import.meta.glob<EmailsData>('../../data/*/emails.json', { eager: true })` (ajustar caminho relativo conforme localização final do arquivo).
  - Extrai o slug de cada projeto a partir do nome da pasta no path do
    glob (não do campo `projeto`, que é só o nome de exibição).
  - Exporta algo equivalente ao `CURSOS` do Multiverso, ex.:
    `PROJETOS: { slug: string; dados: EmailsData }[]`.

### Etapa 4 — Rotas dinâmicas
- Reescrever `src/App.tsx` no padrão do Multiverso: gerar uma
  `<Route path="/:slug">` por item de `PROJETOS`, via `.map()`
  (decisão fechada — mesmo padrão do `CURSOS.flatMap(...)` do
  Multiverso, adaptado para um único nível em vez de dois).
  - Rota raiz `/` continua sendo a Home.
  - Rota fallback `*` → página de NotFound (nova).

### Etapa 5 — Componente `emails.tsx` genérico
- Remover o `import emailsJson from '../../data/emails.json'` fixo.
- O componente passa a receber o projeto (slug + `EmailsData` já
  resolvidos) via *props*, entregues pelo componente/rota que faz a
  resolução (equivalente ao papel do `App.tsx` + `CourseLesson` no
  Multiverso).
- Toda a lógica interna de estado (`registros`, `email`, filtros,
  paginação etc.) continua igual — a única mudança é a origem do dado
  inicial, que deixa de ser um import fixo e passa a ser uma prop.

### Etapa 6 — Página de NotFound
- Criar `src/pages/notFound.tsx` (nome a definir), inspirada no
  `NotFoundCourse.tsx` do Multiverso: mensagem simples informando que o
  projeto não foi encontrado, com link de volta para a Home.

### Etapa 7 — Home dinâmica
- Substituir o array estático `planilhas` em `src/pages/home.tsx` pela
  leitura de `PROJETOS` (Etapa 3).
- Cada card passa a exibir apenas `dados.projeto` (nome do projeto),
  sem subtítulo/descrição — remover o campo `descricao` do card (o tipo
  `PlanilhaCard` também deixa de precisar dele).
- O link do card aponta para `/${slug}`.
- Adicionar um controle de ordenação na Home, reaproveitando
  `OrdenacaoPrioridade`/`emailData.ts` com um novo conjunto de critérios
  (`alfabetica` / `atualizado` / `criado` — ver seção 3.5 para o ponto
  ainda em aberto sobre qual variante do componente usar) e aplicar a
  ordenação sobre `PROJETOS` antes de renderizar os cards.

### Etapa 8 — Persistência por projeto
- Atualizar `vite.config.ts`:
  - Middleware passa a escutar em `/api/emails/:slug` (ou path
    equivalente que carregue o slug), extraindo o slug da URL da
    requisição.
  - Resolver o caminho de escrita como
    `path.resolve(__dirname, 'data', slug, 'emails.json')`.
  - Validar que o slug recebido corresponde a uma pasta já existente
    dentro de `data/` antes de escrever (evita criar pastas novas por
    essa via e evita escrita fora de `data/`).
  - Manter a validação já existente do formato do corpo recebido
    (`{ email, registros }`).
  - **Fazer o merge no servidor** (decisão fechada — ver 3.4): ler o
    `emails.json` atual do slug, preservar `projeto` e `criado_em`,
    substituir `email`/`registros` pelo corpo recebido, gravar
    `atualizado_em` com o timestamp atual do servidor, e só então
    escrever o arquivo mesclado.
- Atualizar `src/services/emailsApi.ts`:
  - `salvarEmails` passa a receber o `slug` do projeto atual (via
    parâmetro da função) e montar a URL `/api/emails/${slug}`.
  - O corpo enviado continua sendo só `{ email, registros }` — não
    precisa incluir `projeto`/`criado_em`/`atualizado_em`, já que o
    merge é responsabilidade do servidor.
- Atualizar `emails.tsx` para passar o slug (recebido via prop, Etapa 5)
  em toda chamada a `salvarEmails`.

### Etapa 9 — Ajustes finos
- Revisar `src/components/Header.tsx` e qualquer outro componente que
  hoje assuma implicitamente "há um único projeto" (ex.: textos fixos,
  export de PDF/planilha que talvez use nome de arquivo fixo) e ajustar
  para usar o nome do projeto atual, se aplicável.
- Conferir `.gitignore`/build para garantir que a nova estrutura de
  pastas dinâmica de `data/` não quebre nada no `vite build`/`preview`.

---

## 6. Como validar a refatoração

1. **Home**
   - Deve mostrar 1 card: "Projeto Teste" (sem subtítulo), apontando
     para `/projeto-teste`.
   - Criar manualmente uma segunda pasta de teste em
     `data/segundo-projeto/emails.json` (com `projeto`, `criado_em`,
     `atualizado_em`, `email` e `registros` mínimos) e confirmar que um
     segundo card aparece na Home automaticamente, sem alterar nenhum
     código.
   - Testar o botão de ordenação nos três critérios (alfabética, última
     atualização, data de criação) com os dois projetos de teste tendo
     valores diferentes em cada campo, e confirmar que a ordem dos
     cards muda conforme o critério escolhido.

2. **Rotas**
   - Acessar `/projeto-teste` diretamente pela URL e confirmar que
     renderiza a tabela de e-mails correta (mesmos dados de
     `data/projeto-teste/emails.json`).
   - Acessar um slug inexistente (ex. `/nao-existe`) e confirmar que
     cai na página de NotFound.

3. **Isolamento entre projetos**
   - Com os dois projetos de teste criados, alterar o status de um
     registro em `/projeto-teste` e confirmar que:
     - `data/projeto-teste/emails.json` é atualizado corretamente;
     - `data/segundo-projeto/emails.json` permanece intocado.
   - Repetir o teste no sentido inverso.

4. **Persistência**
   - Confirmar que os campos `projeto` e `criado_em` nunca são apagados
     por um `PUT` que só altera `email`/`registros`.
   - Confirmar que `atualizado_em` é atualizado pelo servidor a cada
     `PUT` bem-sucedido, com o timestamp do servidor (não o do client).
   - Tentar (manualmente, via ferramenta HTTP) enviar um `PUT` para um
     slug que não tem pasta correspondente em `data/` e confirmar que a
     API rejeita (não deve criar pasta nova por essa via).

5. **Regressão funcional**
   - Rodar todos os fluxos que já existiam (filtros, busca, paginação,
     seleção em massa, exclusão com conflito, duplicados, edição do
     e-mail, export) dentro de um projeto e confirmar que nada quebrou
     em relação ao comportamento atual de página única.

6. **Build**
   - Rodar `npm run build` e `npm run preview` e confirmar que a
     descoberta dinâmica de projetos (glob) funciona também no bundle
     de produção, não só no dev server (a leitura é estática/build-time;
     só a escrita depende do dev server).

---

## 7. O que muda com essa refatoração?

**Para quem usa o sistema:**
- A Home deixa de mostrar um único card fixo e passa a listar todos os
  projetos existentes em `data/`, com um controle para reordenar os
  cards por nome, última atualização ou data de criação.
- Cada projeto ganha sua própria URL (`/nome-do-projeto`), em vez de
  todo mundo cair sempre em `/emails`. URLs inválidas levam a uma
  página de "não encontrado" dedicada, em vez de cair de volta na Home
  silenciosamente.
- Nada muda dentro da tela de um projeto já aberto: filtros, busca,
  paginação, edição de e-mail, exportação — tudo continua igual.

**Para quem mexe no código:**
- `emails.tsx` deixa de ser "a página de e-mails" e passa a ser "o
  template de qualquer projeto de e-mails" — só recebe dados por props,
  não sabe mais de onde eles vieram.
- Adicionar um novo projeto deixa de exigir mudança de código: basta
  existir uma pasta nova em `data/<slug>/` com `emails.json` no formato
  certo. Nenhuma rota, nem card, precisa ser registrado manualmente.
- O contrato entre client e servidor muda de "um arquivo fixo" para
  "um arquivo por slug", e o servidor passa a ser o responsável por
  proteger os metadados do projeto (`projeto`, `criado_em`) — o client
  não precisa mais conhecê-los para poder salvar.
- `data/` passa a ter uma estrutura fixa (pasta por projeto) em vez de
  arquivos soltos na raiz.

---

## 8. Pontos fracos e pontos fortes

### Pontos fortes
- **Sem duplicação de código por projeto**: um único componente
  atende N projetos, mesmo padrão já validado em produção no
  Multiverso.
- **Descoberta automática**: novo projeto em disco = novo card + nova
  rota, sem tocar em código — reduz o custo de adicionar projetos no
  futuro (inclusive quando a importação real for implementada).
- **Sem backend novo**: continua usando o middleware de dev server já
  existente, só generalizado por slug — não introduz infraestrutura
  nova nem dependências.
- **Metadado protegido no servidor**: colocar o merge (`projeto`,
  `criado_em`, `atualizado_em`) no middleware, em vez de no client,
  isola essa responsabilidade num único lugar. Isso significa que
  campos futuros de metadado (seção "Escalabilidade futura" da v1 —
  descrição, cor, ícone) podem ser adicionados sem exigir mudança no
  client toda vez.
- **Compatível com o wizard já existente**: os campos "Nome do
  Projeto" e "Nome do Arquivo" do `ImportWizardModal` já mapeiam
  diretamente para `projeto` e para o nome da pasta/slug — quando a
  gravação real for implementada, o encaixe é direto.

### Pontos fracos / riscos aceitos conscientemente
- **`eager: true` é uma faca de dois gumes**: como a leitura é
  estática (build-time), um único `emails.json` corrompido/malformado
  pode quebrar o build inteiro, não só aquele projeto — risco já
  identificado na validação e conscientemente não tratado nesta etapa
  (seção 3.7).
- **Novo projeto exige restart do dev server**: como o glob roda em
  build-time, criar uma pasta nova manualmente em `data/` não aparece
  na Home "ao vivo" sem reiniciar o `vite dev` — isso só deixa de ser
  um problema real quando a importação gravar o projeto via
  requisição HTTP e o próprio fluxo (fora de escopo aqui) cuidar de
  refletir isso na tela.
- **Sem multiusuário/concorrência real**: o middleware faz
  leitura-depois-escrita (ler o arquivo, mesclar, gravar) sem lock —
  aceitável para um dev server local de uso único, mas não seria
  seguro se duas abas/usuários escrevessem no mesmo projeto ao mesmo
  tempo.
- **Nenhum fluxo de edição/exclusão de projeto**: depois de criado, um
  projeto só pode ser renomeado ou apagado manualmente pelo sistema de
  arquivos — não há tela para isso (já sinalizado na v1, mantido em
  aberto).
- **`sync.ts` fica quebrado**: continua assumindo caminho fixo
  (`data/emails.json`) e não foi adaptado nesta refatoração — ver
  seção 9.
- **Ordenação da Home com componente "sobre-dimensionado"**: reaproveitar
  a lista de prioridade arrastável para 3 critérios que raramente
  empatam entre si é um encaixe funcional, mas não o desenho mais
  simples possível para o caso de uso — ver nota na seção 3.5.

---

## 9. Planos futuros e próximos passos

Itens que ficam explicitamente fora do escopo desta refatoração, mas que
são a continuação natural do trabalho:

- **Gravação real via o modal de importação**: o wizard
  (`ImportWizardModal` e etapas) continua sendo só interface; ele ainda
  não cria a pasta `data/<slug>/`, nem grava `emails.json`/`sheet.csv`
  no disco. É a próxima etapa natural depois desta refatoração, e já
  deve nascer gravando `projeto`, `criado_em` e `atualizado_em` no
  formato definido aqui.
- **Validação de slug duplicado**: precisa ser implementada no wizard
  quando a gravação real de novos projetos for feita (impedir criar um
  projeto com nome/slug já existente em `data/`).
- **Edição de metadados do projeto após a importação**: hoje não há
  tela para renomear um projeto já importado (mudar `projeto` ou o
  slug/pasta depois de criado) — decidir se isso é necessário e como
  tratar a renomeação da pasta e possíveis links quebrados.
- **Exclusão de projeto**: não há fluxo para remover um projeto (apagar
  a pasta) pela interface — hoje só seria possível manualmente pelo
  sistema de arquivos.
- **Escala/paginação da Home**: com muitos projetos, a Home pode
  precisar de busca/paginação própria — fora de escopo por ora, já que
  hoje só teremos poucos projetos de teste.
- **Correção de `src/scripts/sync.ts`**: continua assumindo um único
  `data/emails.json` fixo (`defaultJsonPathFor` sempre retorna
  `'data/emails.json'`). Vai quebrar/ficar inútil com a nova estrutura
  de pastas — precisa ser corrigido numa etapa futura, quando o fluxo
  de importação/sincronização via terminal for revisitado.
- **Campos de metadado reservados**: quando fizer sentido, avaliar
  reservar espaço no schema de `emails.json` para novos metadados
  (descrição, cor, ícone) de uma vez, em vez de migrar todos os
  projetos existentes a cada novo campo — já facilitado pela decisão
  desta v2 de o servidor ser o único responsável por preservar
  metadado no merge.
- **Tratamento de erro mais robusto**: os casos deixados de fora na
  seção 3.7 (JSON malformado quebrando o build, `emails.json` sem
  campo `projeto`, pasta incompleta) seguem como candidatos para uma
  rodada futura de hardening, quando o volume real de projetos e
  usuários justificar o investimento.
