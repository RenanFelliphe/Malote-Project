# Análise de Design dos Modais

Este documento reúne uma análise dos modais existentes no sistema, identificando seus objetivos, funcionalidades, problemas de design e possíveis melhorias.

---

# 1. ConflitoExclusaoModal
**(via `ConflictDialog` + `DeleteConflictContent`)**

## Objetivo

Bloquear a exclusão de registros que possuem status **"Enviado"** dentro de uma seleção, exigindo que o usuário confirme explicitamente quais dos demais registros deverão ser deletados.

## Funcionalidades

- Lista de registros **Enviados** (somente leitura)
- Lista **A Deletar**
  - Checkbox individual
  - Opção **Selecionar Todos**
- Botões:
  - Cancelar
  - Deletar

---

## Problemas de Design

### 1. Scroll interno inexistente

O componente `.dialog-content` utiliza:

```css
overflow: hidden;
```

como comportamento padrão.

Apenas alguns modais (como `ExportarModal`) sobrescrevem esse comportamento.

Consequência:

- quando existem muitos registros enviados;
- ou muitos registros passíveis de exclusão;

o conteúdo ultrapassa o limite de `max-height: 85vh` e simplesmente desaparece, sem qualquer rolagem interna.

### Solução

Criar um corpo rolável padrão para dialogs, semelhante ao utilizado em:

```css
.importacao-corpo
```

com:

```css
overflow-y: auto;
```

Assim o padrão poderá ser reutilizado por qualquer modal que contenha listas grandes.

---

### 2. Nome e e-mail sem layout

As classes

```css
.conflito-nome
.conflito-email
```

não possuem nenhuma regra CSS.

Na prática os registros aparecem como texto corrido, causando:

- desalinhamento;
- pouca hierarquia visual;
- e-mails longos quebrando o layout;
- dificuldade de leitura.

### Solução

Criar um layout em Grid/Flex semelhante ao utilizado na tabela principal.

Exemplo:

- Nome em destaque
- E-mail abaixo
- `text-overflow: ellipsis`
- alinhamento consistente

---

### 3. Checkbox visualmente inconsistente

Os checkboxes utilizam apenas:

```css
accent-color
```

Enquanto isso, o restante do sistema possui controles totalmente customizados.

Exemplo:

- cartões de seleção do `ExportarModal`.

Resultado:

O sistema apresenta duas linguagens visuais diferentes.

### Solução

Criar um componente reutilizável de checkbox customizado para todos os modais com seleção múltipla.

---

# 2. DuplicadosConflitoModal
**(via `ConflictDialog` + `DeleteConflictContent`)**

## Objetivo

Permitir resolver grupos de registros duplicados, removendo registros até que reste pelo menos um ativo.

## Funcionalidades

Mesma estrutura do ConflitoExclusaoModal:

- Enviados
- A Deletar
- Seleção individual
- Seleção total

Existe ainda uma regra adicional:

> Sempre deve permanecer pelo menos um registro ativo.

---

## Problemas de Design

### 1. Herda todos os problemas do ConflitoExclusaoModal

Como utiliza exatamente o mesmo componente (`DeleteConflictContent`), herda:

- ausência de scroll;
- layout ruim dos registros;
- checkbox inconsistente.

---

### 2. Botão desabilitado sem explicação

Quando a seleção faria o grupo ficar vazio, o botão **Deletar** apenas fica desabilitado.

Para o usuário parece um erro.

Não existe nenhuma explicação da regra.

### Solução

Exibir uma mensagem contextual, por exemplo:

> É necessário manter pelo menos um registro ativo neste grupo.

Essa mensagem pode aparecer próxima ao rodapé sempre que:

```text
confirmDisabled == true
```

por causa desta regra específica.

---

# 3. DuplicadosModal
**(Componente atualmente não utilizado)**

## Objetivo

Exibir todos os registros que compartilham o mesmo e-mail.

Modo somente leitura.

Serve como uma consulta rápida ao clicar no badge **Duplicado**.

---

## Funcionalidades

Tabela contendo:

- ID
- Nome
- E-mail
- Status

---

## Problemas de Design

### 1. Código morto

O componente não é importado por nenhuma página.

Foi substituído pelo `DuplicadosConflitoModal`, mas permanece no projeto.

Isso gera:

- dívida técnica;
- confusão durante manutenção;
- risco de reutilização acidental.

### Solução

Definir explicitamente uma das opções:

- remover definitivamente;
- ou reintroduzi-lo como visualização rápida independente das ações de exclusão.

---

### 2. Tabela sem estilo

A classe

```css
.duplicados-tabela
```

não possui nenhuma regra CSS.

Resultado:

A tabela utiliza completamente o estilo padrão do navegador.

Não há:

- bordas;
- alinhamento;
- zebra striping;
- hover;
- identidade visual.

### Solução

Criar uma tabela compacta baseada na `EmailTable`, reutilizando:

- tokens de design;
- bordas;
- cores;
- tipografia;
- hover.

---

### 3. E-mail do grupo sem destaque

A classe

```css
.duplicados-email
```

também não possui estilo.

O e-mail principal do grupo se mistura ao restante do texto.

### Solução

Transformá-lo em subtítulo do modal, seguindo o padrão utilizado por:

```css
.conflict-dialog-descricao
```

---

# 4. EmailConteudoModal

## Objetivo

Editar:

- título;
- corpo do e-mail;

persistindo alterações através da API.

---

## Funcionalidades

- Campo de título
- Textarea
- Estado de salvamento
- Mensagem de erro
- Bloqueio de fechamento durante salvamento

---

## Problemas de Design

### 1. Textarea pouco flexível

O componente utiliza:

```jsx
rows={10}
```

fixo.

Não existe:

- resize vertical;
- altura dinâmica;
- contador de caracteres.

Em textos grandes o usuário perde contexto.

### Solução

Permitir:

```css
resize: vertical;
```

com altura mínima.

Opcionalmente incluir contador de caracteres.

---

### 2. Alterações podem ser perdidas

Caso o usuário clique:

- fora do modal;
- ESC;

o diálogo fecha imediatamente.

Não existe confirmação de perda de alterações.

Enquanto isso, o `ImportWizardModal` já implementa esse comportamento.

### Solução

Reutilizar o mesmo padrão de confirmação quando:

- título;
- conteúdo;

forem diferentes dos valores originalmente carregados.

---

# 5. ExportarModal

## Objetivo

Selecionar:

- quais status exportar;
- qual formato utilizar.

---

## Funcionalidades

- Lista de status
- Contadores
- Barra de progresso
- Seleção de formato
- Exportação
- Tratamento de erro

---

## Pontos positivos

É atualmente o modal visualmente mais consistente do sistema.

Apresenta:

- cartões customizados;
- indicadores por cor;
- barra de progresso;
- boa organização visual.

Pode servir como referência para padronização dos demais modais.

---

## Problemas de Design

### 1. Responsividade intermediária

O grid dos formatos muda para duas colunas apenas em:

```text
≤480px
```

Entre:

```text
481px — 720px
```

os quatro cartões permanecem comprimidos em uma única linha.

### Solução

Adicionar breakpoint intermediário próximo de:

```text
600px
```

mantendo:

- duas colunas;
- melhor espaçamento.

---

### 2. Falta feedback quando nenhuma opção produz resultados

Caso todos os status sejam desmarcados:

- o botão apenas fica desabilitado.

O usuário não sabe o motivo.

### Solução

Mostrar mensagem como:

> Selecione ao menos um status para exportar.

quando:

```text
registrosFiltrados.length === 0
```

---

# 6. ImportWizardModal

## Objetivo

Assistente de quatro etapas para importação de planilhas.

Etapas:

1. Informações
2. Mapeamento
3. Definição
4. Revisão

---

## Funcionalidades

- Stepper
- Leitura assíncrona
- Estados de carregamento
- Tratamento de erro
- Navegação validada
- Confirmação ao cancelar

---

## Pontos positivos

É o modal mais robusto do sistema.

Possui:

- scroll interno adequado;
- stepper visual;
- confirmação de cancelamento;
- tratamento consistente de estados.

---

## Problemas de Design

### 1. Perda de contexto em telas pequenas

Em:

```css
≤720px
```

o rótulo das etapas desaparece:

```css
.importacao-stepper-rotulo {
    display: none;
}
```

Resta apenas:

- número;
- check.

O usuário perde referência sobre a etapa atual.

### Solução

Adicionar um resumo textual acima do stepper.

Exemplo:

```
Etapa 2 de 4 — Mapeamento
```

---

### 2. Inconsistência no fechamento após erro

Quando ocorre erro de leitura da planilha:

- o botão **Fechar** encerra imediatamente o wizard.

Enquanto isso, durante o fluxo normal existe confirmação de cancelamento.

Não chega a ser um problema grave, pois não há progresso salvo, mas gera inconsistência de comportamento.

---

# Fragilidades Sistêmicas

Alguns padrões aparecem repetidamente em diversos modais e representam oportunidades de padronização.

## Scroll interno ausente

O padrão atual utiliza:

```css
.dialog-content {
    overflow: hidden;
}
```

Apenas alguns modais implementam uma área rolável.

Consequência:

Listas grandes podem ser cortadas sem qualquer possibilidade de navegação.

---

## Listas de seleção sem identidade visual

As listas de conflito não possuem layout adequado para:

- nome;
- e-mail;
- alinhamento.

Esse problema tende a se repetir em outros componentes de conflito futuros.

---

## Tabelas HTML sem componente reutilizável

O caso mais evidente é:

```css
.duplicados-tabela
```

que utiliza apenas o estilo padrão do navegador.

O sistema carece de um componente de tabela compacto reutilizável.

---

## Linguagem visual inconsistente

Hoje coexistem dois padrões:

- controles totalmente customizados (ExportarModal);
- checkboxes nativos do navegador.

Padronizar componentes aumentaria a consistência visual do sistema.

---

## Responsividade desigual

Cada modal implementa breakpoints próprios.

Alguns possuem excelente adaptação.

Outros não possuem qualquer ajuste para dispositivos móveis.

Seria interessante estabelecer um conjunto comum de breakpoints para todo o sistema.

---

## Componentes órfãos

O `DuplicadosModal` permanece no projeto mesmo sem utilização.

Além de aumentar dívida técnica, cria dúvidas durante manutenção e evolução do código.

Recomenda-se decidir explicitamente entre:

- removê-lo definitivamente;
- ou reintegrá-lo como funcionalidade de visualização rápida.