# Refatoração — Reconstrução da Toolbar do Editor de E-mail

## 1. Contexto desta revisão

O plano anterior (`refatoracaoEmailFormatado.md`) deixou a toolbar organizada em cinco seções fixas (Funções Básicas, Extras, Listas, Alinhamento, Limpar Formatação), cada uma colapsando *como grupo* atrás de um gatilho quando falta espaço, via `ToolbarGrupo.tsx`.

Testes visuais recentes (prints do modal "Editar e-mail" com os painéis de Realce, Link e "Transformar em botão" abertos) mostram que essa estrutura tem um bug de raiz: `.email-editor-toolbar` está com `overflow: hidden` (`src/index.css`, comentário da Etapa 5) para impedir que botões soltos quebrem para uma segunda linha. Isso funciona para os *botões*, mas também corta e empurra os **popovers** (`.email-editor-toolbar-popover`), que são posicionados relativos a um ancestral dentro dessa mesma área com overflow cortado — por isso, em vez de flutuar por cima do conteúdo do modal, o popover nasce espremido *dentro* da própria faixa da toolbar, empurrando os botões vizinhos (é o efeito visto nos prints: "Desfazer Formatação" e outros ícones arrastados para o canto).

Não é um ajuste pontual de CSS: a causa é estrutural (contexto de posicionamento compartilhado entre botões-que-não-podem-quebrar-linha e popovers-que-precisam-flutuar-livremente). Por isso esta revisão reconstrói a toolbar do zero — estrutura, comportamento responsivo e estilização dos elementos — em vez de tentar mais um remendo em cima da estrutura da Etapa 4/5 anterior.

Além da correção do bug, esta revisão amplia a toolbar com botões novos (tamanho da fonte, recuo, linha horizontal, tabela) e adiciona, fora da toolbar, um botão de anexo de arquivo no modal "Editar e-mail" — preparação para o futuro disparador de e-mails automáticos com anexo, sem implementar o disparo em si agora.

## 2. Decisões de escopo

- **Popovers via portal, não mais aninhados na toolbar:** para resolver a causa raiz (seção 1), os popovers de opções (cor de texto, realce, botão, link, alinhamento, tamanho da fonte, menu "Ver Mais") passam a ser renderizados fora do fluxo da `.email-editor-toolbar` (portal ou posicionamento calculado relativo ao viewport/modal), nunca mais como filho direto de um elemento com `overflow: hidden`. `ToolbarGrupo.tsx` na forma atual é descontinuado — a Etapa 1 define o componente que o substitui.
- **Responsividade por "Ver Mais", não mais por grupo:** a estratégia de colapso da revisão anterior (grupo inteiro vira um gatilho) é substituída pelo modelo pedido, no padrão Word/Excel: a toolbar nunca quebra linha; cada **botão individual** (não grupo) que não couber na largura disponível migra para uma toolbar secundária, acessível por um botão de "3 pontos" ("Ver Mais") fixo na ponta direita. Esse botão só existe no DOM quando há pelo menos um botão oculto no momento. A toolbar secundária aparece como painel suspenso (sem scroll interno) ancorado ao gatilho.
- **Botão "Botão" sem etapa intermediária de toggle textual:** hoje existe um botão de ação dentro do popover ("Transformar em botão" / "Remover botão") separado da grade de cores. Isso é removido — clicar no ícone do botão na toolbar abre diretamente o popover de cor + link; **definir uma cor ou um link a partir da seleção atual já aplica o nó `noBotao`** (se ainda não aplicado), sem exigir um clique extra num botão de toggle textual. Continua sendo possível remover o botão (mesmo padrão de "Remover cor"/"Remover link" já usado nos outros popovers).
- **Recuo (esquerda/direita):** o Tiptap não tem uma extensão oficial de indentação — a Etapa 6 implementa isso como um atributo de recuo (`margin-left` incremental, em passos fixos) no nível do nó de bloco atual (parágrafo/item de lista), seguindo a mesma abordagem já usada no projeto para atributos customizados em nó (`NoBotao.ts`, `cor`/`href`), não uma biblioteca de terceiros.
- **Tamanho da fonte:** implementado como atributo novo (`fontSize`) na mark `TextStyle` já existente no projeto (usada hoje só para veicular a cor via `Color`), não uma extensão nova — evita duplicar o mecanismo de mark de estilo inline que já existe.
- **Linha horizontal:** o `HorizontalRule` já vem habilitado por padrão dentro do `StarterKit` já usado no projeto; falta só o botão na toolbar e garantir que `<hr>` sobrevive à sanitização e à exportação "email-safe" — não é uma extensão nova a instalar.
- **Tabela:** só o botão nesta revisão, sem função. Ao clicar, não faz nada (ou mostra um tooltip "Em breve", a critério da implementação) — a extensão de tabela de fato (`@tiptap/extension-table` + a versão bulletproof para e-mail, que é bem mais trabalhosa que as demais) fica para uma revisão futura, fora deste plano.
- **Anexar arquivo:** botão fora da toolbar, dentro do modal "Editar e-mail" (`EmailConteudoModal.tsx`). `<input type="file" multiple>` oculto, acionado pelo botão; após selecionar, lista os nomes dos arquivos escolhidos abaixo do botão, cada um com opção de remover da lista. Fica só em estado local do modal (não é persistido, não é enviado a lugar nenhum) — é a UI de preparação para quando o disparo de e-mail automático ganhar suporte a anexo.
- **Correção do overflow do modal:** o crescimento do modal com a lista de anexos é motivo suficiente para revisar `dialog-content`/scroll do `EmailConteudoModal.tsx` nesta mesma revisão, já que é o componente mais provável de estourar altura quando vários arquivos forem anexados.

> ## ⚠️ Regra de entrega a cada etapa — leia antes de começar
>
> **A cada etapa implementada, a entrega deve ser um único ZIP contendo *todos* os arquivos alterados desde a Etapa 0 desta revisão até a etapa atual — não apenas os da etapa corrente.**
>
> A mesma regra dos planos anteriores se aplica aqui, reiniciando a contagem cumulativa a partir da Etapa 0 deste documento.
>
> **Novidade a partir desta revisão: este arquivo de plano (`RefatoracaoToolbarEmail.md`) também deve ir dentro do ZIP de cada etapa**, atualizado para refletir o progresso (etapas concluídas marcadas, ajustes de rota se algum diagnóstico mudar uma decisão registrada aqui) — o mesmo lugar de sempre em `public/`. Isso evita depender de reenviar o ZIP acumulado só para eu ter acesso ao plano em paralelo ao código.

## 3. Divisão em etapas

As etapas 0–3 são a reconstrução estrutural da toolbar (bug + responsividade) e devem vir primeiro, na ordem — cada uma depende da anterior. As etapas 4–8 (botões novos e redesenho do botão "Botão") podem ser feitas em qualquer ordem entre si, uma vez que a Etapa 3 esteja pronta. A etapa 9 (anexar arquivo) é independente e pode entrar em paralelo a partir da Etapa 0. A etapa 10 é o teste manual final. As etapas 1, 3, 9 e 10 são checkpoints.

> **Notas de implementação (Etapas 0–2), registradas aqui para continuidade:**
>
> - **Etapa 0:** diagnóstico confirmado por inspeção direta — o único causador era `overflow: hidden` em `.email-editor-toolbar` combinado com os popovers antigos sendo filhos posicionados (`position: absolute`) de um ancestral dentro dessa mesma área cortada. `Dialog.tsx`/`dialog-content` não faziam parte da causa raiz (seu próprio `overflow` só entra em jogo indiretamente, quando o popover cresce mais que o modal — tratado na Etapa 3, fora deste ZIP).
> - Ao começar a Etapa 1, `src/components/editor/ToolbarPopover.tsx` e os comentários de `src/index.css` já existiam no projeto recebido, implementando exatamente o componente de popover via portal previsto para esta etapa — sinal de uma tentativa anterior interrompida antes de `EmailEditorToolbar.tsx` ser de fato reescrito para usá-lo. Esta entrega completa essa reescrita (o componente antigo, `ToolbarGrupo.tsx`, foi removido) e adiciona a Etapa 2 em cima.
> - **Etapa 2 — prioridade de ocultação:** implementada como a ordem inversa de exibição (botões mais à direita escondem primeiro) — uma escolha simples e previsível, deixada explicitamente para ajuste fino na Etapa 3, conforme já previsto no texto desta etapa.
> - **Etapa 2 — separadores:** os 4 separadores decorativos entre clusters (Funções Básicas | Extras | Listas | Alinhamento | Limpar Formatação) permanecem, mas cada um só é desenhado quando há pelo menos um botão visível de cada lado — evita um separador "sobrando" quando um cluster inteiro migra para "Ver Mais".
> - **Etapa 2 — layout do painel "Ver Mais":** grade de 4 colunas (não uma lista vertical de linha única), para não ficar excessivamente alto quando muitos botões estiverem ocultos, mantendo "sem scroll interno" conforme pedido.
>
> **Notas de implementação (Etapa 3), registradas aqui para continuidade:**
>
> - Ao inspecionar o ZIP recebido (Etapas 0–2) para começar a Etapa 3, boa parte do "ajuste fino" já estava implementada — mesmo padrão do que aconteceu com `ToolbarPopover.tsx` no início da Etapa 1 (componente entregue adiantado, de uma tentativa anterior): `ToolbarPopover.tsx` já tinha o clamp de viewport (deslizar para a esquerda / abrir para cima) explicitamente documentado como "Ajuste fino da Etapa 3", e `ORDEM_OCULTACAO` já tinha a prioridade de ocultação refinada com a justificativa por cluster, também já atribuída à Etapa 3 nos comentários. Confirmado por leitura de código que ambos cobrem o que o texto desta etapa pedia — nenhuma mudança adicional foi necessária nesses dois pontos.
> - O que de fato faltava, encontrado ao ler o mecanismo de fechamento por clique-fora de `ToolbarPopover.tsx`: um botão oculto (dentro do painel "Ver Mais") que tem popover próprio — cor, realce, link, botão — abre esse popover **por cima** do painel de "Ver Mais" sem fechá-lo (`painelAberto` e `verMaisAberto` são estados propositalmente independentes, ver JSDoc de `EmailEditorToolbar`). Só que cada instância de `ToolbarPopover` só considerava seu próprio `popoverRef`/`anchorRef` no clique-fora — um clique dentro do popover "filho" (ex.: escolher uma cor) contava como "fora" para a instância "pai" (o painel de "Ver Mais"), fechando-o e derrubando o próprio popover filho no meio da interação. Corrigido tratando qualquer clique dentro de outro elemento com a classe `email-editor-toolbar-popover` (classe fixa, comum a todo popover da toolbar) como "dentro", não "fora" — resolve o caso genericamente, sem acoplar `ToolbarPopover` a quais botões têm popover companheiro.
>
> **Notas de implementação (Etapa 4), registradas aqui para continuidade:**
>
> - `fontSize` implementado como extensão própria (`src/components/editor/extensoes/FontSize.ts`), que estende a mark `textStyle` via `addGlobalAttributes` (mesmo mecanismo que `@tiptap/extension-color` já usa nesse projeto para acrescentar `color` à mesma mark) — não precisou reescrever `parseHTML`/`renderHTML` do zero, só declarar como o atributo lê/escreve dentro do `style` inline que `textStyle` já produz.
> - **Integração aplicada** (arquivos recebidos depois da entrega anterior): `EmailEditorRico.tsx` e `src/components/utils/sanitizarHtml.ts` foram enviados em seguida, então as duas edições já foram feitas nesta entrega:
>   1. `EmailEditorRico.tsx`: `FontSize` (import de `./editor/extensoes/FontSize`) adicionada à lista de extensões do editor, logo depois de `TextStyle`/`Color`.
>   2. `sanitizarHtml.ts`: nenhuma mudança de configuração foi necessária — `style` já é liberado no `ALLOWED_ATTR` sem allowlist por propriedade de CSS (não há `ALLOWED_STYLES` configurado), então `font-size` já passava pela sanitização do mesmo jeito que `color`/`text-align` já passavam. Só o comentário explicativo foi atualizado para deixar isso registrado.
>
> **Notas de implementação (Etapa 5), registradas aqui para continuidade:**
>
> - Implementado como `Indentacao.ts`, no mesmo mecanismo de atributo global que `TextAlign` (já configurada no projeto para `paragraph`/`noBotao`) usa — não foi preciso usar `NoBotao.ts` como referência direta (ele é um nó inteiro novo, não um atributo em nós já existentes); `TextAlign`, já presente em `EmailEditorRico.tsx` fazendo exatamente esse tipo de acréscimo de atributo a `paragraph`, acabou sendo o precedente mais direto dentro do próprio projeto.
> - `indent` é um nível inteiro (0–8, teto de segurança só para não deixar o texto fugir da largura útil do e-mail em telas estreitas — o plano só pede o mínimo em zero explicitamente), convertido para `margin-left: Npx` (24px por nível) no `style` inline — mesmo padrão de round-trip via `style` já usado para cor/tamanho de fonte.
> - `increaseIndent`/`decreaseIndent` ajustam **todo** bloco elegível (`paragraph`/`listItem`) tocado pela seleção, cada um a partir do próprio valor atual — não um valor absoluto — para que selecionar vários parágrafos com recuos diferentes e clicar uma vez continue os ajustando de forma relativa, não igualando todos a um mesmo nível.
> - Os dois botões não têm estado ativo/inativo (mesmo padrão de "Limpar formatação") — são ações relativas (+1/−1), não um toggle de um valor fixo, então não há um "ativo" único para destacar.
> - `sanitizarHtml.ts`: nenhuma mudança de configuração — `margin-left` sai dentro do mesmo `style` inline já liberado (sem allowlist por propriedade de CSS nesta configuração), e `p`/`li` já estavam em `ALLOWED_TAGS`. Só o comentário foi atualizado.

> **Notas de implementação (Etapa 6), registradas aqui para continuidade:**
>
> - **Achado ao inspecionar `EmailEditorRico.tsx` para começar a etapa:** a premissa da seção 2 ("`HorizontalRule` já vem habilitado por padrão dentro do `StarterKit`") não se confirmou neste projeto — `StarterKit.configure({ ..., horizontalRule: false, ... })` desligava o nó explicitamente, na mesma lista de heading/blockquote/codeBlock/code. Corrigido removendo `horizontalRule: false` dessa configuração; nenhuma extensão nova foi instalada, `setHorizontalRule()` passou a existir só com essa remoção.
> - Botão adicionado ao cluster "Extras" da toolbar (mesmo cluster de tamanho de fonte/cor/realce/link/botão), sem popover — ação direta, mesmo padrão de "Limpar formatação" e recuo (sem estado ativo/inativo, já que não há como um `<hr>` estar "ativo" sob o cursor do mesmo jeito que uma marca).
> - `sanitizarHtml.ts`: `hr` adicionado a `ALLOWED_TAGS` — sem essa entrada o DOMPurify descartava a tag inteira (diferente do caso de `style`/`margin-left` nas Etapas 4/5, que não precisaram de mudança de configuração; aqui a tag em si não estava na lista).
> - **Pendência da entrega anterior, resolvida nesta:** `src/components/utils/emailHtmlInline.ts` não tinha vindo no ZIP recebido para começar a Etapa 6 (não fazia parte do conjunto de arquivos tocado nas Etapas 0–5) — a etapa foi entregue incompleta, faltando só esse arquivo. Recebido em seguida e ajustado agora: `raiz.querySelectorAll('hr')` inline a mesma aparência de `.campo-corpo-email-editor hr` (`border: none` + `border-top: 1px solid ...` + `margin`), usando uma nova constante `COR_BORDA` (valor fixo do tema claro de `--color-border`, mesmo raciocínio já usado para `COR_ACENTO`/`COR_BOTAO_TEXTO` — um e-mail já enviado não deve mudar de cor sozinho por causa do tema do app de quem escreveu). Etapa 6 fechada por completo com esta entrega.
>
> **Notas de implementação (Etapa 7), registradas aqui para continuidade:**
>
> - Botão adicionado ao mesmo cluster "Extras", logo depois de "Linha horizontal" — sem `disabled`, para não parecer quebrado, mas o `onClick` não faz nada de propósito (comentário no próprio código deixa isso explícito). O título/`aria-label` ("Tabela (em breve)") já comunica que a função ainda não existe, sem precisar de um tooltip customizado à parte.
> - Nenhuma mudança em `sanitizarHtml.ts` ou `emailHtmlInline.ts` nesta etapa — não há HTML novo sendo gerado (o botão não produz nenhum nó/marca), só o ícone e o gatilho visual.

### Etapa 0 — Diagnóstico de código: causa exata do bug de popover dentro da toolbar — ✅ concluída

**O que fazer:** confirmar, por inspeção direta, a cadeia completa do problema: (1) `.email-editor-toolbar` em `src/index.css` — confirmar o `overflow: hidden` e todo elemento entre ele e cada `.email-editor-toolbar-popover` que tenha `position: relative`/`absolute` estabelecendo o contexto de posicionamento atual; (2) `ToolbarGrupo.tsx` e os popovers montados direto em `EmailEditorToolbar.tsx` (cor, realce, link, botão) — confirmar que todos usam o mesmo padrão (filho posicionado dentro da área cortada) e não há um caso já tratado de outro jeito; (3) `EmailConteudoModal.tsx`/`Dialog.tsx` — confirmar até onde o `dialog-content` (`overflow-y: auto`/`hidden`, conforme o caso) participa do corte, para saber se a solução da Etapa 1 precisa só resolver a toolbar ou também considerar o container do modal.

**Por quê:** antes de reconstruir, é preciso confirmar que a hipótese da seção 1 (overflow da toolbar cortando o popover, não um problema de z-index ou de outro elemento) é de fato a causa única — para não redesenhar em cima de um diagnóstico incompleto.

**Arquivos alterados:** nenhum (etapa de investigação).

**Arquivos-fonte necessários:** `src/index.css`, `src/components/EmailEditorToolbar.tsx`, `src/components/editor/ToolbarGrupo.tsx`, `src/components/Dialog.tsx`, `src/components/EmailConteudoModal.tsx`.

### Etapa 1 — Reconstrução da estrutura base da toolbar (sem funcionalidade nova) — checkpoint — ✅ concluída

**O que fazer:** reescrever `EmailEditorToolbar.tsx` e substituir `ToolbarGrupo.tsx` por uma estrutura nova, do zero: uma faixa única de botões individuais (não mais agrupados por seção fixa), sem quebra de linha (`flex-wrap: nowrap`), preservando todas as funções já existentes (negrito, itálico, sublinhado, tachado, cor de texto, realce, link, botão, listas, alinhamento, limpar formatação) mapeadas para essa nova estrutura. Os popovers de cada botão passam a ser renderizados de forma que nunca fiquem sujeitos ao `overflow` da faixa de botões (portal para `document.body`, posicionado por coordenadas calculadas a partir do botão-gatilho, no mesmo espírito do `Dialog.tsx` já existente no projeto). Nesta etapa nenhum botão novo é adicionado ainda — é só a base estrutural corrigida.

**Por quê é checkpoint:** é a mudança que resolve o bug relatado (popover deslocando a toolbar) — vale confirmar visualmente, testando cada um dos popovers existentes (cor, realce, link, botão) antes de empilhar responsividade e botões novos em cima.

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`, `src/components/editor/ToolbarGrupo.tsx` (reescrito ou removido, conforme o novo desenho), `src/index.css`.

**Arquivos-fonte necessários:** nenhum adicional além do que já foi visto na Etapa 0.

### Etapa 2 — Menu "Ver Mais": botões individuais ocultos e toolbar secundária — ✅ concluída

**O que fazer:** implementar a medição de largura disponível da faixa de botões (via `ResizeObserver`, no mesmo espírito do que já existia na revisão anterior, mas agora operando por **botão individual**, não por grupo) e decidir, em tempo real, quais botões cabem visíveis e quais migram para uma lista oculta. Criar o botão de "3 pontos" ("Ver Mais"), fixo na ponta direita da toolbar, que só é renderizado quando a lista de ocultos tem 1 ou mais itens. Ao clicar, abre um painel suspenso (mesmo mecanismo de portal da Etapa 1) listando os botões ocultos, sem scroll interno.

**Por quê:** é o comportamento de responsividade pedido nesta revisão (padrão Word/Excel), substituindo o colapso por grupo da revisão anterior — e só faz sentido implementar em cima da base já corrigida da Etapa 1.

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`, `src/index.css`, `src/components/Icons.tsx` (ícone de "3 pontos").

**Arquivos-fonte necessários:** nenhum adicional.

### Etapa 3 — Ajuste fino de responsividade e paridade visual — checkpoint — ✅ concluída

**O que fazer:** testar a nova toolbar (Etapas 1–2) em várias larguras de tela/modal, ajustando prioridade de ocultação (qual botão oculta primeiro quando o espaço aperta) e o alinhamento/posicionamento do painel suspenso do "Ver Mais" e dos demais popovers em relação ao container do modal, incluindo o caso do próprio `dialog-content` cortando algo (achado da Etapa 0). Conferir que "Desfazer Formatação" e os demais botões não ficam mais arrastados/espremidos em nenhum estado.

**Por quê é checkpoint:** fecha a parte estrutural desta revisão — vale confirmar visualmente antes de começar a somar botões novos, que só vão aumentar a quantidade de itens disputando espaço na toolbar.

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`, `src/index.css` (apenas ajustes finos; sem mudança estrutural nova).

**Arquivos-fonte necessários:** nenhum adicional.

### Etapa 4 — Botão novo: Tamanho da Fonte — ✅ concluída

**O que fazer:** estender a mark `TextStyle` já usada no projeto (hoje só carrega a cor, via `Color`) com um atributo `fontSize`, seguindo o mesmo padrão de round-trip via `style` inline já usado para cor; adicionar o botão na toolbar, que abre um popover com uma lista curada de tamanhos (não um input livre, mesma decisão de escopo já usada para as paletas de cor/realce); adicionar o novo `fontSize` à allowlist de `style` em `sanitizarHtml.ts`, se ainda não coberto.

**Por quê:** é a única formatação de texto pedida nesta revisão que ainda não existe em nenhuma forma no editor.

**Arquivos alterados:** `src/components/EmailEditorRico.tsx`, `src/components/EmailEditorToolbar.tsx`, `src/components/Icons.tsx`, `src/components/utils/sanitizarHtml.ts`, `src/index.css`.

**Arquivos-fonte necessários:** `src/components/utils/sanitizarHtml.ts` (allowlist atual de `style`).

### Etapa 5 — Botões novos: Recuo Esquerda e Recuo Direita — ✅ concluída

**O que fazer:** implementar o atributo de recuo (`margin-left`, incrementado/decrementado em passos fixos) no(s) nó(s) de bloco relevante(s) (parágrafo, item de lista), com dois comandos novos (aumentar/diminuir recuo); adicionar os dois botões na toolbar. Diminuir recuo abaixo do mínimo (zero) não tem efeito, sem necessidade de desabilitar o botão visualmente (mesmo padrão de tolerância já usado em "Limpar formatação" sobre seleção vazia).

**Por quê:** não existe hoje nenhum controle de recuo no editor; por não haver extensão oficial do Tiptap para isso (registrado na seção 2), é implementação própria, no mesmo padrão de atributo customizado já validado no projeto com `NoBotao.ts`.

**Arquivos alterados:** `src/components/EmailEditorRico.tsx` (ou uma extensão nova dedicada, em `src/components/editor/extensoes/`), `src/components/EmailEditorToolbar.tsx`, `src/components/Icons.tsx`, `src/components/utils/sanitizarHtml.ts`, `src/index.css`.

**Arquivos-fonte necessários:** `src/components/editor/extensoes/NoBotao.ts` (padrão de referência de atributo customizado em nó).

### Etapa 6 — Botão novo: Linha Horizontal — ✅ concluída

**O que fazer:** adicionar o botão na toolbar, chamando `setHorizontalRule()` (já disponível via `StarterKit`, sem extensão adicional); conferir que `hr` está na allowlist de `sanitizarHtml.ts` e que a exportação "email-safe" (`emailHtmlInline.ts`) produz um `<hr>` com aparência consistente nos clientes de e-mail (estilo inline, já que CSS externo não sobrevive).

**Por quê:** a extensão de base já existe no projeto (só nunca foi exposta na toolbar); o trabalho real desta etapa é garantir que ela sobrevive ao pipeline de sanitização/exportação, igual ao que já foi feito para cor/realce/botão nas revisões anteriores.

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`, `src/components/Icons.tsx`, `src/components/utils/sanitizarHtml.ts`, `src/components/utils/emailHtmlInline.ts`, `src/index.css`.

**Arquivos-fonte necessários:** `src/components/utils/emailHtmlInline.ts` (para saber onde encaixar o tratamento do `hr`).

### Etapa 7 — Botão novo: Tabela (placeholder, sem função) — ✅ concluída

**O que fazer:** adicionar o botão na toolbar, sem nenhum comando associado — ao clicar, não faz nada (ou exibe um tooltip indicando funcionalidade futura, ex. "Em breve").

**Por quê:** é só o adiantamento visual pedido nesta revisão; a extensão de tabela de fato fica para uma revisão futura, por ser significativamente mais trabalhosa (schema de tabela + exportação bulletproof para e-mail, no mesmo nível de esforço que o botão avançado exigiu nas Etapas 6–8 da revisão anterior).

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`, `src/components/Icons.tsx`.

**Arquivos-fonte necessários:** nenhum adicional.

> **Notas de implementação (Etapa 8), registradas aqui para continuidade:**
>
> - `NoBotao.ts` não fazia parte do ZIP recebido para começar esta etapa (não foi alterado desde a Etapa 0 desta revisão, então não entra na entrega cumulativa) — a implementação seguiu só pelo uso já existente de `toggleNoBotao()`/`updateAttributes('noBotao', ...)` dentro do próprio `EmailEditorToolbar.tsx` (Etapas 6/7 anteriores já chamavam esses comandos), sem precisar ler o arquivo-fonte da extensão em si.
> - `aplicarCorBotao`/`aplicarHrefBotao` chamam `toggleNoBotao()` na mesma chain antes de `updateAttributes`, só quando `!estado.noBotaoAtivo` — uma única chamada de `.run()`, sem round-trip extra pelo editor.
> - `aplicarHrefBotao`: campo vazio com o botão ainda não aplicado não faz nada (não cria um `noBotao` sem destino só por clicar em "Aplicar link" em branco); com o botão já existente, campo vazio continua limpando o `href`, igual ao comportamento anterior a esta etapa.
> - O popover passou a mostrar a paleta de cor e o campo de link sempre que aberto (não mais só quando `estado.noBotaoAtivo`) — removido o botão de ação textual "Transformar em botão"/"Remover botão"; "Remover cor"/"Remover link" (já existentes) continuam sendo a única forma de desfazer cada atributo, sem um botão dedicado para desfazer o nó inteiro (decisão de escopo do próprio plano, seção 2).
> - Título/`aria-label` do botão da toolbar mudou de "Transformar em botão" para "Botão", já que o clique não é mais uma ação de "transformar" isolada.

### Etapa 8 — Redesenho do botão "Botão": cor + link direto no ícone, sem toggle textual — ✅ concluída

**O que fazer:** remover o botão de ação textual "Transformar em botão"/"Remover botão" de dentro do popover; o clique no ícone da toolbar passa a abrir diretamente o popover com a grade de cores (reaproveitando `PainelCores`) e o campo de link. Escolher uma cor ou aplicar um link a partir de uma seleção que ainda não é um `noBotao` aplica o nó automaticamente (chamando `toggleNoBotao()` internamente antes de gravar o atributo, se ainda não estiver ativo); permanece possível remover o botão via as opções de "Remover cor"/"Remover link" já existentes, sem precisar de um botão de toggle dedicado.

**Por quê:** simplifica o fluxo pedido nesta revisão (um clique a menos) e reaproveita a UI de cor/link que já existe, só mudando quando o nó é de fato aplicado.

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`, `src/index.css` (apenas se o novo fluxo exigir ajuste visual no popover).

**Arquivos-fonte necessários:** `src/components/editor/extensoes/NoBotao.ts`.

### Etapa 9 — "Anexar arquivo" no modal + correção de overflow/scroll — checkpoint — ✅ concluída

**O que fazer:** adicionar, fora da toolbar (dentro de `EmailConteudoModal.tsx`, abaixo do editor), o botão "Anexar arquivo" acionando um `<input type="file" multiple hidden>`; ao selecionar, listar os arquivos escolhidos em estado local do modal (nome de cada um), cada item com uma opção de remover da lista antes de salvar. Nenhuma integração com envio/persistência — é só a UI, para reaproveitar quando o disparo automático de e-mails ganhar suporte a anexo. Em paralelo, revisar `dialog-content`/`.dialog-content.dialog-rolavel` (`src/index.css`) e a marcação de `EmailConteudoModal.tsx` para que o crescimento do modal com vários arquivos anexados não corte conteúdo nem quebre o layout do rodapé (`Salvar`/`Cancelar`) — usando scroll interno controlado em vez de o modal crescer indefinidamente.

**Por quê é checkpoint:** é a última peça funcional nova desta revisão e a mais provável de expor o bug de overflow/scroll do modal citado na demanda — vale testar isoladamente, anexando vários arquivos com nomes longos, antes do teste manual completo final.

**Arquivos alterados:** `src/components/EmailConteudoModal.tsx`, `src/components/Icons.tsx`, `src/index.css`.

**Arquivos-fonte necessários:** `src/components/Dialog.tsx` (para saber exatamente onde entra o scroll controlado).

> **Notas de implementação (Etapa 9), registradas aqui para continuidade:**
>
> - Correção do overflow: a causa aqui é diferente da Etapa 0 (aquela era `overflow: hidden` cortando popovers da toolbar). Aqui, `.dialog-content` empilha header/children/footer no mesmo flex-column (`Dialog.tsx`) — deixar `.dialog-content.dialog-rolavel` (já existente, usado pelo `ExportarModal`) rolar o container inteiro arrastaria os botões Salvar/Cancelar do rodapé junto. Em vez de aplicar essa classe existente, a correção introduz um wrapper novo e mais específico, `.modal-email-conteudo-corpo`, envolvendo só título/corpo/anexos (children do `Dialog`, que já ficam isolados do header/rodapé por serem passados como `children` normais, não via prop `footer`); `flex: 1` + `min-height: 0` + `overflow-y: auto` nesse wrapper — não em `.dialog-content` — é o que permite só ele rolar, com `.dialog-content` mantendo `overflow: hidden`/`max-height: 85vh` como guarda de altura máxima.
> - `erro-salvamento` e o `ConfirmDialog` de descarte ficaram de propósito FORA do wrapper rolável (mas ainda dentro de `.dialog-content`, como filhos diretos): a mensagem de erro precisa continuar visível mesmo com a lista de anexos rolada para baixo; o `ConfirmDialog` já usa `Dialog`/portal internamente, então sua posição no JSX aqui não afeta onde ele é de fato renderizado no DOM.
> - Anexos guardados como `{ id, arquivo: File }[]`, com `id` gerado via `crypto.randomUUID()` só no momento da seleção (não há um id natural no próprio `File`) — usado como `key` da lista e para localizar o item a remover.
> - `input[type=file]` usa o atributo `hidden` nativo (não uma classe CSS) para ficar oculto; o clique no botão visível (`IconeAnexar` + texto) aciona `inputAnexoRef.current?.click()`. Depois de processar a seleção, `evento.target.value = ''` é limpo — sem isso, selecionar de novo o mesmo arquivo (após removê-lo da lista) não dispararia um novo evento `onChange`.
> - A lista de anexos foi deixada de fora de `alteracoesPendentes` (que continua comparando só `titulo`/`conteudo` contra `email`): como nenhum arquivo é persistido ou enviado nesta etapa (seção 2 do plano), fechar o modal sem salvar não perde nada que já não se perdesse ao reabri-lo — não fazia sentido a confirmação de descarte (`ConfirmDialog`, Etapa 6 de `RefatoracaoModais.md`) disparar só por causa de anexos selecionados.
> - Ícone do botão "Anexar arquivo": `FiPaperclip` (Feather), mesmo conjunto usado no resto da toolbar — símbolo padrão de anexo em qualquer cliente de e-mail. O botão de remover cada item da lista reaproveita o mesmo símbolo de `IconeFechar` (`FiX`), só num tamanho menor (`IconeRemoverAnexo`), para caber ao lado do nome do arquivo.

### Etapa 10 — Teste manual completo de regressão e fidelidade (revisão completa)

**O que fazer:** repetir o ciclo de teste manual em cima de tudo desta revisão: reconstrução da toolbar (nenhuma função antiga quebrou: negrito/itálico/sublinhado/tachado/cor/realce/link/botão/listas/alinhamento/limpar formatação), responsividade por "Ver Mais" em diferentes larguras, os quatro botões novos (fonte, recuo, linha horizontal, tabela-placeholder), o redesenho do botão "Botão", e o fluxo de anexar/remover arquivos no modal sem overflow. Repetir também o teste de cópia para Gmail/Outlook (mesmo ciclo da revisão anterior) para confirmar que os elementos novos que geram HTML (tamanho de fonte, recuo, `hr`) sobrevivem no destino, e não só na própria plataforma.

**Por quê:** é o único jeito de confirmar, nos ambientes reais, que a reconstrução da toolbar não introduziu nenhuma regressão nas funções já existentes enquanto resolve o bug relatado e adiciona o que foi pedido.

**Arquivos alterados:** nenhum (apenas validação).

**Arquivos-fonte necessários:** nenhum.