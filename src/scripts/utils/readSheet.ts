/**
 * Leitura da planilha de origem (.csv ou .xlsx) — seção 3 da especificação.
 *
 * Retorna sempre a mesma estrutura, independentemente do formato de
 * origem: um array de linhas (objetos chave/valor por cabeçalho) na
 * ordem original da planilha.
 */

import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { parse } from 'csv-parse/sync';
// O pacote "xlsx" é distribuído como CommonJS (module.exports = XLSX),
// então o import correto em contexto ESM é o default, não um import de
// namespace (`import * as XLSX`), que não expõe os métodos corretamente.
import XLSX from 'xlsx';

export type SheetRow = Record<string, string>;

export function readSheet(filePath: string): SheetRow[] {
  const ext = extname(filePath).toLowerCase();

  if (ext === '.csv') {
    return readCsv(filePath);
  }

  if (ext === '.xlsx' || ext === '.xls') {
    return readXlsx(filePath);
  }

  throw new Error(`Formato de planilha não suportado: "${ext}". Use .csv ou .xlsx.`);
}

function readCsv(filePath: string): SheetRow[] {
  const content = decodificarCsv(readFileSync(filePath));
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    delimiter: detectDelimiter(content),
  });
  return records as SheetRow[];
}

function decodificarCsv(buffer: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

function detectDelimiter(content: string): string {
  const firstLine = content.split(/\r?\n/).find((line) => line.trim() !== '') ?? '';
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  const tabCount = (firstLine.match(/\t/g) ?? []).length;

  if (semicolonCount > commaCount && semicolonCount >= tabCount) {
    return ';';
  }

  if (tabCount > commaCount && tabCount >= semicolonCount) {
    return '\t';
  }

  return ',';
}

function readXlsx(filePath: string): SheetRow[] {
  const workbook = XLSX.readFile(filePath);
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('A planilha .xlsx não contém nenhuma aba.');
  }
  const sheet = workbook.Sheets[firstSheetName];
  // defval garante que células vazias virem string vazia em vez de sumir da linha,
  // o que manteria a mesma "forma" de objeto que a leitura de CSV produz.
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return rows.map((row) => {
    const normalized: SheetRow = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key] = value === null || value === undefined ? '' : String(value).trim();
    }
    return normalized;
  });
}
