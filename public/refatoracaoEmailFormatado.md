# Refatoração — Formatação Rica no Corpo do E-mail

## 1. Contexto do projeto

O **Sistema de Organização e Envio de E-mails** é uma aplicação React 19/TypeScript/Vite. O registro de cada e-mail (`EmailConteudo`, em `src/types/email.ts`) tem hoje um campo `conteudo` de **texto puro**, editado em `EmailConteudoModal.tsx` através de um `<textarea>` simples. Não existe, em nenhum ponto do sistema, um caminho que preserve ou produza HTML — nem na edição, nem na cópia para a área de transferência (`copiarTexto`, em `utils/clipboard.ts`, escreve apenas `text/plain`, chamada pelo botão "Copiar corpo" em `Header.tsx`). Todos os estilos do projeto vivem num único arquivo global, `src/index.css`.

## 2. A demanda

Gmail e Outlook não oferecem formatação de texto nativa na composição — mas aceitam colar conteúdo já formatado (negrito, cor, links, botões etc.), preservando a formatação. Hoje, ao colar um e-mail formatado na nossa plataforma, a formatação se perde (por ser um `<textarea>`), e não há como formatar o texto pela própria plataforma.

## 3. Decisão de escopo (registrada nesta etapa de planejamento)

- **Funções da barra de ferramentas:** negrito, itálico, sublinhado, tachado, cor de texto, highlight (cor de fundo do texto), link, "transformar em botão", lista ordenada simples (sem numeração aninhada tipo "2.1"), lista não ordenada simples (bolinha cheia no nível 1, vazia no nível 2), alinhamento de texto, limpar formatação (aplicada apenas à seleção, não ao documento inteiro).
- **Colar formatado:** o campo passa a aceitar HTML colado, preservando a formatação (dentro do conjunto de marcas suportado acima).
- **Copiar formatado:** o botão "Copiar corpo" (`Header.tsx`) passa a escrever também `text/html` na área de transferência, para que colar no Gmail/Outlook preserve a formatação.
- **Fora de escopo, por decisão explícita:** numeração aninhada de listas (1., 2., 2.1. ...) — mantém-se lista simples, sem essa complexidade.
- **Biblioteca:** o editor será construído sobre o **Tiptap** (baseado em ProseMirror). Não usar `execCommand`/`contenteditable` cru — API deprecada e inconsistente entre navegadores.
- **Modelo de dados:** `conteudo` passa de texto puro para **string HTML**. Compatível com os dados existentes (texto puro é HTML válido sem tags).
- **"Transformar em botão"** será implementado como um **nó de bloco customizado** (não um mark), com estilo padrão fixo (caixa arredondada, cor, padding, margin), para poder conter dentro dele outras marcas (negrito, cor, alinhamento) sem conflito.

> ## ⚠️ Regra de entrega a cada etapa — leia antes de começar
>
> **A cada etapa implementada, a entrega deve ser um único ZIP contendo *todos* os arquivos alterados desde a etapa 1 até a etapa atual — não apenas os da etapa corrente.**
>
> Exemplo: se a etapa atual sendo implementada é a **3**, o zip deve conter todo arquivo que foi alterado (criado ou modificado) nas etapas **1, 2 e 3** juntas. Arquivos que não foram tocados em nenhuma dessas etapas **não** entram no zip, mesmo que existam no projeto.
>
> Cada etapa abaixo lista os arquivos que ela altera (**"Arquivos alterados"**) — o zip de cada etapa é a união desses arquivos com os de todas as etapas anteriores. Também lista os arquivos que preciso ver mas não vou alterar (**"Arquivos-fonte necessários"**) — envie só esses, você não precisa mandar o projeto completo de novo a cada etapa.

## 4. Divisão em etapas

A refatoração está dividida em 15 etapas. As etapas 0 a 2 são estritamente sequenciais (cada uma depende da anterior). A partir da etapa 3, os itens de barra de ferramentas (3 a 8) podem ser feitos em qualquer ordem entre si. As etapas 2, 9/10 e 13 são checkpoints — mudam algo perceptível para quem usa o sistema.

### Etapa 0 — Escolha e instalação da base do editor

**O que fazer:** adicionar `@tiptap/react`, `@tiptap/starter-kit` e as extensões oficiais necessárias (`Underline`, `Strike`, `Color`, `Highlight`, `TextStyle`, `Link`, `TextAlign` — `BulletList`/`OrderedList`/`ListItem` já vêm no starter kit).

**Por quê:** é a decisão de fundação — todas as etapas seguintes dependem dela.

**Arquivos alterados:** `package.json`

**Arquivos-fonte necessários:** nenhum além do próprio `package.json` atual.

### Etapa 1 — Modelo de dados (`types/email.ts`)

**O que fazer:** documentar (via comentário no tipo, seguindo o padrão já usado no projeto) que `conteudo` passa a conter HTML, não texto puro. Nenhuma mudança de schema no JSON é necessária — o campo continua sendo `string`.

**Por quê:** é o ponto que o TypeScript sozinho não vai sinalizar (o tipo continua `string` antes e depois), então precisa ficar documentado explicitamente para quem for mexer depois.

**Decisão registrada aqui:** dado existente (texto puro) não precisa de migração/script, por ser HTML válido por si só.

**Arquivos alterados:** `src/types/email.ts`

**Arquivos-fonte necessários:** nenhum adicional.

### Etapa 2 — Substituir o `<textarea>` pelo editor Tiptap (sem toolbar ainda) — checkpoint

**O que fazer:** criar um componente novo, `EmailEditorRico.tsx`, que encapsula `useEditor`/`EditorContent` do Tiptap com as extensões básicas de texto (sem negrito/itálico/etc. habilitados ainda). Usar esse componente dentro de `EmailConteudoModal.tsx` no lugar do `<textarea>`. Salvar `editor.getHTML()` no lugar do `evento.target.value`.

**Por quê é checkpoint:** é a primeira mudança que altera a experiência de digitação em si — vale testar isoladamente antes de empilhar as próximas etapas em cima.

**Atenção:** o contador de caracteres precisa passar a contar `editor.getText().length` (texto visível), não o tamanho da string HTML.

**Arquivos alterados:** `src/components/EmailEditorRico.tsx` (novo), `src/components/EmailConteudoModal.tsx`, `src/index.css` (estilos base do editor, substituindo `.campo-corpo-email`)

**Arquivos-fonte necessários:** `src/types/email.ts` (etapa 1)

### Etapa 3 — Marcas de texto simples (negrito, itálico, sublinhado, tachado) + toolbar base

**O que fazer:** habilitar `Bold`, `Italic`, `Underline`, `Strike` e criar `EmailEditorToolbar.tsx`, com os 4 botões correspondentes, cada um chamando `editor.chain().focus().toggleBold().run()` (padrão análogo para os outros).

**Por quê:** valida o padrão de toolbar (botão → comando → estado ativo/inativo) antes de ir para os itens mais específicos.

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx` (novo), `src/components/EmailEditorRico.tsx`, `src/index.css`

**Arquivos-fonte necessários:** `src/components/Icons.tsx` (padrão de ícones já usado no projeto, para manter consistência visual)

### Etapa 4 — Cor de texto e highlight

**O que fazer:** habilitar `TextStyle` + `Color` (cor do texto) e `Highlight` (cor de fundo), com uma paleta fixa de cores na toolbar (não um color-picker livre, para manter o editor simples).

**Por quê:** ambas dependem da extensão `TextStyle` como base — por isso ficam juntas nesta etapa.

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`, `src/components/EmailEditorRico.tsx`, `src/index.css`

**Arquivos-fonte necessários:** nenhum adicional.

### Etapa 5 — Link

**O que fazer:** habilitar a extensão `Link` e adicionar um botão que abre um input simples (inline ou popover) para a URL, aplicando `editor.chain().focus().setLink({ href }).run()`.

**Por quê:** é o primeiro item que precisa de uma UI própria — serve de base de padrão para o botão de "transformar em botão" (etapa 7).

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`, `src/components/EmailEditorRico.tsx`, `src/index.css`

**Arquivos-fonte necessários:** `src/components/Dialog.tsx` ou `src/components/ConfirmDialog.tsx` (só se optar por reaproveitar um padrão visual de popover já existente no projeto)

### Etapa 6 — Listas simples (ordenada e não ordenada)

**O que fazer:** habilitar `BulletList`/`OrderedList`/`ListItem` com os estilos padrão (`disc` no primeiro nível, `circle` no segundo — sem numeração aninhada customizada). Botões de toggle na toolbar.

**Por quê:** por decisão de escopo, não entra lógica de numeração tipo "2.1.", o que simplifica bastante esta etapa.

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`, `src/index.css`

**Arquivos-fonte necessários:** nenhum adicional.

### Etapa 7 — "Transformar em botão" (nó customizado)

**O que fazer:** criar uma extensão de nó Tiptap (`NoBotao.ts`) que envolve a seleção atual num bloco com estilo padrão fixo (caixa arredondada, cor de fundo, padding, margin, centralizado), permitindo que marcas internas (negrito, cor, alinhamento) continuem aplicáveis ao texto dentro dele. Registrar a extensão no editor e adicionar o botão de toggle na toolbar.

**Por quê:** é o item de maior complexidade da lista de funções — não existe pronto no Tiptap, precisa ser modelado como nó customizado, exatamente pela exigência de aceitar formatações adicionais por dentro.

**Arquivos alterados:** `src/components/editor/extensoes/NoBotao.ts` (novo), `src/components/EmailEditorRico.tsx`, `src/components/EmailEditorToolbar.tsx`, `src/index.css`

**Arquivos-fonte necessários:** nenhum adicional além do que já foi entregue nas etapas anteriores.

### Etapa 8 — Alinhamento de texto

**O que fazer:** habilitar a extensão `TextAlign` (esquerda, centro) nos tipos de nó relevantes (parágrafo, e o nó de botão da etapa 7).

**Por quê:** precisa vir depois da etapa 7 para garantir que o botão de "transformar em botão" já aceite alinhamento por dentro.

**Arquivos alterados:** `src/components/EmailEditorRico.tsx`, `src/components/EmailEditorToolbar.tsx`, `src/index.css`

**Arquivos-fonte necessários:** `src/components/editor/extensoes/NoBotao.ts` (etapa 7, para garantir compatibilidade)

### Etapa 9 — Colar formatado (paste) — checkpoint

**O que fazer:** configurar as regras de paste do Tiptap (`transformPastedHTML`/paste rules) para aceitar HTML colado de fora, normalizando para o conjunto de marcas/nós suportado (o que não é suportado é descartado ou convertido para texto simples, sem quebrar o editor).

**Por quê é checkpoint:** é a mudança que resolve a queixa original ("colar e perder formatação") — vale testar com conteúdo colado do Gmail, Outlook e Word.

**Arquivos alterados:** `src/components/EmailEditorRico.tsx`

**Arquivos-fonte necessários:** nenhum adicional.

### Etapa 10 — Sanitização do HTML colado/armazenado

**O que fazer:** aplicar um sanitizador (`DOMPurify`) sobre o HTML antes de salvar, removendo `<script>`, atributos `on*` e qualquer tag fora da lista permitida.

**Por quê:** conteúdo colado vem de fora do sistema — sem sanitização, HTML malicioso colado poderia ser executado em qualquer lugar que renderize esse `conteudo` como HTML depois.

**Arquivos alterados:** `src/components/utils/sanitizarHtml.ts` (novo), `package.json` (dompurify), `src/components/EmailEditorRico.tsx`

**Arquivos-fonte necessários:** nenhum adicional.

### Etapa 11 — Limpar formatação (seleção)

**O que fazer:** botão que aplica `editor.chain().focus().unsetAllMarks().clearNodes().run()` restrito à seleção atual.

**Por quê:** depende das etapas 3 a 8 já estarem prontas — só faz sentido "limpar" formatações que já existem.

**Arquivos alterados:** `src/components/EmailEditorToolbar.tsx`

**Arquivos-fonte necessários:** nenhum adicional.

### Etapa 12 — Serialização "email-safe" (estilos inline)

**O que fazer:** criar uma função de exportação (`emailHtmlInline.ts`) que percorre o HTML do editor e converte classes/CSS para **estilos inline** (`style="..."`), já que Gmail e Outlook descartam `<style>` e, em boa parte dos casos, `class`.

**Por quê:** sem isso, tudo que foi construído nas etapas anteriores funciona dentro da plataforma mas perde a aparência ao ser colado no Gmail/Outlook.

**Arquivos alterados:** `src/components/utils/emailHtmlInline.ts` (novo)

**Arquivos-fonte necessários:** `src/index.css` (para saber quais estilos precisam virar inline — negrito, cor, highlight, link, botão, listas, alinhamento)

### Etapa 13 — Copiar formatado (clipboard) — checkpoint

**O que fazer:** criar uma nova função em `clipboard.ts` (ex. `copiarHtml`) que escreve um `ClipboardItem` com `text/html` (usando o HTML "email-safe" da etapa 12) **e** `text/plain` como fallback. Atualizar o botão "Copiar corpo" em `Header.tsx` para usar essa função.

**Por quê é checkpoint:** fecha o segundo lado da demanda original — copiar da plataforma e colar no Gmail/Outlook já formatado.

**Arquivos alterados:** `src/components/utils/clipboard.ts`, `src/components/Header.tsx`

**Arquivos-fonte necessários:** `src/components/utils/emailHtmlInline.ts` (etapa 12), `src/types/email.ts`

### Etapa 14 — Revisão do wizard de importação

**O que fazer:** revisar `EtapaDefinicao.tsx` (dentro do wizard de importação, hoje com seu próprio `<textarea>` para um `conteudo` inicial) e decidir se também vira rich-text ou permanece texto puro por ser um valor padrão inicial, não um e-mail final.

**Por quê:** é o único outro ponto do sistema, além do modal de edição e do `Header`, que lida com `conteudo` — ficou de fora das etapas anteriores de propósito, para não misturar a construção do editor com a adaptação de um consumidor externo a ele.

**Arquivos alterados:** `src/components/import/EtapaDefinicao.tsx` (conforme decisão tomada nesta etapa)

**Arquivos-fonte necessários:** `src/components/import/types.ts`, `src/components/import/ImportWizardModal.tsx` (contexto de como o estado é usado no wizard), `src/components/EmailEditorRico.tsx` (caso decida reaproveitar o mesmo editor aqui)

### Etapa 15 — Teste manual de fidelidade ponta a ponta

**O que fazer:** ciclo completo manual — colar conteúdo do Gmail/Outlook/Word na plataforma, editar com a toolbar, copiar de volta e colar no Gmail e no Outlook, conferindo negrito/cor/link/botão/listas/alinhamento em cada destino.

**Por quê:** é o único jeito de validar a demanda original de fato — o comportamento de paste/copy de HTML varia por cliente de e-mail de um jeito que não dá pra garantir só por inspeção de código.

**Arquivos alterados:** nenhum (apenas validação).

**Arquivos-fonte necessários:** nenhum.
