# Refatoração — Correção e Evolução do Editor Rico

## 1. Contexto desta revisão

O plano anterior (`refatoracaoEmailFormatado.md`, etapas 0–15) já foi implementado: o editor rico Tiptap está no ar, substituindo o `<textarea>` original, com toolbar, paste formatado, sanitização e cópia com `text/html`. Uma rodada de teste manual (prints da plataforma e do Outlook) revelou que **parte** das funções não sobrevive até o destino final (Gmail/Outlook), e outra parte ficou incompleta em relação ao que o produto precisa.

Este documento organiza a correção dos bugs encontrados e a implementação do que faltou, em cima do código já existente — não é um retrabalho do zero.

### 1.1 O que os prints confirmam

Comparando o print da plataforma com o print do rascunho no Outlook, lado a lado:

| Formatação | Plataforma | Outlook | Situação |
|---|---|---|---|
| Negrito, Itálico, Sublinhado, Tachado | ✅ | ✅ | OK |
| Link | ✅ | ✅ | OK |
| Listas (ordenada/desordenada, com sublista) | ✅ | ✅ | OK |
| Alinhamento centralizado | ✅ | ✅ | OK |
| Cor de texto | ✅ (azul) | ❌ (texto preto liso) | **Quebrado** |
| Realce | ✅ (fundo destacado) | ❌ (sem fundo) | **Quebrado** |
| Botão | ✅ (caixa arredondada azul) | ❌ (texto em negrito solto, sem caixa, sem cor, sem link) | **Quebrado** |

Isso **revisa** a hipótese registrada na análise anterior: antes eu havia levantado que a cor de texto provavelmente sobrevivia de ponta a ponta no código e o problema seria só uma limitação do motor de renderização do Outlook. O print derruba essa hipótese — cor de texto e realce falham exatamente do mesmo jeito visual, o que aponta para os dois serem descartados no **mesmo trecho do nosso próprio pipeline** (sanitização e/ou geração do HTML "email-safe" usado na cópia), e não para uma limitação externa do Outlook. A Etapa 0 abaixo trata os dois como uma causa provavelmente única, a ser confirmada por inspeção direta do código antes de decidir a correção exata.

## 2. Decisões de escopo desta revisão

- **Botão avançado:** cor do botão reaproveita o mesmo componente de paleta já usado em Cor de Texto/Realce (não um color-picker livre, mantendo a decisão original de escopo). Alinhamento do botão passa a seguir a mesma extensão `TextAlign` usada no texto, e não mais um valor fixo de CSS.
- **Toolbar responsiva:** a resolução da responsividade é por **agrupamento em seções com popover**, nunca por quebra de linha. As seções são fixas: Funções Básicas, Extras, Listas, Alinhamento, Limpar Formatação — nessa ordem.
- **Emoji:** usar biblioteca pronta (não construir do zero), por já existirem soluções maduras com categorias e busca no ecossistema React.

> ## ⚠️ Regra de entrega a cada etapa — leia antes de começar
>
> **A cada etapa implementada, a entrega deve ser um único ZIP contendo *todos* os arquivos alterados desde a Etapa 0 desta revisão até a etapa atual — não apenas os da etapa corrente.**
>
> A mesma regra do plano anterior se aplica aqui, reiniciando a contagem cumulativa a partir da Etapa 0 deste documento (o plano anterior já foi entregue e mesclado ao projeto).

## 3. Divisão em etapas

As etapas 0 e 1 são de correção de bugs e devem vir primeiro, pois travam a confiabilidade de tudo que já existe. As etapas 2–5 são de melhoria/completude e podem ser feitas em qualquer ordem entre si. As etapas 6–8 (botão avançado) são sequenciais entre si. A etapa 9 (emoji) é independente e pode entrar em paralelo a qualquer momento a partir da etapa 1. As etapas 1, 5, 8 e 10 são checkpoints.

### Etapa 0 — Diagnóstico de código: por que cor de texto e realce se perdem

**O que fazer:** antes de qualquer correção, inspecionar na ordem: (1) `sanitizarHtml.ts` — conferir `ALLOWED_TAGS` (confirmar ausência de `mark`) e principalmente `ALLOWED_ATTR` (confirmar se `style` está de fato liberado para todas as tags ou só para algumas); (2) `clipboard.ts` — conferir qual HTML é de fato escrito no `ClipboardItem` (`text/html`): se é `editor.getHTML()` direto, o resultado de `emailHtmlInline()`, ou uma terceira fonte; (3) `emailHtmlInline.ts` — conferir se, ao processar o HTML para o formato "email-safe", alguma etapa de conversão classe→estilo acaba sobrescrevendo ou removendo o `style` que já existia no `span`/`mark` original, em vez de só complementar.

**Por quê:** o sintoma nos prints (cor e realce falham de forma idêntica, enquanto negrito/itálico/sublinhado/tachado/link funcionam) sugere uma causa comum ligada a como `style` é tratado no pipeline de sanitização/exportação — mas a análise anterior (baseada só em leitura de trechos do código) apontava para hipóteses diferentes para cada um dos dois casos. É preciso confirmar contra o código real antes de decidir o que corrigir, para não aplicar a correção errada em cima de um diagnóstico presumido.

**Arquivos alterados:** nenhum (etapa de investigação).

**Arquivos-fonte necessários:** `src/components/utils/sanitizarHtml.ts`, `src/components/utils/clipboard.ts`, `src/components/utils/emailHtmlInline.ts`, `src/components/Header.tsx`.

### Etapa 1 — Correção: cor de texto e realce chegando ao Outlook/Gmail — checkpoint

**O que fazer:** com base no diagnóstico da Etapa 0, aplicar a correção no ponto exato identificado — candidatos previstos: adicionar `mark` à allowlist de tags e garantir `style` liberado para `span`/`mark` em `sanitizarHtml.ts`; e/ou corrigir `emailHtmlInline.ts` para preservar (não sobrescrever) o `style` inline já presente nesses elementos.

**Por quê é checkpoint:** é a correção do bug mais visível relatado — vale testar isoladamente, repetindo o ciclo colar-copiar-colar no Outlook e no Gmail, antes de empilhar as próximas etapas.

**Arquivos alterados:** `src/components/utils/sanitizarHtml.ts` e/ou `src/components/utils/emailHtmlInline.ts` (conforme achado da Etapa 0).

**Arquivos-fonte necessários:** nenhum adicional além do que já foi visto na Etapa 0.

### Etapa 2 — Alinhamento: adicionar direita e justificado

**O que fazer:** trocar `TextAlign.configure({ alignments: ['left', 'center'], ... })` para incluir `'right'` e `'justify'` em `EmailEditorRico.tsx`; adicionar os dois ícones (`IconeAlinharDireita`, `IconeAlinharJustificado`) em `Icons.tsx`; adicionar os dois botões correspondentes em `EmailEditorToolbar.tsx`.

**Por quê:** já é suportado nativamente pela extensão oficial do Tiptap — os outros dois valores só não foram habilitados na configuração original. É a correção mais simples do lote.

**Arquivos alterados:** `src/components/EmailEditorRico.tsx`, `src/components/EmailEditorToolbar.tsx`, `src/components/Icons.tsx`, `src/index.css`.

**Arquivos-fonte necessários:** nenhum adicional.

### Etapa 3 — Limpar formatação: revisão pós-alinhamento

**O que fazer:** confirmar que `unsetAllMarks().clearNodes()` (já implementado) também neutraliza corretamente os novos valores de alinhamento, sem quebrar a seleção. Ajustar apenas se o teste manual encontrar algum caso não coberto.

**Por quê:** "Limpar formatação" foi originalmente implementado antes do alinhamento completo existir — vale confirmar que continua consistente com essa adição nova.

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx` (apenas se o teste apontar ajuste necessário).

**Arquivos-fonte necessários:** nenhum adicional.

### Etapa 4 — Toolbar em seções: estrutura e componente de grupo

**O que fazer:** criar um componente reutilizável de grupo (`ToolbarGrupo.tsx`, por exemplo), no padrão de gatilho fechado + painel dropdown já usado em `OrdenacaoPrioridade.tsx` e no `PainelCores` existente dentro de `EmailEditorToolbar.tsx` (reaproveitando `painelAberto`/`ref`/clique-fora/Escape). Reorganizar `EmailEditorToolbar.tsx` em cinco grupos fixos, nesta ordem: **Funções Básicas** (Negrito, Itálico, Sublinhado, Tachado), **Extras** (Cor de Texto, Realce, Link, Botão), **Listas** (Desordenada, Ordenada), **Alinhamento** (Esquerda, Centro, Direita, Justificado), **Limpar Formatação**.

**Por quê:** é a base estrutural da responsividade pedida — sem essa reorganização em grupos, não há o que colapsar depois.

**Arquivos alterados:** `src/components/editor/ToolbarGrupo.tsx` (novo), `src/components/EmailEditorToolbar.tsx`, `src/index.css`.

**Arquivos-fonte necessários:** `src/components/OrdenacaoPrioridade.tsx` (padrão de referência de popover já usado no projeto).

### Etapa 5 — Toolbar responsiva: colapso automático por largura — checkpoint

**O que fazer:** implementar a lógica de decidir, por grupo, se os botões aparecem expandidos (inline) ou colapsados atrás do gatilho do grupo, reagindo à largura disponível do container da toolbar — via `ResizeObserver` no elemento da toolbar, ou via `@container` queries de CSS. Em nenhum cenário os botões devem quebrar para uma segunda linha soltos; a alternativa a "caber" é sempre "virar grupo colapsado".

**Por quê é checkpoint:** é a mudança de comportamento mais perceptível desta revisão para quem usa o sistema no dia a dia (editor com toolbar diferente da atual) — vale testar em diferentes larguras de tela antes de seguir para o botão avançado.

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`, `src/components/editor/ToolbarGrupo.tsx`, `src/index.css`.

**Arquivos-fonte necessários:** nenhum adicional.

### Etapa 6 — Botão avançado: atributos de cor e link no nó

**O que fazer:** adicionar `addAttributes()` ao node `NoBotao.ts` para `cor` (background) e `href` (destino), persistidos como `data-cor`/`data-href` e refletidos no `style`/serialização do nó (`renderHTML`/`parseHTML`).

**Por quê:** hoje o node não tem nenhum atributo — cor vem de uma constante fixa (`COR_ACENTO`) em `emailHtmlInline.ts` e não existe `href` em lugar nenhum, por isso o botão nunca foi clicável. É a mesma abordagem já usada no projeto para `Link` (atributo de marca) e `Highlight` (atributo `color`), só que aplicada a um node em vez de a uma mark.

**Arquivos alterados:** `src/components/editor/extensoes/NoBotao.ts`.

**Arquivos-fonte necessários:** nenhum adicional.

### Etapa 7 — Botão avançado: UI de cor + link + alinhamento reativo

**O que fazer:** criar o popover do botão "Transformar em botão", reaproveitando o componente de paleta já usado em Cor de Texto/Realce (para a cor do botão) e o mesmo padrão de input de URL já usado no botão de Link (para o `href`). Corrigir o CSS: hoje `.email-botao` tem `margin: 0.6em auto` fixo, centralizando o bloco independentemente do `text-align` aplicado — trocar por margens condicionais ao valor de `TextAlign` do próprio node (`left`/`center`/`right`) e `width: 100%` para `justify`, para que o alinhamento do botão passe a seguir de fato a seleção feita na seção Alinhamento da toolbar, e não um valor fixo.

**Por quê:** fecha a lacuna de personalização pedida (hoje todo botão do sistema sai com a mesma cor, sem link, sempre centralizado). Depende da Etapa 6 (atributos já precisam existir no node antes de a UI poder gravá-los).

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`, `src/components/editor/extensoes/NoBotao.ts`, `src/index.css`.

**Arquivos-fonte necessários:** `src/components/editor/extensoes/NoBotao.ts` (etapa 6).

### Etapa 8 — Botão avançado: exportação bulletproof para Outlook — checkpoint

**O que fazer:** em `emailHtmlInline.ts`, substituir a exportação do node de `<div>` com CSS puro por uma estrutura "bulletproof" de e-mail: `<table><tr><td style="background-color:...; border-radius:...">` contendo um `<a href="...">` real como link, com fallback VML via comentários condicionais `<!--[if mso]>` para preservar o arredondamento no Outlook Desktop.

**Por quê é checkpoint:** o motor de renderização do Outlook Desktop (baseado no Word) não aplica `background-color`/`border-radius`/`padding` de forma confiável em `<div>`/`<span>` — só em `<table>`/`<td>` ou via VML. É a correção que finalmente faz o botão aparecer como botão (com cor, formato e link) no Outlook, então merece teste isolado antes de seguir.

**Arquivos alterados:** `src/components/utils/emailHtmlInline.ts`.

**Arquivos-fonte necessários:** `src/components/editor/extensoes/NoBotao.ts` (para saber exatamente quais atributos/estrutura o node expõe após as etapas 6 e 7).

### Etapa 9 — Botão flutuante de emojis: instalação e componente

**O que fazer:** adicionar a biblioteca de emoji picker escolhida (`emoji-mart`/`@emoji-mart/react` ou `emoji-picker-react`) ao `package.json`; criar `EmojiPickerFlutuante.tsx`, com um botão fixo (`position: absolute`) no canto inferior direito do modal `EmailConteudoModal.tsx`, seguindo o padrão visual de outros elementos flutuantes já existentes no projeto.

**Por quê:** não existe nada de emoji hoje no projeto (nenhuma dependência, nenhum componente). Usar biblioteca pronta evita o trabalho contínuo de manter atualizada uma base de dados de emojis alinhada à spec Unicode.

**Arquivos alterados:** `package.json`, `src/components/EmojiPickerFlutuante.tsx` (novo), `src/index.css`.

**Arquivos-fonte necessários:** `src/components/EmailConteudoModal.tsx` (para posicionar o botão flutuante corretamente dentro do modal).

### Etapa 10 — Botão flutuante de emojis: integração com o editor — checkpoint

**O que fazer:** ao selecionar um emoji no popover, inserir o caractere no cursor via `editor.chain().focus().insertContent(emoji).run()` (API padrão do Tiptap); conectar `EmojiPickerFlutuante.tsx` a `EmailEditorRico.tsx`.

**Por quê é checkpoint:** fecha a última demanda nova desta revisão — vale confirmar que o emoji inserido sobrevive normalmente à sanitização (é só texto Unicode dentro de um `<p>`, já permitido) e à cópia formatada para Outlook/Gmail, sem tratamento especial necessário.

**Arquivos alterados:** `src/components/EmailEditorRico.tsx`, `src/components/EmojiPickerFlutuante.tsx`.

**Arquivos-fonte necessários:** nenhum adicional.

### Etapa 11 — Teste manual de fidelidade ponta a ponta (revisão completa)

**O que fazer:** repetir o ciclo completo de teste manual desta revisão — colar conteúdo do Gmail/Outlook/Word, aplicar cada função da toolbar reorganizada (incluindo alinhamento completo e botão avançado com cor/link/alinhamento), inserir emojis, copiar de volta e colar no Gmail e no Outlook — conferindo especificamente que cor de texto, realce e botão (cor, formato, link e alinhamento) agora sobrevivem nos dois clientes, o que era o conjunto de bugs que motivou esta revisão.

**Por quê:** é o único jeito de confirmar que os três bugs relatados (cor, realce, botão) foram de fato resolvidos nos ambientes reais, já que o comportamento de paste/copy de HTML varia por cliente de e-mail de um jeito que não dá para garantir só por inspeção de código.

**Arquivos alterados:** nenhum (apenas validação).

**Arquivos-fonte necessários:** nenhum.
