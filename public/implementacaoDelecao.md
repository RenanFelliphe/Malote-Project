# Implementação — Soft Delete de Projetos + Lixeira

## 1. Contexto desta revisão

Hoje não existe nenhuma forma, pela interface, de remover um projeto
inteiro do sistema — o item "Deletar planilha" no dropdown do `Header` já
está desenhado visualmente, mas permanece `disabled`, com o texto
"Em breve". A única forma de remover um projeto é manualmente no sistema
de arquivos.

**O que essa demanda resolve:** completa o ciclo de vida de um projeto
(criar → usar → remover), que fica incompleto assim que a Importação
(`implementacaoImportacao.md`) entra em produção — sem uma saída, projetos
de teste ou planilhas descartadas só se acumulam.

**A solução**, resumida: deletar um projeto nunca é destrutivo de
imediato — a pasta inteira é movida de `data/active/<slug>` para
`data/trash/`, com um esquema de nomeação que evita colisão entre
exclusões repetidas do mesmo slug ao longo do tempo. Uma sidebar na Home
(usando a biblioteca `vaul` para o mecanismo de abrir/fechar/sobrepor)
lista os itens da lixeira, com busca, seleção múltipla, restauração e
exclusão permanente. Itens não restaurados em 30 dias são removidos
definitivamente de forma automática. Um caso de conflito — restaurar um
projeto cujo slug foi "tomado" por um projeto novo enquanto o antigo estava
na lixeira — tem um modal dedicado de resolução.

**Pré-requisito:** `implementacaoImportacao.md` concluída até a Etapa 1
(reorganização `data/active/` já em vigor).

## 2. Decisões de escopo

- **`data/trash/<slug>--<timestamp>`, não `data/trash/<slug>`.** O nome
  físico da pasta carrega o timestamp da exclusão para nunca colidir,
  mesmo quando o mesmo slug é deletado mais de uma vez ao longo do tempo
  (deletar → reimportar com o mesmo nome → deletar de novo). O slug
  "de verdade" passa a viver como campo dentro do próprio `emails.json`
  (`EmailsData.slug`, novo — hoje esse dado não é persistido em lugar
  nenhum, só existe como nome de pasta). Ao restaurar, a pasta volta a se
  chamar `data/active/<slug>` (o slug original, lido do JSON, não o nome
  físico com timestamp).
- **`EmailsData` ganha dois campos novos:** `slug` (identidade do projeto,
  persistida a partir do momento da primeira exclusão) e `deletado_em`
  (ISO, gravado no momento do soft delete) — ambos opcionais/ausentes em
  projetos que nunca passaram pela lixeira.
- **Todo endpoint de deleção/restauração opera em lote desde o início**
  (`{ slugs: string[] }`), mesmo para os casos de uso individuais (Header
  da página, exclusão avulsa por item na sidebar) — evita duas rotas
  fazendo a mesma coisa.
- **Expiração de 30 dias é oportunista, não agendada.** Sem processo de
  longa duração nesta fase local, a varredura/expurgo de itens vencidos
  acontece a cada chamada de listagem da lixeira (`GET /api/lixeira`) —
  decisão consciente de aceitar um `GET` com efeito colateral, documentada
  aqui para não parecer descuido.
- **Sidebar via `vaul`, não componente 100% do zero.** Única dependência
  nova desta revisão — declara suporte oficial a React 19 nas
  `peerDependencies`, é unstyled por padrão (nenhum tema próprio para
  sobrescrever), estilizada inteiramente com as variáveis já existentes em
  `index.css`. Cobre de fábrica: sobreposição sem empurrar layout,
  fechamento por clique fora e por Esc, foco/acessibilidade básica — sem
  precisar reimplementar isso à mão (diferente do `Dialog.tsx` do projeto,
  que já implementa tudo isso manualmente para modais centrais, mas não
  para uma faixa lateral).
- **Conflito de restauração resolvido num único modal, para os dois
  lados.** Reaproveita `ConflictDialog` (já existente) com um conteúdo
  novo: dois campos de slug editáveis (o projeto ativo e o da lixeira),
  validado em tempo real contra três conjuntos — os slugs ativos, os
  demais slugs da lixeira, e o valor do outro campo do mesmo modal — para
  não resolver um conflito criando outro.

> ## ⚠️ Regra de entrega a cada etapa — leia antes de começar
>
> **A cada etapa implementada, a entrega deve ser um único ZIP contendo
> *todos* os arquivos alterados desde a Etapa 1 desta revisão até a etapa
> atual — não apenas os da etapa corrente.**
>
> **O ZIP também deve incluir todos os "Arquivos-fonte necessários"
> listados em qualquer etapa até aqui, mesmo os que nunca chegaram a ser
> alterados.** Uma vez que um arquivo apareceu em algum ZIP (seja como
> alterado, seja como fonte de referência), ele continua aparecendo em
> todos os ZIPs seguintes até o fim desta revisão — isso evita ter que
> reenviar manualmente o mesmo arquivo toda vez que ele volta a ser
> necessário, mas não foi modificado na etapa mais recente.
>
> **Este arquivo de plano (`implementacaoDelecao.md`) também deve ir
> dentro do ZIP de cada etapa**, atualizado para refletir o progresso
> (etapas concluídas marcadas com "✅ concluída" no título, notas de
> execução preenchidas, e qualquer ajuste de rota registrado caso um
> diagnóstico durante a implementação mude uma decisão já tomada aqui).

## 3. Divisão em etapas

Parte A (Etapas 1–5) cobre o soft delete em si — depende só de
`implementacaoImportacao.md` (Etapa 1) já concluída. Parte B (Etapas 6–10)
é a Lixeira propriamente dita e depende da Parte A completa (precisa que
projetos já cheguem a `data/trash/` para ter o que listar/restaurar).

### Parte A — Soft Delete

### Etapa 1 — Estrutura da Lixeira e esquema de nomeação (✅ concluída)

**O que fazer:** confirmar `data/trash/` criada. Adicionar `slug?: string`
e `deletado_em?: string` a `EmailsData` (`src/types/email.ts`). Documentar
em comentário, junto do tipo, a regra: o nome físico da pasta em
`data/trash/` carrega timestamp (`<slug>--<timestamp>`), mas a identidade
real do projeto é o campo `slug` dentro do próprio JSON.

**Arquivos alterados:** `src/types/email.ts`.

**Arquivos-fonte necessários:** nenhum adicional.

**Notas de execução:** `data/trash/` criada (com `.gitkeep`, já que a pasta
começa vazia e não seria versionada de outra forma). `EmailsData` ganhou
os dois campos opcionais, com o comentário do tipo estendido para explicar
o esquema de nomeação com timestamp e a distinção entre nome físico da
pasta e slug persistido no JSON. Pré-requisito confirmado: `data/active/`
já existe e está em uso (`implementacaoImportacao.md` Etapa 1 já em vigor).
Nenhum ajuste de rota necessário nesta etapa.

### Etapa 2 — Endpoint `DELETE /api/projetos` (✅ concluída)

**O que fazer:** novo handler em `vite.config.ts`, `DELETE /api/projetos`,
corpo `{ slugs: string[] }`. Para cada slug: validar existência em
`data/active/<slug>`; ler `emails.json`, injetar `slug` (o próprio) e
`deletado_em` (timestamp atual); gravar; mover a pasta inteira para
`data/trash/<slug>--<timestamp>` (`fs.renameSync`). Cada slug tratado
independentemente — falha em um não deve impedir os demais. Resposta
resume sucesso/falha por item.

**Arquivos alterados:** `vite.config.ts`.

**Arquivos-fonte necessários:** `src/types/email.ts`.

**Notas de execução:** implementado dentro do `projetosApiPlugin` já
existente (mesma rota `/api/projetos`, agora tratando `DELETE` além de
`POST`) em vez de um plugin novo — evita duplicar `activeDirectory`,
`ApiError` e `slugEhSeguro`, já compartilhados no arquivo. Novo
`trashDirectory` (`data/trash/`, criado com `recursive: true` caso ainda
não exista no momento da primeira exclusão). O timestamp do nome físico da
pasta (`<slug>--<timestamp>`) é o mesmo `new Date().toISOString()` gravado
em `deletado_em`, só com `:`/`.` substituídos por `-` (caracteres inválidos
em nomes de pasta no Windows). Resposta usa `207 Multi-Status` quando há
falha parcial, `200` quando todos os slugs são processados com sucesso —
formato `{ ok, resultados: { slug, ok, error? }[] }`. Nenhum serviço no
client ainda consome este endpoint (isso é a Etapa 3); verificado apenas
com `tsc -b` (sem erros) nesta etapa. Nenhum ajuste de rota necessário.

### Etapa 3 — Deleção individual (Header da página do projeto) (✅ concluída)

**O que fazer:** em `Header.tsx`, habilitar "Deletar planilha" quando
`slug`/`registros` estão presentes (contexto de projeto). Ao clicar, abre
`ConfirmDialog` com o texto *"Tem certeza que deseja deletar a planilha
atual? Essa ação não pode ser desfeita!"*. Ao confirmar, chama
`deletarProjetos([slug])` (novo serviço) e navega para `/` em sucesso.

**Arquivos alterados:** `src/components/Header.tsx`,
`src/services/projetosApi.ts` (nova função `deletarProjetos`),
`src/index.css` (ajuste de rota: nova classe `erro-salvamento-header` e
`position: relative` em `.app-header`, não previstos no plano original —
necessários para exibir o erro de exclusão sem quebrar o layout flex do
header).

**Arquivos-fonte necessários:** `src/components/ConfirmDialog.tsx`,
`src/pages/emails.tsx`.

**Notas de execução:** `deletarProjetos(slugs: string[])` sempre envia o
lote completo para `DELETE /api/projetos` (Etapa 2) e devolve o array
`resultados` do servidor sem interpretá-lo — quem chama decide como tratar
cada item; aqui, com um lote de um único slug, o item é tratado como a
falha/sucesso da própria ação (erro lançado com a mensagem do servidor se
`ok: false`). Reaproveitado tal qual pela Etapa 5 (deleção em lote da
Home), que consome o array completo em vez de só o primeiro item. O botão
"Deletar planilha" fica habilitado com `slug` E `registros` presentes (não
só `registros`, diferente de "Editar e-mail"/"Exportar planilha") — sem
`slug` não há o que passar para `deletarProjetos`, mesmo que teoricamente
`registros` já implique um projeto aberto no fluxo atual. Falha na exclusão
(rede ou item reportado como não-ok) mantém o usuário na página e mostra a
mensagem do servidor num toast (`erro-salvamento-header`, nova classe)
ancorado sob a barra do header — reaproveita a cor/estilo de
`.erro-salvamento` já usada em outros modais, mas posicionado como overlay
(`position: absolute`) em vez de filho do flex row, já que `.app-header`
só esperava logo/nav/copiar/config como itens diretos. Texto de
confirmação ("não pode ser desfeita") mantido literal conforme o plano,
mesmo a operação sendo tecnicamente reversível pela Lixeira (Parte B) —
não ajustado nesta etapa. Verificado com `tsc -b` e `eslint` (sem erros);
sem teste manual do fluxo completo (servidor dev não executado nesta
sessão).

### Etapa 4 — Modo de seleção múltipla na Home (✅ concluída)

**O que fazer:** novo estado em `home.tsx`: `modoSelecaoAtivo`,
`slugsSelecionados: Set<string>`. "Deletar planilha" no `Header`, quando
renderizado na Home, ativa o modo de seleção em vez de abrir modal direto
(via callback nova). Cada card ganha checkbox sobreposta (reaproveitando
`CheckboxCustomizado`); clique no card, nesse modo, alterna seleção em vez
de navegar. Barra de ação fixa com contagem + "Cancelar"/"Deletar".

**Arquivos alterados:** `src/pages/home.tsx`,
`src/components/Header.tsx` (prop de callback nova).

**Arquivos-fonte necessários:** `src/components/CheckboxCustomizado.tsx`,
`src/index.css`.

**Notas de execução:** callback nova é `onAtivarSelecaoDelecao?: () => void`
— quando presente (só passada por `home.tsx`), o clique em "Deletar
planilha" chama esse callback em vez do fluxo direto da Etapa 3
(`abrirConfirmarDelecao`); a condição de `disabled` do botão também passa a
considerar essa prop, já que na Home não há `slug`/`registros`. Fora do
modo de seleção, cada card continua sendo um `<Link>` normal (navegação
preservada); dentro do modo, vira um `<div role="button" tabIndex={0}>`
com `onClick`/`onKeyDown` (Enter/Espaço) próprios — evitado aninhar a
`<label>` do `CheckboxCustomizado` dentro de um elemento nativamente
clicável (`<button>`), então o clique na checkbox usa `stopPropagation`
para não disparar o toggle do card duas vezes. Texto do checkbox é
só leitor de tela (`.sr-only`, já existente). O botão "Deletar" da barra
de ação existe mas fica desabilitado ("Em breve") — a confirmação e a
chamada real a `deletarProjetos` (Etapa 3) ficam para a Etapa 5, como o
próprio plano já antecipa. `src/index.css` recebeu as classes novas
`card-pagina-selecionavel`/`.selecionado`, `card-pagina-checkbox` e
`barra-selecao-delecao*`; botões da barra reaproveitam
`dialog-botao-cancelar`/`dialog-botao-deletar`, já genéricas o bastante.
Verificado com `tsc -b` e `eslint` (sem erros); sem teste manual do fluxo
completo (servidor dev não executado nesta sessão).

### Etapa 5 — Confirmação e deleção em lote (✅ concluída)

**O que fazer:** botão "Deletar" da barra de ação (Etapa 4) abre
`ConfirmDialog` com texto dinâmico: *"Tem certeza que deseja deletar todas
as N planilhas selecionadas? Essa ação não pode ser desfeita!"*. Ao
confirmar, chama `deletarProjetos([...slugsSelecionados])` (mesmo serviço
da Etapa 3); em sucesso, sai do modo de seleção e recarrega a página.

**Arquivos alterados:** `src/pages/home.tsx`.

**Arquivos-fonte necessários:** `src/components/ConfirmDialog.tsx`,
`src/services/projetosApi.ts`.

**Notas de execução:** texto de confirmação ajustado para singular quando
só 1 planilha está selecionada ("a planilha selecionada", sem "todas as 1
planilhas") — variação não coberta literalmente pelo plano, mas natural já
que o modo de seleção permite escolher um único item. "Em sucesso" foi
implementado como `window.location.reload()`, não só saída do modo de
seleção via estado local: `PROJETOS` (`src/data/projetos.ts`) vem de um
`import.meta.glob({ eager: true })` resolvido uma única vez no
carregamento do módulo, então um `setModoSelecaoAtivo(false)` sozinho
deixaria os cards recém-deletados visíveis até a próxima navegação —
reload é o que de fato reflete a lista atualizada, e como consequência já
"sai do modo de seleção" (o componente é remontado do zero). Falha na
exclusão (rede, ou algum slug do lote reportado como não-ok) mantém o
usuário no modo de seleção e mostra a mensagem do servidor num toast fixo
(`erro-selecao-lote`, nova classe, mesma lógica de posicionamento do toast
do Header na Etapa 3) acima da barra de ação, sem fechar/perder a seleção
atual. Verificado com `tsc -b` e `eslint` (sem erros); sem teste manual do
fluxo completo (servidor dev não executado nesta sessão). Com isso, a
Parte A (Soft Delete) do plano está completa.

### Parte B — Lixeira

### Etapa 6 — Endpoint `GET /api/lixeira` (✅ concluída)

**O que fazer:** novo handler `GET /api/lixeira`: varre
`data/trash/*/emails.json`, calcula `diasRestantes = 30 -
Math.floor((Date.now() - new Date(deletado_em).getTime()) / 86400000)`
para cada item. Itens com `diasRestantes <= 0` são removidos
definitivamente (`fs.rmSync`) antes de montar a resposta. Resposta:
`{ slug, projeto, deletado_em, diasRestantes, totalRegistros }[]`.

**Arquivos alterados:** `vite.config.ts`.

**Arquivos-fonte necessários:** `src/types/email.ts`.

**Notas de execução:** implementado como plugin dedicado
(`lixeiraApiPlugin`) em vez de dentro de `projetosApiPlugin` — rota
diferente (`/api/lixeira`, não `/api/projetos`) e sem nenhum verbo em
comum, então não fazia sentido reaproveitar o mesmo middleware desta vez
(diferente da Etapa 2, que estendeu `/api/projetos` já existente). Cada
item lido de forma defensiva: pasta com `emails.json` corrompido/ilegível
ou sem `deletado_em` é ignorada da listagem (não derruba a rota inteira
por causa de um item problemático) — nenhum dos dois deveria acontecer no
fluxo normal (todo item chega à lixeira via a Etapa 2, que sempre grava
`deletado_em`), mas não há necessidade de propagar esse tipo de falha ao
client. `slug` da resposta vem do campo do JSON (identidade real do
projeto); o nome físico da pasta só é usado como fallback caso esse campo
esteja ausente por algum motivo fora do fluxo normal. Testado manualmente
nesta etapa (não só `tsc`/`eslint`): subi o servidor dev, criei duas
pastas falsas em `data/trash/` (uma com `deletado_em` de "agora", outra
com 30+ dias no passado) e confirmei via `curl` que a rota devolve só o
item válido (`diasRestantes: 30`) e expurga a pasta expirada do disco —
fixtures de teste removidas depois, `data/trash/` de volta só com
`.gitkeep`. Verificado também com `tsc -b` e `eslint` (sem erros).

### Etapa 7 — Sidebar da lixeira (UI, sem ações ainda) (✅ concluída)

**O que fazer:** instalar `vaul`. Novo
`src/components/LixeiraSidebar.tsx`, usando `Drawer` do `vaul` com
`direction="left"`. Botão flutuante em `home.tsx`, canto inferior esquerdo
(espelhando `EmojiPickerFlutuante`, que fica no inferior direito),
alternando `sidebarLixeiraAberta`, com badge de contagem. Dentro da
sidebar: busca local (filtra por `projeto`) + lista dos itens (nome, data
de exclusão formatada, `diasRestantes`), consumindo `GET /api/lixeira`
(Etapa 6) — ainda sem restaurar/excluir funcional.

**Arquivos alterados:** `package.json` (dependência `vaul`),
`src/components/LixeiraSidebar.tsx` (novo), `src/pages/home.tsx`,
`src/index.css`.

**Arquivos-fonte necessários:** `src/components/EmojiPickerFlutuante.tsx`,
`src/components/CheckboxCustomizado.tsx`,
`src/components/utils/emailData.ts`.

**Notas de execução:** `vaul` instalado como `^1.1.2` (release que passou a
declarar React 19 nas `peerDependencies`, conforme a seção 2 do plano
previa). Nenhuma rota nova consumida ainda além de `GET /api/lixeira`
(Etapa 6); a chamada é feita diretamente dentro de `LixeiraSidebar.tsx`
(`fetch` cru), sem um `lixeiraApi.ts` ainda — esse serviço só nasce na
Etapa 8, quando `POST /api/lixeira/restaurar` também precisar de um lugar
para viver. Botão flutuante segue o mesmo raciocínio visual de
`.email-emoji-flutuante-gatilho` (dimensões, sombra, borda), mas como
`position: fixed` em relação à viewport em vez de `absolute` a um
container local — a Home não tem um elemento tipo `.modal-email-conteudo`
servindo de âncora. Contagem do badge não é responsabilidade só da
sidebar: `LixeiraSidebar` busca a lista ao montar (`useEffect` sem
dependências de `aberto`) e novamente toda vez que `aberto` vira `true`
(dado que `diasRestantes` muda com o tempo e o expurgo de itens vencidos
é oportunista, Etapa 6), reportando o total via `onContagemAtualizada` —
assim o botão em `home.tsx` já nasce com o número certo, sem esperar o
primeiro clique. Tipo `ItemLixeira` (espelhando o item de resposta de
`GET /api/lixeira`) foi declarado local a `LixeiraSidebar.tsx`, não em
`src/types/email.ts`: não é um formato persistido, é só a forma da
resposta desta rota. Busca local reaproveita o mesmo padrão de
`buscar()` (`utils/emailData.ts`, Etapa 3 da refatoração de tabela) —
`trim().toLowerCase().includes()` — adaptado para o único campo relevante
aqui (`projeto`, já que a lixeira não tem "nome"/"e-mail" por registro).
Ajuste não previsto literalmente no plano: badge visual de "urgência"
(fundo/texto `--color-warning`) para itens com `diasRestantes <= 5`, só
para dar destaque visual a itens perto da expiração — não muda nenhum
dado ou contrato de API, é só estilo; o texto sempre mostra o número
exato de dias independente da cor. `Drawer.Description` do `vaul`
reaproveitado como o próprio subtítulo visível da sidebar (não como texto
`.sr-only`), já que o texto explicativo ("fica aqui por 30 dias...") é
útil visualmente, não só para leitor de tela. Verificado com `tsc`
(isolado, sem os demais arquivos do projeto completo que não fazem parte
de nenhum ZIP até aqui — nenhum erro nos arquivos desta etapa); sem
`eslint` (config não incluída nos arquivos entregues) nem teste manual em
navegador (servidor dev não executado nesta sessão) — pendente confirmar
visualmente o comportamento do `Drawer` (`direction="left"`, overlay,
fechamento por clique fora/Esc) na próxima oportunidade com o projeto
completo.

### Etapa 8 — Seleção múltipla + restauração (caminho feliz) (✅ concluída)

**O que fazer:** checkbox por item na sidebar + botão "Restaurar"
(individual e em lote, via barra de seleção interna). Novo endpoint
`POST /api/lixeira/restaurar`, corpo `{ slugs: string[] }`: localizar cada
pasta em `data/trash/` pelo campo `slug` interno (não pelo nome físico);
se `data/active/<slug>` não existir, mover de volta para
`data/active/<slug>` (nome original, sem timestamp) e limpar
`deletado_em`; se existir, não restaura — resultado desse item marcado
como conflito (dados completos dos dois lados, para a Etapa 9 usar sem
precisar de uma segunda chamada).

**Arquivos alterados:** `src/components/LixeiraSidebar.tsx`,
`vite.config.ts`, `src/services/lixeiraApi.ts` (novo).

**Arquivos-fonte necessários:** `src/types/email.ts`.

**Notas de execução:** `POST /api/lixeira/restaurar` implementado dentro do
`lixeiraApiPlugin` já existente (mesmo prefixo de montagem `/api/lixeira`,
que o Connect já usa para stripar o path — `req.url` chega como `/restaurar`
para essa rota e `/` para o `GET` da Etapa 6), em vez de um plugin novo —
mesma lógica da Etapa 2 (`DELETE` reaproveitando `/api/projetos`), evita
espalhar `activeDirectory`/`trashDirectory`/`ApiError`/`slugEhSeguro` por
mais um lugar. Localização do item na lixeira reaproveita exatamente o
mesmo laço de leitura de `handleListarLixeira` (Etapa 6): varre
`data/trash/*`, lê cada `emails.json`, compara `dados.slug ?? nomeDaPasta.split('--')[0]`
contra o slug pedido — pastas corrompidas/ilegíveis são só puladas na busca,
mesma postura defensiva da Etapa 6. Detecção de conflito é um `fs.statSync`
simples em `data/active/<slug>`: se existir, nada é escrito nem movido — a
resposta desse item já embute os dois `EmailsData` completos (`ativo` e
`lixeira`, ambos lidos do disco nesta mesma chamada), exatamente como a
Etapa 9 vai precisar, sem endpoint adicional. Restauração de fato remove
`deletado_em` do objeto (`delete`, não desestruturação com variável
descartada, para não disparar aviso de variável não usada) antes de
regravar o `emails.json` *dentro da pasta da lixeira*, e só então
`fs.renameSync` move a pasta inteira para `data/active/<slug>` — na ordem
inversa da Etapa 2 (lá primeiro grava, depois move; aqui idem, só que
removendo o campo em vez de adicionar). Resposta segue o mesmo formato
`{ ok, resultados: { slug, ok, conflito?, error? }[] }` com `207` em falha
parcial, `200` quando tudo restaura — mesma convenção da Etapa 2. No
client, `lixeiraApi.ts` (novo) passou a hospedar também `listarLixeira`
(antes um `fetch` cru dentro do próprio `LixeiraSidebar.tsx`, Etapa 7): a
migração já estava prevista nas notas da Etapa 7 ("esse serviço só nasce na
Etapa 8"), então não é um ajuste de rota, é o próprio plano se cumprindo.
`LixeiraSidebar.tsx` ganhou `slugsSelecionados` (mesmo padrão de
`Set<string>` da Home, Etapa 4) com checkbox sempre visível por item — sem
um "modo de seleção" alternável como a Home precisa, já que nenhum item da
lixeira é um link de navegação (não há nada de que "sair" para habilitar
seleção). Barra de seleção interna (`.lixeira-sidebar-barra-selecao`) só
aparece com `slugsSelecionados.size > 0`, dentro do próprio
`.lixeira-sidebar-conteudo` (não `position: fixed` centralizada na
viewport, diferente de `.barra-selecao-delecao` da Home — a largura já é a
do Drawer). Ajuste não previsto literalmente no plano: `src/index.css`
recebeu classes novas (`.lixeira-item-checkbox`,
`.lixeira-sidebar-barra-selecao*`, `.lixeira-sidebar-erro-restauracao`) e
`.lixeira-item` perdeu `justify-content: space-between` em troca de
`.lixeira-item-info` com `flex: 1` — necessário para acomodar a checkbox
nova sem quebrar o alinhamento do prazo à direita; o plano desta etapa não
listava `index.css` entre os arquivos alterados. Itens que voltam marcados
como `conflito` na resposta permanecem selecionados na sidebar com um aviso
inline (`erroRestauracao`) — a resolução de fato (renomear um dos lados e
tentar de novo) é a Etapa 9, ainda não implementada; aqui o item só fica
"preso" visualmente até lá. Ícone do botão "Restaurar" é `FiRotateCcw`
(`react-icons`, já uma dependência do projeto — nenhuma nova instalada
nesta etapa). Testado manualmente: subi o servidor dev com fixtures reais
em `data/active/`/`data/trash/` (um item sem conflito, um em conflito com
um projeto ativo homônimo, e um slug inexistente no mesmo lote) e confirmei
via `curl` — `POST /api/lixeira/restaurar` devolveu `207`, o item sem
conflito foi de fato movido para `data/active/` com `deletado_em` removido
do JSON, o item em conflito permaneceu intocado na lixeira com os dados
completos dos dois lados na resposta, e o slug inexistente voltou como
`error: "Planilha não encontrada na lixeira."`; reenviar o mesmo slug em
conflito depois confirmou o comportamento idempotente (mesma resposta,
nada novo escrito em disco). Fixtures removidas depois, `data/` de volta só
com `data/trash/.gitkeep`. Verificado também com `tsc` (isolado, mesmo
motivo das etapas anteriores — o projeto completo com `Header.tsx`,
`Icons.tsx`, `data/projetos.ts` etc. não faz parte de nenhum ZIP até aqui);
sem `eslint` (config não incluída nos arquivos entregues).

### Etapa 9 — Modal de conflito de restauração (✅ concluída)

**O que fazer:** novo `ConflitoRestauracaoModal.tsx`, sobre
`ConflictDialog`: os dois projetos lado a lado (ativo e da lixeira), cada
um com nome + campo de slug editável. Validação em tempo real
(reaproveitando `slugify.ts`) contra os três conjuntos descritos na seção
2. Confirmar só habilitado com os dois slugs finais distintos entre si e
sem colisão externa; dispara um novo endpoint de renomeio
(`PATCH /api/projetos/:slug` ou equivalente para o lado da lixeira),
seguido da restauração de fato (reaproveitando a lógica "sem conflito" da
Etapa 8).

**Arquivos alterados:**
`src/components/ConflitoRestauracaoModal.tsx` (novo), `vite.config.ts`
(novo handler `PATCH`), `src/services/lixeiraApi.ts`,
`src/components/LixeiraSidebar.tsx` (ajuste de rota, ver notas),
`src/index.css` (ajuste de rota, ver notas).

**Arquivos-fonte necessários:** `src/components/ConflictDialog.tsx`,
`src/components/utils/slugify.ts`, `src/data/projetos.ts`.

**Notas de execução:** rota escolhida foi literalmente
`PATCH /api/projetos/:slug` (a primeira opção do plano, não o
"equivalente"): implementada dentro do já existente `projetosApiPlugin`
(mesmo mount `/api/projetos` que já trata `POST`/`DELETE`) — o Connect
strippa o mount, então `req.url` chega como `/<slugAtual>` para essa rota,
igual ao raciocínio já usado para `/restaurar` em `lixeiraApiPlugin`
(Etapa 8). Corpo `{ novoSlug, origem: 'ativo' | 'lixeira' }`: `slugAtual`
(da URL) é sempre o slug conflitante — hoje o mesmo valor nos dois lados,
já que foi o que colidiu — e `origem` diz qual dos dois está sendo
renomeado. Para `origem: 'ativo'`, é um `fs.renameSync` direto de
`data/active/<slugAtual>` para `data/active/<novoSlug>`; se o
`emails.json` já carregar um campo `slug` persistido (projeto que já
passou pela lixeira antes), esse campo é atualizado junto, para não ficar
desalinhado com o nome físico numa exclusão futura — projetos que nunca
foram deletados não ganham o campo só por causa deste renomeio. Para
`origem: 'lixeira'`, a pasta é localizada em `data/trash/` pelo campo
`slug` interno (mesma busca de `handleRestaurarProjetos`, Etapa 8, nunca
pelo nome físico); o campo é atualizado para `novoSlug` e o nome físico da
pasta acompanha (`<novoSlug>--<timestamp>`, preservando o timestamp
original) para manter o esquema de nomeação da seção 2 consistente. Em
ambos os casos, a mesma varredura da lixeira serve para checar colisão de
`novoSlug` contra qualquer item lá (inclusive quando `origem` é `'ativo'`)
e, quando `origem` é `'lixeira'`, para localizar a pasta de origem — um só
laço faz as duas coisas. Colisão contra ativos é um `fs.statSync` direto
em `data/active/<novoSlug>`; ambas as checagens (ativo e lixeira) rodam
contra o disco antes de qualquer escrita/movimentação, mesma garantia real
de `projetosApiPlugin` na criação (Etapa 5 de
implementacaoImportacao.md) — a validação do client é só conveniência de
UX. No client, `renomearProjeto(slugAtual, novoSlug, origem)` (novo,
`lixeiraApi.ts`, conforme o plano previa) chama essa rota; `origem` é um
tipo exportado (`TOrigemRenomeio`) para o modal reutilizar. Ajuste de rota
não previsto literalmente no plano: `ConflitoRestauracaoModal` só renomeia
o(s) lado(s) cujo valor final realmente mudou em relação ao slug
conflitante — o plano falava em "os dois slugs editáveis", mas nada exige
editar os dois; o caso mais comum na prática é só um lado mudar (o outro
permanece o slug original). Depois do(s) renomeio(s), o modal chama
`restaurarProjetos([slugFinalDaLixeira])` de novo, reaproveitando o
caminho feliz da Etapa 8 já sem conflito. `ConflitoRestauracaoModal`
recebe `outrosSlugsLixeira` como prop (calculada por `LixeiraSidebar` a
partir de `itens`, que já mantém a listagem carregada) em vez de buscar
sozinho — evita uma segunda fonte de verdade para a mesma lista dentro do
mesmo componente pai; slugs ativos vêm direto de `PROJETOS`
(`src/data/projetos.ts`), mesma limitação já documentada na Etapa 5 (só
reflete criações/exclusões após reload, aceitável como conveniência de UX
já que o servidor valida contra o disco de qualquer forma). Ajuste de rota
não previsto no plano: como o lote de restauração (Etapa 8) pode conter
mais de um item em conflito ao mesmo tempo, `LixeiraSidebar` ganhou uma
fila (`conflitosPendentes`, novo estado) em vez de só o primeiro
conflito — o modal mostra um por vez; resolver ou cancelar um remove só
aquele item da fila, e o próximo (se houver) abre em seguida, sem
precisar clicar em "Restaurar" de novo. O modal é renderizado como irmão
de `Drawer.Root`, não dentro dele — os dois overlays convivem sem
problema. Campos de slug reaproveitam as duas variantes de `slugify.ts`
tal como o wizard de importação: `slugifyDigitando` a cada tecla (mantém
hífen final ao digitar), `slugify` para o valor final normalizado usado
nas comparações/confirmação. `src/index.css` recebeu classes novas
(`.conflito-restauracao-*`) para o layout de duas colunas — não estava
listado nos arquivos alterados do plano original. Verificado com `tsc`
isolado (mesmo motivo das etapas anteriores — o projeto completo com
`Header.tsx`, `Icons.tsx`, `Dialog.tsx` etc. não faz parte de nenhum ZIP
até aqui; para este check pontual, `Dialog.tsx`/`Icons.tsx` foram
substituídos por stubs mínimos só localmente, não entregues): nenhum erro
nos arquivos desta etapa (`ConflitoRestauracaoModal.tsx`,
`LixeiraSidebar.tsx`, `lixeiraApi.ts`, `vite.config.ts`); sem `eslint`
(config não incluída nos arquivos entregues) nem teste manual em servidor
dev (não executado nesta sessão) — pendente confirmar visualmente o fluxo
completo (restaurar → conflito → renomear um lado → restauração de fato)
na próxima oportunidade com o projeto inteiro.

### Etapa 10 — Exclusão permanente (✅ concluída)

**O que fazer:** botão de exclusão permanente por item (ícone
`IconeLixeira`) e em lote (barra de seleção da sidebar, junto de
"Restaurar"), ambos abrindo `ConfirmDialog` com texto dinâmico conforme 1
ou N itens: *"Tem certeza que deseja excluir permanentemente [a planilha
"X"/as N planilhas selecionadas]? Esta ação é irreversível e não poderá
ser desfeita."*. Novo endpoint `DELETE /api/lixeira`, corpo
`{ slugs: string[] }`, removendo a(s) pasta(s) de vez
(`fs.rmSync(..., { recursive: true })`), localizando pelo campo `slug`
interno. Adicionar também "Esvaziar lixeira" (seleciona todos + aciona o
mesmo fluxo em lote).

**Arquivos alterados:** `src/components/LixeiraSidebar.tsx`,
`vite.config.ts` (novo handler `DELETE`), `src/services/lixeiraApi.ts`.

**Arquivos-fonte necessários:** `src/components/ConfirmDialog.tsx`,
`src/components/Icons.tsx`.

**Notas de execução:** o handler `DELETE /api/lixeira`
(`handleExcluirPermanentemente`, `vite.config.ts`) e o serviço de client
`excluirPermanentemente` (`lixeiraApi.ts`, com `ResultadoExclusaoPermanente`)
já chegaram implementados neste ZIP — nenhuma alteração adicional foi
necessária nesses dois arquivos nesta etapa; o que faltava era só a UI em
`LixeiraSidebar.tsx`. Um único estado (`confirmacaoExclusao: string[] |
null`) guarda o lote pendente de confirmação, preenchido por três origens —
botão por item (`abrirConfirmarExclusao([item.slug])`), botão da barra de
seleção (`abrirConfirmarExclusao([...slugsSelecionados])`) e "Esvaziar
lixeira" (`handleEsvaziarLixeira`, que primeiro seleciona todos os slugs
carregados, refletindo nas checkboxes, e então abre a mesma confirmação em
lote) — convergindo para um único `ConfirmDialog` e um único
`handleConfirmarExclusaoPermanente`, mesmo padrão de tratamento de falha
parcial de `handleConfirmarDelecaoLote` (`home.tsx`, Etapa 5): a primeira
falha do lote vira a mensagem de erro exibida (`erroExclusao`), mas cada
slug já foi processado de forma independente no servidor — os que tiveram
sucesso somem da seleção e da lista (lixeira recarregada), os que falharam
permanecem selecionados para nova tentativa. O texto do `ConfirmDialog` é
literal ao plano: singular com o nome da planilha (`itens.find` pelo
único slug do lote) quando `confirmacaoExclusao.length === 1`, plural com
a contagem nos demais casos. "Esvaziar lixeira" só aparece no cabeçalho
quando `itens.length > 0`; não é um endpoint dedicado, é o mesmo
`DELETE /api/lixeira` com todos os slugs de uma vez. `Icons.tsx` não veio
neste ZIP (não fazia parte de nenhuma etapa anterior desta revisão) — como
`IconeLixeira` já é exportado e usado sem props em `Header.tsx`/`home.tsx`,
foi só importado (`import { IconeLixeira } from './Icons'`) sem precisar
ver o arquivo; ele não está incluído no ZIP desta etapa por não ter sido
alterado e por não ter sido enviado em nenhuma etapa anterior — pendente de
confirmação visual (o ícone deve renderizar como já faz nos outros dois
lugares). Verificado com `tsc` isolado (mesmo motivo das etapas anteriores
— stubs locais mínimos para `Icons.tsx`/`Dialog.tsx`/`data/projetos.ts`,
não entregues): nenhum erro nos arquivos desta etapa (`LixeiraSidebar.tsx`,
`ConfirmDialog.tsx` sem alteração, `lixeiraApi.ts` sem alteração); sem
`eslint` (config não incluída nos arquivos entregues) nem teste manual em
servidor dev — pendente confirmar visualmente o fluxo completo (excluir
item único, excluir em lote, esvaziar lixeira, e o caso de falha parcial)
na próxima oportunidade com o projeto inteiro. Isso conclui todas as
etapas de código da seção 3 (Etapas 1–10); resta a validação manual em
servidor dev do fluxo completo, e o item de `DEMANDAS.md` da seção 4
(sincronização entre abas) permanece fora do escopo destas etapas, como já
registrado.

## 4. Nota final — item para `DEMANDAS.md`

Duas abas do sistema abertas simultaneamente não têm nenhum tipo de
sincronização entre si hoje. Ficou definido que isso **não será tratado
nestas etapas**, mas deve ser adicionado a `DEMANDAS.md` para validação
futura:

```markdown
## Sincronização entre abas (multi-tab)

Hoje, se o sistema estiver aberto em mais de uma aba ao mesmo tempo, não
há nenhuma forma de uma aba saber que a outra alterou dados (deletar um
projeto, restaurar da lixeira, editar registros etc.). Cada aba trabalha
com o estado que carregou no momento da abertura, e a "última escrita
vence" silenciosamente.

**Comportamento esperado a implementar futuramente:** quando uma aba
detectar que os dados no servidor mudaram desde que ela carregou (por
exemplo, via um endpoint de "versão"/heartbeat, ou BroadcastChannel entre
abas do mesmo navegador), deve exibir um modal obrigatório, sem opção de
dispensar sem recarregar:

> "O sistema foi alterado em outra aba! Suas alterações não serão salvas!
> Recarregue a página!"

Escopo a decidir quando for implementado: granularidade da detecção (por
projeto específico vs. qualquer mudança no sistema), e o mecanismo técnico
de notificação entre abas.
```
