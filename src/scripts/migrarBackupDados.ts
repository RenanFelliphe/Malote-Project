/**
 * Migração one-time (Etapa 2 de `EdicaoIndividualdeRegistro.md`):
 * `status_alterado` (booleano, legado) -> `backup_dados.status`.
 *
 * Depois da mudança de modelo da Etapa 1, `EmailRecord` não tem mais o
 * campo `status_alterado` — só `backup_dados?: { nome?, email?, status? }`.
 * Este script varre `data/active/<slug>/emails.json`, convertendo cada
 * registro legado:
 *   - `status_alterado: true`  -> ganha `backup_dados.status = true`
 *     (mesmo papel de proteção contra sobrescrita que tinha antes).
 *   - `status_alterado: false` -> apenas perde o campo (nenhuma proteção
 *     equivalia a "false"; `backup_dados` continua ausente).
 * Nunca escreve `backup_dados.nome`/`.email` — o modelo antigo só
 * protegia `status`; a captura de nome/email só passa a existir a partir
 * da Etapa 3, quando a edição inline for implementada.
 *
 * Idempotente: um registro que já não tem `status_alterado` é ignorado
 * (não conta como migrado), então rodar o script mais de uma vez é seguro.
 *
 * Uso:
 *   node --loader ts-node/esm src/scripts/migrarBackupDados.ts [--dry-run]
 *
 * `--dry-run` mostra quantos registros seriam migrados em cada arquivo,
 * sem gravar nada em disco.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { EmailRecord, EmailsData } from '../types/email.js';

const ACTIVE_DIR = 'data/active';

/** Registro no formato legado — ainda pode ter `status_alterado`. */
type RegistroLegado = Omit<EmailRecord, 'backup_dados'> & { status_alterado?: boolean };

/**
 * Localiza todo `data/active/<slug>/emails.json` existente. Genérico de
 * propósito (em vez de hardcodar os dois projetos citados no planner):
 * cobre qualquer projeto ativo no momento em que o script for rodado.
 */
function findEmailsJsonFiles(): string[] {
  if (!existsSync(ACTIVE_DIR)) return [];
  return readdirSync(ACTIVE_DIR)
    .map((slug) => join(ACTIVE_DIR, slug, 'emails.json'))
    .filter((caminho) => existsSync(caminho) && statSync(caminho).isFile());
}

/** Migra um único registro. Retorna o registro (já sem `status_alterado`) e se algo mudou. */
function migrarRegistro(registro: RegistroLegado): { registro: EmailRecord; migrado: boolean } {
  const { status_alterado, ...resto } = registro;

  if (status_alterado === undefined) {
    // Já não tem o campo legado — nada a fazer (garante idempotência).
    return { registro: resto as EmailRecord, migrado: false };
  }

  const migrado = resto as EmailRecord;
  if (status_alterado === true) {
    migrado.backup_dados = { ...(migrado.backup_dados ?? {}), status: true };
  }
  return { registro: migrado, migrado: true };
}

/**
 * Migra um arquivo `emails.json`, aceitando tanto o formato atual
 * (`EmailsData`, `{ registros: [...], ... }`) quanto o formato antigo
 * (array puro de registros) — mesma tolerância que `sync.ts` já aplica.
 */
function migrarArquivo(caminho: string, dryRun: boolean): { total: number; migrados: number } {
  const bruto = readFileSync(caminho, 'utf-8');
  const parsed: unknown = JSON.parse(bruto);
  const isWrapped =
    parsed !== null && typeof parsed === 'object' && Array.isArray((parsed as EmailsData).registros);

  const registros: RegistroLegado[] = isWrapped ? (parsed as EmailsData).registros : (parsed as RegistroLegado[]);

  let migrados = 0;
  const novosRegistros = registros.map((registro) => {
    const resultado = migrarRegistro(registro);
    if (resultado.migrado) migrados++;
    return resultado.registro;
  });

  if (migrados > 0 && !dryRun) {
    const novoConteudo = isWrapped ? { ...(parsed as EmailsData), registros: novosRegistros } : novosRegistros;
    writeFileSync(caminho, JSON.stringify(novoConteudo, null, 2) + '\n', 'utf-8');
  }

  return { total: registros.length, migrados };
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const arquivos = findEmailsJsonFiles();

  if (arquivos.length === 0) {
    console.log(`Nenhum arquivo encontrado em ${ACTIVE_DIR}/*/emails.json.`);
    return;
  }

  console.log(
    dryRun
      ? 'Modo --dry-run: nenhum arquivo será alterado.\n'
      : 'Migrando status_alterado -> backup_dados.status...\n'
  );

  let totalMigrados = 0;
  for (const arquivo of arquivos) {
    const { total, migrados } = migrarArquivo(arquivo, dryRun);
    totalMigrados += migrados;
    console.log(`  ${arquivo}: ${migrados}/${total} registro(s) migrado(s)`);
  }

  console.log(`\n${totalMigrados} registro(s) migrado(s) no total.`);
}

main();
