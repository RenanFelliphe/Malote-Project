/**
 * identifyColumns() — seção 3.1 da especificação.
 *
 * O desenvolvedor define manualmente, abaixo, quais nomes de coluna podem
 * representar ID, Nome e E-mail. A função procura essas colunas na ordem
 * definida e usa a primeira coluna preenchida para cada registro.
 *
 * Para e-mail, mais de uma coluna pode ser informada (ex.: planilhas de
 * formulários diferentes usam perguntas diferentes para o mesmo dado).
 */

/** Nomes de coluna aceitos para o ID (opcional — ver observação abaixo). */
export const ID_COLUMNS = ['ID', 'Id', 'id', '#', 'Aluno – ID', 'Aluno - ID'];

/** Nomes de coluna aceitos para o nome do destinatário. */
export const NOME_COLUMNS = [
  'Nome2',
  'Nome',
  'nome',
  'Nome completo',
  'Nome Completo',
  'Aluno – Nome',
  'Aluno - Nome',
  'Relatórios para – Nome',
  'Relatórios para - Nome',
];

/** Nomes de coluna aceitos para o e-mail (pode haver mais de uma pergunta/coluna). */
export const EMAIL_COLUMNS = [
  'E-mail cadastrado na plataforma',
  'E-mail',
  'Email',
  'e-mail',
  'email',
  'Digite seu melhor e-mail',
  'Informe seu e-mail',
  'Aluno – E-mail',
  'Aluno - E-mail',
  'Relatórios para – E-mail',
  'Relatórios para - E-mail',
];

export interface ColumnMap {
  idColumn: string | null;
  nomeColumn: string | null;
  emailColumn: string | null;
}

function findColumn(headers: string[], candidates: string[]): string | null {
  const normalizedHeaders = headers.map((h) => ({ original: h, norm: h.trim().toLowerCase() }));
  for (const candidate of candidates) {
    const norm = candidate.trim().toLowerCase();
    const match = normalizedHeaders.find((h) => h.norm === norm);
    if (match) return match.original;
  }
  return null;
}

/**
 * Identifica, dentre os cabeçalhos da planilha, quais colunas representam
 * ID, Nome e E-mail.
 *
 * - ID é opcional: se nenhuma coluna de ID for encontrada, o sistema usa a
 *   ordem original da linha na planilha como `id` (ver seção 2.3).
 * - Nome e E-mail são obrigatórios: se a coluna de e-mail não for
 *   encontrada, a função lança erro (não há como importar sem e-mail).
 */
export function identifyColumns(headers: string[]): ColumnMap {
  const idColumn = findColumn(headers, ID_COLUMNS);
  const nomeColumn = findColumn(headers, NOME_COLUMNS);
  const emailColumn = findColumn(headers, EMAIL_COLUMNS);

  if (!emailColumn) {
    throw new Error(
      `Nenhuma coluna de e-mail encontrada. Colunas disponíveis: [${headers.join(', ')}]. ` +
        `Colunas de e-mail esperadas: [${EMAIL_COLUMNS.join(', ')}].`
    );
  }

  return { idColumn, nomeColumn, emailColumn };
}

/**
 * Para uma linha da planilha, retorna o valor da primeira coluna preenchida
 * dentre os candidatos de e-mail — cobre o caso de a planilha ter mais de
 * uma coluna de e-mail (ex.: perguntas diferentes de formulário).
 */
export function pickFirstFilled(row: Record<string, string>, candidates: string[]): string {
  for (const col of candidates) {
    const key = Object.keys(row).find((k) => k.trim().toLowerCase() === col.trim().toLowerCase());
    if (key && row[key] && row[key].trim() !== '') {
      return row[key].trim();
    }
  }
  return '';
}
