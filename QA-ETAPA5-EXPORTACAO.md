# Etapa 5 — Confirmação de que a exportação permanece inalterada

Ver `public/REFATORACAO-EMAIL-TITULO-CONTEUDO.md`. Checklist de verificação de que
nenhum formato exportado (CSV, CSV UTF-8, XLSX, PDF) referencia `email.titulo`/
`email.conteudo` — apenas os campos de `registros` (ID, Nome, E-mail, Status).

## 1. Auditoria estática do código de exportação

### `src/components/utils/exportarPlanilha.ts`
- A única assinatura pública é `exportarRegistros(registros: EmailRecord[], formato)`.
  O parâmetro é tipado como `EmailRecord[]`, não `EmailsData`/`EmailConteudo` — ou
  seja, o conteúdo do e-mail **não é sequer aceito** pela função, não é uma questão
  de omissão manual e sim de contrato de tipos.
- `COLUNAS` é a constante fixa `['ID', 'Nome', 'E-mail', 'Status']`, usada como
  cabeçalho nos 4 formatos.
- `linhasDosRegistros` mapeia cada `registro` apenas para `id`, `nome`, `email`,
  `status` — os únicos campos de `EmailRecord` (que também não inclui título/corpo;
  isso vive em `EmailConteudo`, uma interface separada em `types/email.ts`).
- Os 4 geradores (`exportarCsv`, `exportarCsvUtf8`, `exportarXlsx`, `exportarPdf`)
  só leem `registros` — nenhuma referência a `email`, `titulo`, `conteudo` ou
  `EmailsData`/`EmailConteudo` em todo o arquivo. As únicas ocorrências da palavra
  "conteudo" no arquivo são variáveis locais do texto do CSV já serializado
  (`gerarConteudoCsv`), sem relação com o e-mail a ser enviado.

### `src/components/ExportarModal.tsx`
- Importa apenas `EmailRecord` e `TStatus` de `types/email` — não importa
  `EmailConteudo` nem `EmailsData`. Não há caminho para o conteúdo do e-mail
  chegar até o modal de exportação.

### `src/components/Header.tsx`
- `ExportarModal` recebe `registrosParaExportar` (sempre `EmailRecord[]`,
  nunca o objeto `email`) — confirmado na linha que renderiza
  `<ExportarModal registros={registrosParaExportar} .../>`.

**Conclusão da auditoria estática:** a separação já é garantida em nível de tipos
(TypeScript), não depende de disciplina manual em cada formato — não há como
`titulo`/`conteudo` vazar para a exportação sem antes alterar a assinatura de
`exportarRegistros`.

## 2. Teste manual

Passos executados após a Etapa 3 (modal de edição já funcional):

1. Abrir o modal "Editar e-mail" (dropdown do `Header`) e preencher:
   - Título: `Convite para o evento`
   - Corpo: `Olá! Você está convidado(a) para o evento anual da empresa.`
2. Salvar o modal.
3. Abrir "Exportar planilha" e gerar, um de cada vez:
   - **CSV** — arquivo contém apenas cabeçalho `ID;Nome;E-mail;Status` e as
     linhas de registros. Sem qualquer menção a "Convite" ou ao corpo do e-mail.
   - **CSV (UTF-8)** — mesmo resultado do CSV padrão, apenas com BOM adicional.
   - **XLSX** — planilha `E-mails` com as mesmas 4 colunas; sem aba ou célula
     extra com título/corpo.
   - **PDF** — cabeçalho "Exportação de e-mails" + tabela ID/Nome/E-mail/Status;
     nenhum texto do corpo do e-mail aparece no documento gerado.
4. Repetir a exportação dos 4 formatos sem reabrir o modal — resultado idêntico.

**Resultado:** nos 4 formatos, o conteúdo exportado permanece restrito a
ID, Nome, E-mail e Status, confirmando o critério de conclusão da Etapa 5.

## Observação

Nenhuma alteração de código foi necessária nesta etapa: o isolamento entre
`registros` (exportável) e `email` (não exportável) já estava correto desde a
Etapa 1, quando `EmailRecord` e `EmailConteudo` foram definidos como interfaces
separadas e a exportação foi tipada estritamente sobre `EmailRecord[]`. Esta
etapa documenta a verificação, sem necessidade de refatoração adicional.
