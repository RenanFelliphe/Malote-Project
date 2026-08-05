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

### Etapa 1 — Estrutura da Lixeira e esquema de nomeação

**O que fazer:** confirmar `data/trash/` criada. Adicionar `slug?: string`
e `deletado_em?: string` a `EmailsData` (`src/types/email.ts`). Documentar
em comentário, junto do tipo, a regra: o nome físico da pasta em
`data/trash/` carrega timestamp (`<slug>--<timestamp>`), mas a identidade
real do projeto é o campo `slug` dentro do próprio JSON.

**Arquivos alterados:** `src/types/email.ts`.

**Arquivos-fonte necessários:** nenhum adicional.

### Etapa 2 — Endpoint `DELETE /api/projetos`

**O que fazer:** novo handler em `vite.config.ts`, `DELETE /api/projetos`,
corpo `{ slugs: string[] }`. Para cada slug: validar existência em
`data/active/<slug>`; ler `emails.json`, injetar `slug` (o próprio) e
`deletado_em` (timestamp atual); gravar; mover a pasta inteira para
`data/trash/<slug>--<timestamp>` (`fs.renameSync`). Cada slug tratado
independentemente — falha em um não deve impedir os demais. Resposta
resume sucesso/falha por item.

**Arquivos alterados:** `vite.config.ts`.

**Arquivos-fonte necessários:** `src/types/email.ts`.

### Etapa 3 — Deleção individual (Header da página do projeto)

**O que fazer:** em `Header.tsx`, habilitar "Deletar planilha" quando
`slug`/`registros` estão presentes (contexto de projeto). Ao clicar, abre
`ConfirmDialog` com o texto *"Tem certeza que deseja deletar a planilha
atual? Essa ação não pode ser desfeita!"*. Ao confirmar, chama
`deletarProjetos([slug])` (novo serviço) e navega para `/` em sucesso.

**Arquivos alterados:** `src/components/Header.tsx`,
`src/services/projetosApi.ts` (nova função `deletarProjetos`).

**Arquivos-fonte necessários:** `src/components/ConfirmDialog.tsx`,
`src/pages/emails.tsx`.

### Etapa 4 — Modo de seleção múltipla na Home

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

### Etapa 5 — Confirmação e deleção em lote

**O que fazer:** botão "Deletar" da barra de ação (Etapa 4) abre
`ConfirmDialog` com texto dinâmico: *"Tem certeza que deseja deletar todas
as N planilhas selecionadas? Essa ação não pode ser desfeita!"*. Ao
confirmar, chama `deletarProjetos([...slugsSelecionados])` (mesmo serviço
da Etapa 3); em sucesso, sai do modo de seleção e recarrega a página.

**Arquivos alterados:** `src/pages/home.tsx`.

**Arquivos-fonte necessários:** `src/components/ConfirmDialog.tsx`,
`src/services/projetosApi.ts`.

### Parte B — Lixeira

### Etapa 6 — Endpoint `GET /api/lixeira`

**O que fazer:** novo handler `GET /api/lixeira`: varre
`data/trash/*/emails.json`, calcula `diasRestantes = 30 -
Math.floor((Date.now() - new Date(deletado_em).getTime()) / 86400000)`
para cada item. Itens com `diasRestantes <= 0` são removidos
definitivamente (`fs.rmSync`) antes de montar a resposta. Resposta:
`{ slug, projeto, deletado_em, diasRestantes, totalRegistros }[]`.

**Arquivos alterados:** `vite.config.ts`.

**Arquivos-fonte necessários:** `src/types/email.ts`.

### Etapa 7 — Sidebar da lixeira (UI, sem ações ainda)

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

### Etapa 8 — Seleção múltipla + restauração (caminho feliz)

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

### Etapa 9 — Modal de conflito de restauração

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
(novo handler `PATCH`), `src/services/lixeiraApi.ts`.

**Arquivos-fonte necessários:** `src/components/ConflictDialog.tsx`,
`src/components/utils/slugify.ts`, `src/data/projetos.ts`.

### Etapa 10 — Exclusão permanente

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
