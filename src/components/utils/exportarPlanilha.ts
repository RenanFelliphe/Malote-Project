/**
 * Geração e download dos arquivos de exportação da planilha (CSV, CSV
 * UTF-8, XLSX e PDF), usados pelo `ExportarModal` — acessível a partir do
 * menu de configurações do cabeçalho (`Header`, item "Exportar planilha").
 *
 * Todos os formatos exportam o mesmo conjunto de colunas (ID, Nome,
 * E-mail, Status), já a partir dos registros previamente filtrados pelo
 * modal (seleção de status) — este módulo só cuida de serializar cada
 * formato e disparar o download, sem regra de negócio de filtragem.
 *
 * XLSX e PDF são carregados via import dinâmico (code-splitting do Vite):
 * a maioria das exportações tende a usar CSV, então não faz sentido
 * incluir as bibliotecas dessas duas bibliotecas maiores no bundle inicial
 * da aplicação.
 */
import type { EmailRecord } from '../../types/email';

export type TFormatoExportacao = 'csv' | 'csv-utf8' | 'xlsx' | 'pdf';

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

/** Nome de arquivo com a data de geração, ex.: `emails-2026-07-08.csv`. */
function nomeArquivo(extensao: string): string {
  const dataDeHoje = new Date().toISOString().slice(0, 10);
  return `emails-${dataDeHoje}.${extensao}`;
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
function exportarCsv(registros: EmailRecord[]) {
  const conteudo = gerarConteudoCsv(registros);
  baixarBlob(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }), nomeArquivo('csv'));
}

/** CSV com BOM UTF-8, para o Excel reconhecer a codificação e exibir corretamente nomes acentuados. */
function exportarCsvUtf8(registros: EmailRecord[]) {
  const conteudo = `\uFEFF${gerarConteudoCsv(registros)}`;
  baixarBlob(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }), nomeArquivo('csv'));
}

/** XLSX via SheetJS — mesma biblioteca já usada no script de sincronização (`scripts/sync.ts`), agora também no navegador. */
async function exportarXlsx(registros: EmailRecord[]) {
  const XLSX = await import('xlsx');
  const linhas = [COLUNAS as unknown as string[], ...linhasDosRegistros(registros)];
  const planilha = XLSX.utils.aoa_to_sheet(linhas);
  planilha['!cols'] = [{ wch: 8 }, { wch: 28 }, { wch: 32 }, { wch: 12 }];

  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, planilha, 'E-mails');
  XLSX.writeFile(livro, nomeArquivo('xlsx'));
}

/**
 * PDF via jsPDF. Layout simples (título + tabela em texto corrido, sem
 * bordas), com paginação manual quando os registros não cabem em uma
 * única página A4.
 */
async function exportarPdf(registros: EmailRecord[]) {
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

  doc.save(nomeArquivo('pdf'));
}

/** Ponto de entrada único usado pelo `ExportarModal`: despacha para o gerador do formato escolhido. */
export async function exportarRegistros(registros: EmailRecord[], formato: TFormatoExportacao): Promise<void> {
  switch (formato) {
    case 'csv':
      exportarCsv(registros);
      return;
    case 'csv-utf8':
      exportarCsvUtf8(registros);
      return;
    case 'xlsx':
      await exportarXlsx(registros);
      return;
    case 'pdf':
      await exportarPdf(registros);
      return;
  }
}
