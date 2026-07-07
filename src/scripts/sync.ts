/**
 * Script de sincronização — Etapa 2 da especificação.
 *
 * Uso (terminal, fora do bundle do Vite):
 *   node --loader ts-node/esm src/scripts/sync.ts data/planilha.csv
 *   node --loader ts-node/esm src/scripts/sync.ts data/planilha.xlsx --out=data/emails.json
 *
 * Fluxo (seção 2.3):
 *   Rodar script → Identificar colunas → Sincronizar com JSON (por id) →
 *   Atualizar registros → Validar e-mails (regex) → Identificar duplicados →
 *   Aplicar prioridades → Gravar JSON atualizado
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { readSheet } from './utils/readSheet.js';
import { identifyColumns, pickFirstFilled, EMAIL_COLUMNS } from './utils/identifyColumns.js';
import { isValidEmail, normalizeEmail } from './utils/validateEmail.js';
import type { EmailRecord, TStatus } from '../types/email.js';

// ---------------------------------------------------------------------------
// 1. Argumentos da linha de comando
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]) {
  const [sheetPathArg, ...rest] = argv;
  if (!sheetPathArg) {
    console.error(
      'Uso: node --loader ts-node/esm src/scripts/sync.ts <caminho/da/planilha.csv|.xlsx> [--out=data/emails.json]'
    );
    process.exit(1);
  }

  const outArg = rest.find((a) => a.startsWith('--out='));
  const outPath = outArg ? outArg.replace('--out=', '') : defaultJsonPathFor(sheetPathArg);

  return { sheetPath: resolve(sheetPathArg), outPath: resolve(outPath) };
}

/**
 * Sem --out explícito, grava sempre em data/emails.json — nesta fase local
 * existe um único JSON oficial (a visão de múltiplas planilhas/slugs fica
 * para a fase futura, seção 9 da especificação).
 */
function defaultJsonPathFor(_sheetPath: string): string {
  return 'data/emails.json';
}

// ---------------------------------------------------------------------------
// 2. Carregar JSON existente (fonte oficial dos dados — seção 2.1)
// ---------------------------------------------------------------------------

function loadExistingJson(jsonPath: string): EmailRecord[] {
  if (!existsSync(jsonPath)) {
    return [];
  }
  const raw = readFileSync(jsonPath, 'utf-8').trim();
  if (raw === '') return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`O arquivo JSON em "${jsonPath}" não contém um array de registros.`);
  }
  return parsed as EmailRecord[];
}

// ---------------------------------------------------------------------------
// 3. Sincronização por id (seção 2.3 — "Identificação de registros")
// ---------------------------------------------------------------------------

function syncRecords(sheetRows: ReturnType<typeof readSheet>, existing: EmailRecord[]) {
  const headers = sheetRows.length > 0 ? Object.keys(sheetRows[0]) : [];
  const { idColumn, nomeColumn } = identifyColumns(headers);

  const byId = new Map<number, EmailRecord>(existing.map((r) => [r.id, r]));
  const now = new Date().toISOString();

  let added = 0;
  let updated = 0;

  sheetRows.forEach((row, index) => {
    // id: usa a coluna de ID se existir e for numérica; caso contrário,
    // usa a ordem original da linha na planilha (1-based) — seção 2.3.
    let id: number;
    if (idColumn && row[idColumn] && !Number.isNaN(Number(row[idColumn]))) {
      id = Number(row[idColumn]);
    } else {
      id = index + 1;
    }

    const nome = nomeColumn ? pickFirstFilled(row, [nomeColumn]) : '';
    const email = pickFirstFilled(row, EMAIL_COLUMNS);

    const existingRecord = byId.get(id);

    if (existingRecord) {
      // Registro existente: atualiza apenas nome/e-mail vindos da planilha.
      // Preserva status, status_alterado e demais campos manuais.
      const changed = existingRecord.nome !== nome || existingRecord.email !== email;
      existingRecord.nome = nome;
      existingRecord.email = email;
      if (changed) {
        existingRecord.last_updated = now;
        updated++;
      }
    } else {
      // Novo registro.
      const novo: EmailRecord = {
        id,
        nome,
        email,
        status: 'válido', // provisório; recalculado logo abaixo
        status_alterado: false,
        last_updated: now,
      };
      byId.set(id, novo);
      added++;
    }
  });

  return { records: Array.from(byId.values()), added, updated };
}

// ---------------------------------------------------------------------------
// 4/5/6. Validar e-mails, identificar duplicados e aplicar prioridades
//         (seção 5.2 — "enviado > deletado > duplicado > válido/inválido")
// ---------------------------------------------------------------------------

function applyStatusRules(records: EmailRecord[]): EmailRecord[] {
  const now = new Date().toISOString();

  // Agrupa por e-mail normalizado (todos os registros com e-mail
  // sintaticamente válido) para detectar duplicados — seção 5.4:
  // "mesmo endereço de e-mail, independentemente do nome".
  const groupSizeByEmail = new Map<string, number>();
  for (const r of records) {
    if (!r.email || !isValidEmail(r.email)) continue;
    const key = normalizeEmail(r.email);
    groupSizeByEmail.set(key, (groupSizeByEmail.get(key) ?? 0) + 1);
  }

  for (const record of records) {
    // status_alterado = true → status definido manualmente, nunca
    // recalculado automaticamente durante a sincronização (seção 2.3 / 5.3).
    if (record.status_alterado) continue;

    const emailValid = !!record.email && isValidEmail(record.email);
    const isDuplicate = emailValid && (groupSizeByEmail.get(normalizeEmail(record.email)) ?? 0) > 1;

    // Prioridade automática (não há "enviado"/"deletado" automáticos —
    // esses só existem via ação manual, portanto aqui a disputa é apenas
    // entre duplicado e válido/inválido, respeitando a ordem de prioridade).
    let novoStatus: TStatus;
    if (isDuplicate) {
      novoStatus = 'duplicado';
    } else {
      novoStatus = emailValid ? 'válido' : 'inválido';
    }

    if (novoStatus !== record.status) {
      record.status = novoStatus;
      record.last_updated = now;
    }
  }

  // Ordena por id para manter o JSON legível e estável entre sincronizações.
  return records.slice().sort((a, b) => a.id - b.id);
}

// ---------------------------------------------------------------------------
// 7. Gravar JSON atualizado
// ---------------------------------------------------------------------------

function writeJson(jsonPath: string, records: EmailRecord[]) {
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(records, null, 2) + '\n', 'utf-8');
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main() {
  const { sheetPath, outPath } = parseArgs(process.argv.slice(2));

  if (!existsSync(sheetPath)) {
    console.error(`Planilha não encontrada: ${sheetPath}`);
    process.exit(1);
  }

  console.log(`Lendo planilha: ${sheetPath}`);
  const sheetRows = readSheet(sheetPath);
  console.log(`  ${sheetRows.length} linha(s) encontrada(s).`);

  console.log(`Carregando JSON existente: ${outPath}`);
  const existing = loadExistingJson(outPath);
  console.log(`  ${existing.length} registro(s) já existente(s).`);

  const { records, added, updated } = syncRecords(sheetRows, existing);
  const finalRecords = applyStatusRules(records);

  writeJson(outPath, finalRecords);

  const counters = {
    total: finalRecords.length,
    válido: finalRecords.filter((r) => r.status === 'válido').length,
    inválido: finalRecords.filter((r) => r.status === 'inválido').length,
    duplicado: finalRecords.filter((r) => r.status === 'duplicado').length,
    deletado: finalRecords.filter((r) => r.status === 'deletado').length,
    enviado: finalRecords.filter((r) => r.status === 'enviado').length,
  };

  console.log('\nSincronização concluída.');
  console.log(`  Novos registros:      ${added}`);
  console.log(`  Registros atualizados: ${updated}`);
  console.log('  Contadores:', counters);
  console.log(`  JSON gravado em: ${outPath}`);
}

main();
