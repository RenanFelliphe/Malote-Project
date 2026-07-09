/**
 * Leitura de planilha (.csv/.xlsx) direto no navegador, usada apenas para
 * alimentar a prévia e as estatísticas do assistente de importação.
 *
 * Reaproveita a lib "xlsx" (já dependência do projeto para o script de
 * sync) — ela lê tanto .xlsx quanto .csv a partir do mesmo buffer, então
 * não precisamos de um caminho separado por formato aqui.
 *
 * Importante: esta etapa é só de interface (ver descrição da tarefa). Os
 * dados retornados aqui alimentam a prévia visual, mas nenhuma importação
 * de fato ocorre — nada é persistido a partir deste parsing.
 */
import * as XLSX from 'xlsx';

export type LinhaPlanilha = Record<string, string>;

export interface PlanilhaParseada {
  headers: string[];
  linhas: LinhaPlanilha[];
  formato: 'csv' | 'xlsx';
  tamanhoBytes: number;
  nomeArquivo: string;
}

function detectarFormato(nomeArquivo: string): 'csv' | 'xlsx' {
  return nomeArquivo.toLowerCase().endsWith('.csv') ? 'csv' : 'xlsx';
}

export async function parsearPlanilha(arquivo: File): Promise<PlanilhaParseada> {
  const buffer = await arquivo.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const nomeAba = workbook.SheetNames[0];
  if (!nomeAba) {
    throw new Error('A planilha não contém nenhuma aba com dados.');
  }

  const aba = workbook.Sheets[nomeAba];
  const linhasBrutas = XLSX.utils.sheet_to_json<Record<string, unknown>>(aba, { defval: '' });

  // Preserva a ordem original dos cabeçalhos (Object.keys da primeira
  // linha já reflete a ordem das colunas na planilha de origem).
  const headers = linhasBrutas.length > 0 ? Object.keys(linhasBrutas[0]) : [];

  const linhas: LinhaPlanilha[] = linhasBrutas.map((linha) => {
    const normalizada: LinhaPlanilha = {};
    for (const coluna of headers) {
      const valor = linha[coluna];
      normalizada[coluna] = valor === null || valor === undefined ? '' : String(valor).trim();
    }
    return normalizada;
  });

  return {
    headers,
    linhas,
    formato: detectarFormato(arquivo.name),
    tamanhoBytes: arquivo.size,
    nomeArquivo: arquivo.name,
  };
}
