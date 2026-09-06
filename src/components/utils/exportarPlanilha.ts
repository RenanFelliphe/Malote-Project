/**
 * Geração e download dos arquivos de exportação da planilha (CSV, CSV
 * UTF-8, XLSX e PDF), usados pelo `ExportarModal` — acessível a partir do
 * menu de configurações do cabeçalho (`Header`, item "Exportar planilha"),
 * tanto para uma única planilha quanto (Etapa 4 de
 * implementacaoExportacaoHome.md) para várias de uma vez, empacotadas num
 * `.zip`.
 *
 * Todos os formatos exportam o mesmo conjunto de colunas (ID, Nome,
 * E-mail, Status), já a partir dos registros previamente filtrados pelo
 * modal (seleção de status) — este módulo só cuida de serializar cada
 * formato e disparar o download (avulso ou em lote), sem regra de negócio
 * de filtragem.
 *
 * XLSX, PDF e JSZip são carregados via import dinâmico (code-splitting do
 * Vite): a maioria das exportações tende a usar CSV de uma única planilha,
 * então não faz sentido incluir essas bibliotecas maiores no bundle
 * inicial da aplicação.
 *
 * Cada formato tem dois geradores que compartilham a mesma construção do
 * conteúdo (colunas, layout do PDF, planilha do XLSX) — um dispara o
 * download direto (usado por `exportarRegistros`, planilha única) e outro
 * retorna um `Blob` (usado por `exportarRegistrosEmLote`, para empacotar
 * no `.zip`) — sem duplicar a lógica de geração em si.
 *
 * Etapa 3 (`LogsDeAlteracoes.md`, Demanda 9): toda exportação bem-sucedida
 * (avulsa ou, uma linha por planilha, em lote) é confirmada via `POST
 * /api/logs` (`registrarLogCliente`, `services/logsApi.ts`) — só depois do
 * download já ter sido disparado, nunca antes.
 */
import type { EmailRecord } from '../../types/email';
import { registrarLogCliente } from '../../services/logsApi';

export type TFormatoExportacao = 'csv' | 'csv-utf8' | 'xlsx' | 'pdf';

/** Extensão de arquivo de cada formato (dois formatos — csv e csv-utf8 — compartilham `.csv`). */
const EXTENSAO_POR_FORMATO: Record<TFormatoExportacao, string> = {
  csv: 'csv',
  'csv-utf8': 'csv',
  xlsx: 'xlsx',
  pdf: 'pdf',
};

const COLUNAS = ['ID', 'Nome', 'E-mail', 'Status'] as const;

function linhasDosRegistros(registros: EmailRecord[]): string[][] {
  return registros.map((registro) => [String(registro.id), registro.nome, registro.email, registro.status]);
}

/** Recorta um texto para caber em uma coluna de largura fixa (usado só no PDF). */
function recortar(texto: string, maxCaracteres: number): string {
  return texto.length > maxCaracteres ? `${texto.slice(0, maxCaracteres - 1)}…` : texto;
}

/**
 * Escapa um campo para CSV: cerca com aspas quando o valor contém o
 * separador, aspas ou quebra de linha, dobrando aspas internas (RFC 4180).
 * Separador usado é `;` (não `,`), pois é o padrão reconhecido pelo Excel
 * em configurações de locale pt-BR — mesmo critério já adotado pela
 * exportação para a área de transferência (ver `utils/clipboard.ts`).
 */
function escaparCampoCsv(valor: string): string {
  if (/[;"\n]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

function gerarConteudoCsv(registros: EmailRecord[]): string {
  const linhas = [COLUNAS as unknown as string[], ...linhasDosRegistros(registros)];
  return linhas.map((linha) => linha.map(escaparCampoCsv).join(';')).join('\r\n');
}

/**
 * Nome de arquivo com o slug do projeto (quando disponível) e a data de
 * geração, ex.: `projeto-teste-2026-07-08.csv`. Antes da Etapa 9, o
 * prefixo era sempre fixo (`emails-`), o que gerava o mesmo nome de
 * arquivo independente de qual projeto estava aberto — agora reflete o
 * projeto de origem. Também usado (Etapa 4) para nomear cada arquivo
 * individual dentro do `.zip` da exportação em lote, com o slug de cada
 * planilha no lugar do prefixo.
 */
function nomeArquivo(extensao: string, prefixo: string): string {
  const dataDeHoje = new Date().toISOString().slice(0, 10);
  return `${prefixo}-${dataDeHoje}.${extensao}`;
}

/** Nome do `.zip` da exportação em lote (Etapa 4) — sem prefixo de projeto, já que reúne várias planilhas. */
function nomeArquivoZip(): string {
  const dataDeHoje = new Date().toISOString().slice(0, 10);
  return `planilhas-${dataDeHoje}.zip`;
}

function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * CSV "padrão" (sem BOM). Acentos podem exibir errado em algumas versões
 * do Excel quando abertos diretamente por duplo clique — para esse caso
 * existe a opção "CSV (UTF-8)" abaixo.
 */
function gerarBlobCsv(registros: EmailRecord[]): Blob {
  return new Blob([gerarConteudoCsv(registros)], { type: 'text/csv;charset=utf-8' });
}

function exportarCsv(registros: EmailRecord[], prefixo: string) {
  baixarBlob(gerarBlobCsv(registros), nomeArquivo('csv', prefixo));
}

/** CSV com BOM UTF-8, para o Excel reconhecer a codificação e exibir corretamente nomes acentuados. */
function gerarBlobCsvUtf8(registros: EmailRecord[]): Blob {
  return new Blob([`\uFEFF${gerarConteudoCsv(registros)}`], { type: 'text/csv;charset=utf-8' });
}

function exportarCsvUtf8(registros: EmailRecord[], prefixo: string) {
  baixarBlob(gerarBlobCsvUtf8(registros), nomeArquivo('csv', prefixo));
}

/** Monta o livro XLSX (SheetJS) — compartilhado entre o download direto e a variante em Blob. */
async function construirLivroXlsx(registros: EmailRecord[]) {
  const XLSX = await import('xlsx');
  const linhas = [COLUNAS as unknown as string[], ...linhasDosRegistros(registros)];
  const planilha = XLSX.utils.aoa_to_sheet(linhas);
  planilha['!cols'] = [{ wch: 8 }, { wch: 28 }, { wch: 32 }, { wch: 12 }];

  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, planilha, 'E-mails');
  return { XLSX, livro };
}

/** XLSX via SheetJS — mesma biblioteca já usada no script de sincronização (`scripts/sync.ts`), agora também no navegador. */
async function exportarXlsx(registros: EmailRecord[], prefixo: string) {
  const { XLSX, livro } = await construirLivroXlsx(registros);
  XLSX.writeFile(livro, nomeArquivo('xlsx', prefixo));
}

/** Variante de `exportarXlsx` que retorna um `Blob` em vez de baixar direto (Etapa 4 — exportação em lote). */
async function gerarBlobXlsx(registros: EmailRecord[]): Promise<Blob> {
  const { XLSX, livro } = await construirLivroXlsx(registros);
  const arrayBuffer = XLSX.write(livro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Monta o documento PDF (jsPDF) — layout simples (título + tabela em texto
 * corrido, sem bordas), com paginação manual quando os registros não cabem
 * em uma única página A4. Compartilhado entre o download direto e a
 * variante em Blob; quem chama decide como finalizar o documento
 * (`doc.save(...)` ou `doc.output('blob')`).
 */
async function construirDocumentoPdf(registros: EmailRecord[]) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const margem = 40;
  const larguraPagina = doc.internal.pageSize.getWidth();
  const alturaPagina = doc.internal.pageSize.getHeight();
  const colX = { id: margem, nome: margem + 45, email: margem + 200, status: larguraPagina - margem - 70 };
  let y = margem;

  function cabecalhoTabela() {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('ID', colX.id, y);
    doc.text('Nome', colX.nome, y);
    doc.text('E-mail', colX.email, y);
    doc.text('Status', colX.status, y);
    y += 8;
    doc.setLineWidth(0.5);
    doc.line(margem, y, larguraPagina - margem, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Exportação de e-mails', margem, y);
  y += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} — ${registros.length} registro(s)`, margem, y);
  doc.setTextColor(0);
  y += 24;

  cabecalhoTabela();
  doc.setFontSize(9);

  for (const registro of registros) {
    if (y > alturaPagina - margem) {
      doc.addPage();
      y = margem;
      cabecalhoTabela();
      doc.setFontSize(9);
    }
    doc.text(String(registro.id), colX.id, y);
    doc.text(recortar(registro.nome, 26), colX.nome, y);
    doc.text(recortar(registro.email, 30), colX.email, y);
    doc.text(registro.status, colX.status, y);
    y += 16;
  }

  return doc;
}

async function exportarPdf(registros: EmailRecord[], prefixo: string) {
  const doc = await construirDocumentoPdf(registros);
  doc.save(nomeArquivo('pdf', prefixo));
}

/** Variante de `exportarPdf` que retorna um `Blob` em vez de baixar direto (Etapa 4 — exportação em lote). */
async function gerarBlobPdf(registros: EmailRecord[]): Promise<Blob> {
  const doc = await construirDocumentoPdf(registros);
  return doc.output('blob');
}

/**
 * Gera o arquivo do formato escolhido como `Blob`, em vez de baixar
 * direto — usado por `exportarRegistrosEmLote` para empacotar múltiplas
 * planilhas num único `.zip` (Etapa 4 de implementacaoExportacaoHome.md).
 * Dispatcher irmão de `exportarRegistros`, mesmos geradores por baixo.
 */
async function gerarBlob(registros: EmailRecord[], formato: TFormatoExportacao): Promise<Blob> {
  switch (formato) {
    case 'csv':
      return gerarBlobCsv(registros);
    case 'csv-utf8':
      return gerarBlobCsvUtf8(registros);
    case 'xlsx':
      return gerarBlobXlsx(registros);
    case 'pdf':
      return gerarBlobPdf(registros);
  }
}

/**
 * Ponto de entrada único usado pelo `ExportarModal` para uma única
 * planilha: despacha para o gerador do formato escolhido. `slug` é o slug
 * do projeto atual (Etapa 9) — usado como prefixo do nome do arquivo, para
 * não gerar sempre `emails-<data>.<ext>` independente de qual projeto foi
 * exportado. Sem slug (ex.: chamada futura fora do contexto de um
 * projeto), cai para o prefixo genérico `emails`.
 */
export async function exportarRegistros(
  registros: EmailRecord[],
  formato: TFormatoExportacao,
  slug?: string
): Promise<void> {
  const prefixo = slug ?? 'emails';
  switch (formato) {
    case 'csv':
      exportarCsv(registros, prefixo);
      break;
    case 'csv-utf8':
      exportarCsvUtf8(registros, prefixo);
      break;
    case 'xlsx':
      await exportarXlsx(registros, prefixo);
      break;
    case 'pdf':
      await exportarPdf(registros, prefixo);
      break;
  }

  // Etapa 3 (LogsDeAlteracoes.md): confirmação da exportação via `POST
  // /api/logs` — só depois que o download já foi disparado, nunca antes;
  // `registrarLogCliente` nunca lança, então uma falha aqui não afeta o
  // download que o usuário já recebeu.
  await registrarLogCliente('exportar_planilha', {
    projeto: slug ?? null,
    quantidade: registros.length,
  });
}

/**
 * Ponto de entrada da exportação em lote (Etapa 4 de
 * implementacaoExportacaoHome.md), usado pelo `ExportarModal` quando há
 * uma ou mais planilhas selecionadas — o modal já filtra pelo status
 * escolhido e descarta planilhas sem nenhum registro no filtro atual antes
 * de chamar esta função (mesma convenção de `exportarRegistros`: aqui só
 * se cuida da geração/download, nenhuma regra de filtragem).
 *
 * Com 1 planilha, delega direto a `exportarRegistros` — mesmo caminho de
 * sempre, sem zip (comportamento idêntico ao de antes da Etapa 4, inclusive
 * quando chamado a partir da página de uma única planilha). Com 2+, gera
 * um `Blob` por planilha (mesmos geradores de `exportarRegistros`, via
 * `gerarBlob`) e empacota tudo num único `.zip` via `JSZip` — o nome de
 * cada arquivo dentro do zip usa o slug da planilha, mesmo padrão de nome
 * já usado no arquivo avulso (`nomeArquivo`).
 */
export async function exportarRegistrosEmLote(
  planilhas: { slug: string; registros: EmailRecord[] }[],
  formato: TFormatoExportacao
): Promise<void> {
  if (planilhas.length === 0) return;

  if (planilhas.length === 1) {
    await exportarRegistros(planilhas[0].registros, formato, planilhas[0].slug);
    return;
  }

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const extensao = EXTENSAO_POR_FORMATO[formato];

  // Etapa 3: uma linha `exportar_planilha` por planilha do lote, não uma
  // única linha agregada — o template de mensagem da seção 4 do planner
  // ("Planilha exportada do projeto X (N registros)") é por planilha, e
  // cada uma tem seu próprio slug/contagem dentro do mesmo `.zip`.
  for (const planilha of planilhas) {
    const blob = await gerarBlob(planilha.registros, formato);
    zip.file(nomeArquivo(extensao, planilha.slug), blob);
    await registrarLogCliente('exportar_planilha', {
      projeto: planilha.slug,
      quantidade: planilha.registros.length,
    });
  }

  const conteudoZip = await zip.generateAsync({ type: 'blob' });
  baixarBlob(conteudoZip, nomeArquivoZip());
}
