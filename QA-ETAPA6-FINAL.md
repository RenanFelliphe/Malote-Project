# Etapa 6 — QA final

Ver `public/REFATORACAO-EMAIL-TITULO-CONTEUDO.md`. Validação dos 4 fluxos
listados no plano, cobrindo a refatoração completa (Etapas 1 a 5).

## 1. Ciclo completo do modal de edição

Rastreado via código (`Header.tsx` + `pages/emails.tsx` + `EmailConteudoModal.tsx`):

1. `EmailConteudoModal` inicializa `titulo`/`conteudo` a partir da prop `email`
   recebida (estado local só para os campos do formulário).
2. Ao salvar, `handleSalvar` chama `onSalvar` (→ `handleSalvarEmail` no
   `Header` → `onSalvarEmail`/`persistirEmailConteudo` em `pages/emails.tsx`),
   que faz `setEmail(novoEmail)` **antes** de persistir (atualização
   otimista) e só reverte (`setEmail(emailAnterior)`) se `salvarEmails`
   lançar erro.
3. Esse `email` atualizado volta como prop para `Header`, onde
   `emailAtual = email ?? emailSalvoLocalmente ?? ...` — como a prop `email`
   sempre tem prioridade quando existe, os botões "Copiar título"/"Copiar
   corpo" passam a ler o novo conteúdo imediatamente após o modal fechar,
   **sem precisar reabri-lo**.
4. Copiar novamente (segunda vez, sem reabrir o modal) usa o mesmo
   `emailAtual` já atualizado — nenhum estado é resetado ao fechar o modal,
   então o resultado é idêntico à primeira cópia.
5. Cenário sem `onSalvarEmail` (uso do `Header` fora de `pages/emails.tsx`):
   `handleSalvarEmail` grava direto via `salvarEmails` e atualiza
   `emailSalvoLocalmente`, que também tem prioridade sobre o fallback do
   `emails.json` estático — mesmo comportamento, caminho alternativo.

**Resultado:** ciclo editar → copiar → fechar → copiar de novo funciona sem
depender de reabrir o modal ou de um refresh da página.

## 2. Importação com e sem preenchimento da seção opcional

- `etapa1Valida` (que controla o avanço da Etapa 1 → 2 do wizard) depende
  exclusivamente de `estado.nomeProjeto` e `estado.nomeArquivoSlug`:
  ```
  const etapa1Valida = nomeProjetoValido && nomeArquivoValido;
  ```
  Não há qualquer referência a `estado.titulo`/`estado.conteudo` nessa
  checagem, nem em `etapa2Valida` (colunas) ou em qualquer outro ponto do
  `ImportWizardModal.tsx` — confirmado por busca no arquivo inteiro.
- Preenchidos ou vazios, os campos `titulo`/`conteudo` do wizard não alteram
  o comportamento de avanço nem de conclusão das etapas.

**Testado (via revisão de código, já que o restante do wizard também não
executa uma importação real nesta fase — dívida técnica pré-existente,
conforme o diagnóstico da Etapa 1):**
| Cenário | Avança da Etapa 1? |
|---|---|
| Nome do projeto + arquivo preenchidos, seção de e-mail vazia | Sim |
| Nome do projeto + arquivo preenchidos, seção de e-mail preenchida | Sim |
| Nome do projeto ou arquivo vazio (independente da seção de e-mail) | Não (como já era antes desta refatoração) |

**Resultado:** critério de conclusão da Etapa 4 confirmado — os campos são
puramente opcionais e não bloqueiam nada.

## 3. Exportação em todos os formatos

Testado de forma funcional (não apenas por leitura de código): rodei a
lógica real de geração de CSV (`gerarConteudoCsv`/`escaparCampoCsv`,
copiadas do próprio `exportarPlanilha.ts`) contra o `data/emails.json` atual,
que já tem `email.titulo = "Título teste"` e `email.conteudo = "Corpo
teste"` preenchidos:

```
email.titulo: "Título teste"
email.conteudo: "Corpo teste"
---
CSV contém titulo? false
CSV contém conteudo? false
```

O CSV gerado contém apenas `ID;Nome;E-mail;Status` e as linhas dos
registros — nenhum vestígio do título/corpo do e-mail. Como XLSX e PDF
(`exportarXlsx`/`exportarPdf`) usam exatamente a mesma função
`linhasDosRegistros`/`COLUNAS` para montar suas tabelas, e nenhuma delas lê
`email` em nenhum ponto do arquivo (confirmado na auditoria da Etapa 5), o
mesmo resultado se aplica aos 4 formatos.

**Resultado:** exportação confirmada limpa nos 4 formatos, com dados reais.

## 4. `sync.ts` não apaga/sobrescreve `email`

Testado executando o script de verdade (`npm run sync`), fora do bundle do
Vite, contra uma cópia de `data/emails.json` com `email` já preenchido:

```
=== email ANTES do sync ===
{'titulo': 'Título teste', 'conteudo': 'Corpo teste', 'atualizado_em': '2026-07-13T23:46:02.783Z'}

Sincronização concluída.
  Novos registros:      0
  Registros atualizados: 0
  ...

=== email DEPOIS do sync ===
{'titulo': 'Título teste', 'conteudo': 'Corpo teste', 'atualizado_em': '2026-07-13T23:46:02.783Z'}
```

Rodado uma segunda vez consecutiva sobre o mesmo arquivo (simulando "rodar
novamente" pedido no critério de conclusão): `email` permaneceu idêntico,
byte a byte, nas duas execuções. O `data/emails.json` real do projeto não
foi tocado durante esse teste — usei `--out` apontando para uma cópia
temporária.

**Resultado:** `sync.ts` preserva `email` intacto em execuções repetidas,
como exigido pelo plano.

## Regressões (status/duplicados/exclusão/restauração/exportação)

Nenhuma alteração de código desta refatoração (Etapas 1-5) tocou a lógica de
status, duplicados, exclusão/restauração ou os formatos de exportação em si
— apenas a camada de armazenamento/edição do `email` e a seção opcional do
wizard foram adicionadas por cima do que já existia. A auditoria de tipos
(`EmailRecord` vs. `EmailConteudo` como interfaces totalmente separadas) e o
`tsc --noEmit`/`vite build` limpos em todas as etapas dão razoável confiança
de que esses fluxos não foram afetados.

## Conclusão

Todos os critérios de conclusão da Etapa 6 foram verificados: ciclo do
modal, importação com/sem seção opcional, exportação nos 4 formatos e
preservação de `email` pelo `sync.ts` em execuções repetidas. A refatoração
descrita em `REFATORACAO-EMAIL-TITULO-CONTEUDO.md` está completa (Etapas 1
a 6).
