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

### Etapa 0 — Diagnóstico de código: causa exata do bug de popover dentro da toolbar ✅ concluída

**O que fazer:** confirmar, por inspeção direta, a cadeia completa do problema: (1) `.email-editor-toolbar` em `src/index.css` — confirmar o `overflow: hidden` e todo elemento entre ele e cada `.email-editor-toolbar-popover` que tenha `position: relative`/`absolute` estabelecendo o contexto de posicionamento atual; (2) `ToolbarGrupo.tsx` e os popovers montados direto em `EmailEditorToolbar.tsx` (cor, realce, link, botão) — confirmar que todos usam o mesmo padrão (filho posicionado dentro da área cortada) e não há um caso já tratado de outro jeito; (3) `EmailConteudoModal.tsx`/`Dialog.tsx` — confirmar até onde o `dialog-content` (`overflow-y: auto`/`hidden`, conforme o caso) participa do corte, para saber se a solução da Etapa 1 precisa só resolver a toolbar ou também considerar o container do modal.

**Por quê:** antes de reconstruir, é preciso confirmar que a hipótese da seção 1 (overflow da toolbar cortando o popover, não um problema de z-index ou de outro elemento) é de fato a causa única — para não redesenhar em cima de um diagnóstico incompleto.

**Arquivos alterados:** nenhum (etapa de investigação).

**Arquivos-fonte necessários:** `src/index.css`, `src/components/EmailEditorToolbar.tsx`, `src/components/editor/ToolbarGrupo.tsx`, `src/components/Dialog.tsx`, `src/components/EmailConteudoModal.tsx`.

**Confirmado por inspeção:** a hipótese da seção 1 procede. `.email-editor-toolbar` tinha `overflow: hidden` em `src/index.css`; todos os popovers (cor, realce, link, botão) eram renderizados como filhos posicionados (`position: absolute`/`relative`) de `.email-editor-toolbar-grupo`/`ToolbarGrupo.tsx`, dentro dessa mesma faixa cortada — sem exceção, nenhum caso já tratado de outro jeito. `Dialog.tsx` já usava `createPortal` para `document.body` (padrão de referência aproveitado na Etapa 1); `dialog-content` não participava do corte — o problema estava inteiramente contido na toolbar, não no container do modal.

### Etapa 1 — Reconstrução da estrutura base da toolbar (sem funcionalidade nova) — checkpoint ✅ concluída

**O que fazer:** reescrever `EmailEditorToolbar.tsx` e substituir `ToolbarGrupo.tsx` por uma estrutura nova, do zero: uma faixa única de botões individuais (não mais agrupados por seção fixa), sem quebra de linha (`flex-wrap: nowrap`), preservando todas as funções já existentes (negrito, itálico, sublinhado, tachado, cor de texto, realce, link, botão, listas, alinhamento, limpar formatação) mapeadas para essa nova estrutura. Os popovers de cada botão passam a ser renderizados de forma que nunca fiquem sujeitos ao `overflow` da faixa de botões (portal para `document.body`, posicionado por coordenadas calculadas a partir do botão-gatilho, no mesmo espírito do `Dialog.tsx` já existente no projeto). Nesta etapa nenhum botão novo é adicionado ainda — é só a base estrutural corrigida.

**Por quê é checkpoint:** é a mudança que resolve o bug relatado (popover deslocando a toolbar) — vale confirmar visualmente, testando cada um dos popovers existentes (cor, realce, link, botão) antes de empilhar responsividade e botões novos em cima.

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`, `src/components/editor/ToolbarGrupo.tsx` (reescrito ou removido, conforme o novo desenho), `src/index.css`.

**Arquivos-fonte necessários:** nenhum adicional além do que já foi visto na Etapa 0.

**Implementado:** `EmailEditorToolbar.tsx` reescrito como uma única faixa de botões individuais (`flex-wrap: nowrap`, sem `ToolbarGrupo`); `ToolbarGrupo.tsx` removido e substituído por `editor/ToolbarPopover.tsx` (portal para `document.body` via `createPortal`, posição calculada por `getBoundingClientRect` do botão-gatilho, fechamento por clique-fora/Esc encapsulado no próprio componente). Os quatro popovers existentes (cor de texto, realce, link, "Transformar em botão") foram migrados para `ToolbarPopover`, preservando exatamente o comportamento e os comandos Tiptap de antes — nenhuma função nova nesta etapa. `src/index.css` já estava com `overflow: hidden` removido de `.email-editor-toolbar` e com as regras de `.email-editor-toolbar-popover` como `position: fixed`; não precisou de mais nenhum ajuste. Validado com `tsc -b`, `eslint` e `vite build` (todos sem erros). Teste visual manual dos quatro popovers (cor, realce, link, botão) ainda pendente de confirmação do usuário, por ser o checkpoint desta etapa.

### Etapa 2 — Menu "Ver Mais": botões individuais ocultos e toolbar secundária

**O que fazer:** implementar a medição de largura disponível da faixa de botões (via `ResizeObserver`, no mesmo espírito do que já existia na revisão anterior, mas agora operando por **botão individual**, não por grupo) e decidir, em tempo real, quais botões cabem visíveis e quais migram para uma lista oculta. Criar o botão de "3 pontos" ("Ver Mais"), fixo na ponta direita da toolbar, que só é renderizado quando a lista de ocultos tem 1 ou mais itens. Ao clicar, abre um painel suspenso (mesmo mecanismo de portal da Etapa 1) listando os botões ocultos, sem scroll interno.

**Por quê:** é o comportamento de responsividade pedido nesta revisão (padrão Word/Excel), substituindo o colapso por grupo da revisão anterior — e só faz sentido implementar em cima da base já corrigida da Etapa 1.

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`, `src/index.css`, `src/components/Icons.tsx` (ícone de "3 pontos").

**Arquivos-fonte necessários:** nenhum adicional.

### Etapa 3 — Ajuste fino de responsividade e paridade visual — checkpoint

**O que fazer:** testar a nova toolbar (Etapas 1–2) em várias larguras de tela/modal, ajustando prioridade de ocultação (qual botão oculta primeiro quando o espaço aperta) e o alinhamento/posicionamento do painel suspenso do "Ver Mais" e dos demais popovers em relação ao container do modal, incluindo o caso do próprio `dialog-content` cortando algo (achado da Etapa 0). Conferir que "Desfazer Formatação" e os demais botões não ficam mais arrastados/espremidos em nenhum estado.

**Por quê é checkpoint:** fecha a parte estrutural desta revisão — vale confirmar visualmente antes de começar a somar botões novos, que só vão aumentar a quantidade de itens disputando espaço na toolbar.

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`, `src/index.css` (apenas ajustes finos; sem mudança estrutural nova).

**Arquivos-fonte necessários:** nenhum adicional.

### Etapa 4 — Botão novo: Tamanho da Fonte

**O que fazer:** estender a mark `TextStyle` já usada no projeto (hoje só carrega a cor, via `Color`) com um atributo `fontSize`, seguindo o mesmo padrão de round-trip via `style` inline já usado para cor; adicionar o botão na toolbar, que abre um popover com uma lista curada de tamanhos (não um input livre, mesma decisão de escopo já usada para as paletas de cor/realce); adicionar o novo `fontSize` à allowlist de `style` em `sanitizarHtml.ts`, se ainda não coberto.

**Por quê:** é a única formatação de texto pedida nesta revisão que ainda não existe em nenhuma forma no editor.

**Arquivos alterados:** `src/components/EmailEditorRico.tsx`, `src/components/EmailEditorToolbar.tsx`, `src/components/Icons.tsx`, `src/components/utils/sanitizarHtml.ts`, `src/index.css`.

**Arquivos-fonte necessários:** `src/components/utils/sanitizarHtml.ts` (allowlist atual de `style`).

### Etapa 5 — Botões novos: Recuo Esquerda e Recuo Direita

**O que fazer:** implementar o atributo de recuo (`margin-left`, incrementado/decrementado em passos fixos) no(s) nó(s) de bloco relevante(s) (parágrafo, item de lista), com dois comandos novos (aumentar/diminuir recuo); adicionar os dois botões na toolbar. Diminuir recuo abaixo do mínimo (zero) não tem efeito, sem necessidade de desabilitar o botão visualmente (mesmo padrão de tolerância já usado em "Limpar formatação" sobre seleção vazia).

**Por quê:** não existe hoje nenhum controle de recuo no editor; por não haver extensão oficial do Tiptap para isso (registrado na seção 2), é implementação própria, no mesmo padrão de atributo customizado já validado no projeto com `NoBotao.ts`.

**Arquivos alterados:** `src/components/EmailEditorRico.tsx` (ou uma extensão nova dedicada, em `src/components/editor/extensoes/`), `src/components/EmailEditorToolbar.tsx`, `src/components/Icons.tsx`, `src/components/utils/sanitizarHtml.ts`, `src/index.css`.

**Arquivos-fonte necessários:** `src/components/editor/extensoes/NoBotao.ts` (padrão de referência de atributo customizado em nó).

### Etapa 6 — Botão novo: Linha Horizontal

**O que fazer:** adicionar o botão na toolbar, chamando `setHorizontalRule()` (já disponível via `StarterKit`, sem extensão adicional); conferir que `hr` está na allowlist de `sanitizarHtml.ts` e que a exportação "email-safe" (`emailHtmlInline.ts`) produz um `<hr>` com aparência consistente nos clientes de e-mail (estilo inline, já que CSS externo não sobrevive).

**Por quê:** a extensão de base já existe no projeto (só nunca foi exposta na toolbar); o trabalho real desta etapa é garantir que ela sobrevive ao pipeline de sanitização/exportação, igual ao que já foi feito para cor/realce/botão nas revisões anteriores.

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`, `src/components/Icons.tsx`, `src/components/utils/sanitizarHtml.ts`, `src/components/utils/emailHtmlInline.ts`, `src/index.css`.

**Arquivos-fonte necessários:** `src/components/utils/emailHtmlInline.ts` (para saber onde encaixar o tratamento do `hr`).

### Etapa 7 — Botão novo: Tabela (placeholder, sem função)

**O que fazer:** adicionar o botão na toolbar, sem nenhum comando associado — ao clicar, não faz nada (ou exibe um tooltip indicando funcionalidade futura, ex. "Em breve").

**Por quê:** é só o adiantamento visual pedido nesta revisão; a extensão de tabela de fato fica para uma revisão futura, por ser significativamente mais trabalhosa (schema de tabela + exportação bulletproof para e-mail, no mesmo nível de esforço que o botão avançado exigiu nas Etapas 6–8 da revisão anterior).

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`, `src/components/Icons.tsx`.

**Arquivos-fonte necessários:** nenhum adicional.

### Etapa 8 — Redesenho do botão "Botão": cor + link direto no ícone, sem toggle textual

**O que fazer:** remover o botão de ação textual "Transformar em botão"/"Remover botão" de dentro do popover; o clique no ícone da toolbar passa a abrir diretamente o popover com a grade de cores (reaproveitando `PainelCores`) e o campo de link. Escolher uma cor ou aplicar um link a partir de uma seleção que ainda não é um `noBotao` aplica o nó automaticamente (chamando `toggleNoBotao()` internamente antes de gravar o atributo, se ainda não estiver ativo); permanece possível remover o botão via as opções de "Remover cor"/"Remover link" já existentes, sem precisar de um botão de toggle dedicado.

**Por quê:** simplifica o fluxo pedido nesta revisão (um clique a menos) e reaproveita a UI de cor/link que já existe, só mudando quando o nó é de fato aplicado.

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`, `src/index.css` (apenas se o novo fluxo exigir ajuste visual no popover).

**Arquivos-fonte necessários:** `src/components/editor/extensoes/NoBotao.ts`.

### Etapa 9 — "Anexar arquivo" no modal + correção de overflow/scroll — checkpoint

**O que fazer:** adicionar, fora da toolbar (dentro de `EmailConteudoModal.tsx`, abaixo do editor), o botão "Anexar arquivo" acionando um `<input type="file" multiple hidden>`; ao selecionar, listar os arquivos escolhidos em estado local do modal (nome de cada um), cada item com uma opção de remover da lista antes de salvar. Nenhuma integração com envio/persistência — é só a UI, para reaproveitar quando o disparo automático de e-mails ganhar suporte a anexo. Em paralelo, revisar `dialog-content`/`.dialog-content.dialog-rolavel` (`src/index.css`) e a marcação de `EmailConteudoModal.tsx` para que o crescimento do modal com vários arquivos anexados não corte conteúdo nem quebre o layout do rodapé (`Salvar`/`Cancelar`) — usando scroll interno controlado em vez de o modal crescer indefinidamente.

**Por quê é checkpoint:** é a última peça funcional nova desta revisão e a mais provável de expor o bug de overflow/scroll do modal citado na demanda — vale testar isoladamente, anexando vários arquivos com nomes longos, antes do teste manual completo final.

**Arquivos alterados:** `src/components/EmailConteudoModal.tsx`, `src/components/Icons.tsx`, `src/index.css`.

**Arquivos-fonte necessários:** `src/components/Dialog.tsx` (para saber exatamente onde entra o scroll controlado).

### Etapa 10 — Teste manual completo de regressão e fidelidade (revisão completa)

**O que fazer:** repetir o ciclo de teste manual em cima de tudo desta revisão: reconstrução da toolbar (nenhuma função antiga quebrou: negrito/itálico/sublinhado/tachado/cor/realce/link/botão/listas/alinhamento/limpar formatação), responsividade por "Ver Mais" em diferentes larguras, os quatro botões novos (fonte, recuo, linha horizontal, tabela-placeholder), o redesenho do botão "Botão", e o fluxo de anexar/remover arquivos no modal sem overflow. Repetir também o teste de cópia para Gmail/Outlook (mesmo ciclo da revisão anterior) para confirmar que os elementos novos que geram HTML (tamanho de fonte, recuo, `hr`) sobrevivem no destino, e não só na própria plataforma.

**Por quê:** é o único jeito de confirmar, nos ambientes reais, que a reconstrução da toolbar não introduziu nenhuma regressão nas funções já existentes enquanto resolve o bug relatado e adiciona o que foi pedido.

**Arquivos alterados:** nenhum (apenas validação).

**Arquivos-fonte necessários:** nenhum.