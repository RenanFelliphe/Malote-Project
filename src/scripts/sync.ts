/**
 * Script de sincronização — Etapa 2 da especificação.
 *
 * Uso (terminal, fora do bundle do Vite):
 *   node --loader ts-node/esm src/scripts/sync.ts data/planilha.csv
 *   node --loader ts-node/esm src/scripts/sync.ts data/planilha.xlsx --slug=projeto-teste
 *   node --loader ts-node/esm src/scripts/sync.ts data/planilha.xlsx --slug=projeto-teste --aceitar-conflitos
 *
 * A partir da migração descrita em implementacaoImportacao.md (Etapa 2), o
 * destino não é mais um caminho de arquivo fixo: é sempre
 * `data/active/<slug>/emails.json`. O slug vem de `--slug=` quando
 * informado; na ausência do argumento, é derivado do nome do arquivo da
 * planilha. Se o projeto (pasta `data/active/<slug>/`) ainda não existir,
 * é criado nesta execução.
 *
 * Fluxo (seção 2.3):
 *   Rodar script → Identificar colunas → Sincronizar com JSON (por id) →
 *   Atualizar registros → Validar e-mails (regex) → Identificar duplicados →
 *   Aplicar prioridades → Gravar JSON atualizado
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';

import { readSheet } from './utils/readSheet.js';
import { identifyColumns, pickFirstFilled, EMAIL_COLUMNS } from './utils/identifyColumns.js';
import { isValidEmail, normalizeEmail } from './utils/validateEmail.js';
import type { EmailConteudo, EmailRecord, EmailsData, TStatus } from '../types/email.js';
import { EMAIL_CONTEUDO_VAZIO } from '../types/email.js';

// ---------------------------------------------------------------------------
// 1. Argumentos da linha de comando
// ---------------------------------------------------------------------------

/**
 * Versão local mínima de slugify — mesma normalização usada do lado browser
 * em `src/components/import/utils/slugify.ts`, reimplementada aqui em vez de
 * importada para não criar uma dependência de `src/scripts/` (Node) sobre
 * `src/components/` (browser), mantendo os dois lados desacoplados.
 */
function slugifyNomeArquivo(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // remove caracteres inválidos para URL
    .replace(/[\s_]+/g, '-') // espaços/underscore -> hífen
    .replace(/-{2,}/g, '-') // colapsa hífens repetidos
    .replace(/^-+|-+$/g, ''); // apara hífens nas pontas
}

/**
 * Slug derivado do nome do arquivo da planilha, usado quando `--slug=` não
 * é informado (ex.: `data/planilha-turma-2024.csv` → `planilha-turma-2024`).
 */
function slugFromSheetPath(sheetPath: string): string {
  const nomeBase = basename(sheetPath, extname(sheetPath));
  return slugifyNomeArquivo(nomeBase);
}

function parseArgs(argv: string[]) {
  const [sheetPathArg, ...rest] = argv;
  if (!sheetPathArg) {
    console.error(
      'Uso: node --loader ts-node/esm src/scripts/sync.ts <caminho/da/planilha.csv|.xlsx> [--slug=nome-do-projeto]'
    );
    process.exit(1);
  }

  const slugArg = rest.find((a) => a.startsWith('--slug='));
  const aceitarConflitos = rest.includes('--aceitar-conflitos');
  const slug = slugArg ? slugifyNomeArquivo(slugArg.replace('--slug=', '')) : slugFromSheetPath(sheetPathArg);

  if (!slug) {
    console.error(
      `Não foi possível determinar um slug de projeto válido a partir de "${sheetPathArg}". Informe --slug=nome-do-projeto explicitamente.`
    );
    process.exit(1);
  }

  const outPath = resolve('data/active', slug, 'emails.json');

  return { sheetPath: resolve(sheetPathArg), outPath, slug, aceitarConflitos };
}

// ---------------------------------------------------------------------------
// 2. Carregar JSON existente (fonte oficial dos dados — seção 2.1)
// ---------------------------------------------------------------------------

/**
 * A partir da migração descrita em REFATORACAO-EMAIL-TITULO-CONTEUDO.md,
 * `data/emails.json` passou a ser `{ email, registros }` (EmailsData), não
 * mais um array puro de registros. Este script nunca deve sobrescrever
 * título/corpo do e-mail — ele só sincroniza `registros` — por isso carrega
 * e devolve o `email` existente junto, para ser regravado intacto ao final.
 *
 * Aceita também o formato antigo (array puro) por compatibilidade com
 * arquivos ainda não migrados: nesse caso, `email` volta vazio
 * (`EMAIL_CONTEUDO_VAZIO`), já que não havia esse campo para preservar.
 */
function loadExistingJson(jsonPath: string): Pick<EmailsData, 'email' | 'registros' | 'projeto' | 'criado_em' | 'atualizado_em'> {
  if (!existsSync(jsonPath)) {
    return { email: EMAIL_CONTEUDO_VAZIO, registros: [], projeto: '', criado_em: '', atualizado_em: '' };
  }
  const raw = readFileSync(jsonPath, 'utf-8').trim();
  if (raw === '') return { email: EMAIL_CONTEUDO_VAZIO, registros: [], projeto: '', criado_em: '', atualizado_em: '' };

  const parsed = JSON.parse(raw);

  if (Array.isArray(parsed)) {
    // Formato antigo (array puro) — sem `email` para preservar.
    return { email: EMAIL_CONTEUDO_VAZIO, registros: parsed as EmailRecord[], projeto: '', criado_em: '', atualizado_em: '' };
  }

  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as EmailsData).registros)) {
    const dados = parsed as EmailsData;
    return {
      email: dados.email ?? EMAIL_CONTEUDO_VAZIO,
      registros: dados.registros,
      projeto: dados.projeto ?? '',
      criado_em: dados.criado_em ?? '',
      atualizado_em: dados.atualizado_em ?? '',
    };
  }

  throw new Error(
    `O arquivo JSON em "${jsonPath}" não está em um formato reconhecido (esperado array de registros ou objeto { email, registros }).`
  );
}

// ---------------------------------------------------------------------------
// 3. Sincronização por id (seção 2.3 — "Identificação de registros")
// ---------------------------------------------------------------------------

export interface ConflitoSincronizacao {
  id: number;
  campos: Array<'nome' | 'email'>;
}

function syncRecords(
  sheetRows: ReturnType<typeof readSheet>,
  existing: EmailRecord[],
  options: { aceitarConflitos?: boolean } = {}
) {
  const headers = sheetRows.length > 0 ? Object.keys(sheetRows[0]) : [];
  const { idColumn, nomeColumn } = identifyColumns(headers);

  const byId = new Map<number, EmailRecord>(existing.map((r) => [r.id, r]));
  const now = new Date().toISOString();

  let added = 0;
  let updated = 0;
  const conflitos: ConflitoSincronizacao[] = [];

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
      // Uma captura em backup_dados marca o valor original da planilha. Se a
      // nova planilha divergir dele, a alteração manual entra em conflito e
      // o valor protegido é preservado até uma decisão explícita.
      const camposConflitantes: Array<'nome' | 'email'> = [];
      for (const campo of ['nome', 'email'] as const) {
        const valorPlanilha = campo === 'nome' ? nome : email;
        const valorOriginal = existingRecord.backup_dados?.[campo];
        if (valorOriginal !== undefined && valorPlanilha !== valorOriginal) {
          camposConflitantes.push(campo);
        }
      }

      if (camposConflitantes.length > 0) {
        conflitos.push({ id, campos: camposConflitantes });
      }

      const aceitar = options.aceitarConflitos === true;
      const nomeProtegido = camposConflitantes.includes('nome') && !aceitar;
      const emailProtegido = camposConflitantes.includes('email') && !aceitar;
      const changed =
        (!nomeProtegido && existingRecord.nome !== nome) ||
        (!emailProtegido && existingRecord.email !== email);
      if (!nomeProtegido) existingRecord.nome = nome;
      if (!emailProtegido) existingRecord.email = email;
      if (aceitar && camposConflitantes.length > 0 && existingRecord.backup_dados) {
        const backupRestante = { ...existingRecord.backup_dados };
        for (const campo of camposConflitantes) delete backupRestante[campo];
        existingRecord.backup_dados = Object.keys(backupRestante).length > 0 ? backupRestante : undefined;
      }
      if (changed) {
        existingRecord.last_updated = now;
        updated++;
      }
    } else {
      // Novo registro. Nasce sem `backup_dados` — nenhum campo foi
      // alterado manualmente ainda.
      const novo: EmailRecord = {
        id,
        nome,
        email,
        status: 'válido', // provisório; recalculado logo abaixo
        last_updated: now,
      };
      byId.set(id, novo);
      added++;
    }
  });

  return { records: Array.from(byId.values()), added, updated, conflitos };
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
    // backup_dados?.status === true → status definido manualmente, nunca
    // recalculado automaticamente durante a sincronização (seção 2.3 / 5.3).
    if (record.backup_dados?.status) continue;

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

/**
 * Grava o objeto completo `{ email, registros }`. `email` é sempre o mesmo
 * valor carregado por `loadExistingJson` — este script nunca gera nem altera
 * título/corpo, apenas repassa o que já existia no arquivo.
 */
function writeJson(
  jsonPath: string,
  email: EmailConteudo,
  records: EmailRecord[],
  metadados: Pick<EmailsData, 'projeto' | 'criado_em'>
) {
  const agora = new Date().toISOString();
  const dados: EmailsData = {
    projeto: metadados.projeto,
    atualizado_em: agora,
    criado_em: metadados.criado_em || agora,
    email,
    registros: records,
  };
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(dados, null, 2) + '\n', 'utf-8');
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main() {
  const { sheetPath, outPath, slug, aceitarConflitos } = parseArgs(process.argv.slice(2));

  if (!existsSync(sheetPath)) {
    console.error(`Planilha não encontrada: ${sheetPath}`);
    process.exit(1);
  }

  const projetoNovo = !existsSync(outPath);

  console.log(`Lendo planilha: ${sheetPath}`);
  const sheetRows = readSheet(sheetPath);
  console.log(`  ${sheetRows.length} linha(s) encontrada(s).`);

  console.log(`Projeto: ${slug}${projetoNovo ? ' (novo — será criado)' : ''}`);
  console.log(`Carregando JSON existente: ${outPath}`);
  const dadosExistentes = loadExistingJson(outPath);
  const { email: emailExistente, registros: existing } = dadosExistentes;
  console.log(`  ${existing.length} registro(s) já existente(s).`);

  const { records, added, updated, conflitos } = syncRecords(sheetRows, existing, { aceitarConflitos });
  const finalRecords = applyStatusRules(records);

  writeJson(outPath, emailExistente, finalRecords, dadosExistentes);

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
  console.log(`  Conflitos detectados:  ${conflitos.length}`);
  if (conflitos.length > 0 && !aceitarConflitos) {
    console.log('  Valores manuais preservados. Use --aceitar-conflitos para aceitar os valores da planilha.');
  }
  console.log('  Contadores:', counters);
  console.log(`  JSON gravado em: ${outPath}`);
}

main();