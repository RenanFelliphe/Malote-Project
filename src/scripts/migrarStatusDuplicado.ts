/**
 * Migração one-time (Etapa 0 de `RefatoracaoSistemadeDuplicatas.md`):
 * `status: 'duplicado'` (legado) -> status real (`válido`/`inválido`).
 *
 * A partir da Etapa 1 desta refatoração, `TStatus` deixou de incluir
 * `'duplicado'` — duplicidade passou a ser uma flag calculada em runtime
 * (`calcularEmailsDuplicados`), nunca persistida. Antes da mudança de tipo
 * chegar a produção, todo registro hoje gravado com `status: 'duplicado'`
 * precisa ser regravado com o status que ele "esconderia" por trás desse
 * valor — não existe, em nenhum lugar do JSON, o registro de "esse era
 * válido antes de virar duplicado" (seção 2.3 do planner), então o único
 * jeito de recuperar esse valor é recalculá-lo via `isValidEmail`, exatamente
 * como a etapa 0 do planner especifica.
 *
 * Este script varre `data/active/<slug>/emails.json` de cada projeto
 * existente e regrava cada registro `'duplicado'` como `'válido'` ou
 * `'inválido'`.
 *
 * Decisão registrada aqui (fora do escopo literal do planner, que só cita
 * `data/active`): `data/trash/<slug>--<timestamp>/emails.json` também é
 * varrido. Motivo: um projeto na lixeira pode ser restaurado a qualquer
 * momento (`LixeiraSidebar.tsx`/`lixeiraApi.ts`), e nada no fluxo de
 * restauração dispara um recálculo de status — sem essa migração, um
 * projeto excluído hoje com registros `'duplicado'` reintroduziria o valor
 * legado no sistema assim que fosse restaurado, silenciosamente, depois do
 * tipo já ter mudado. Sinalizando aqui para revisão: se a intenção for
 * migrar `data/trash` também de outra forma (ex. só no momento da
 * restauração), este trecho pode ser removido/ajustado.
 *
 * Idempotente: um arquivo sem nenhum registro `'duplicado'` é reportado
 * com 0 migrados; rodar o script mais de uma vez é seguro.
 *
 * Uso:
 *   node --loader ts-node/esm src/scripts/migrarStatusDuplicado.ts [--dry-run]
 *
 * `--dry-run` mostra quantos registros seriam migrados em cada arquivo,
 * sem gravar nada em disco.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { isValidEmail } from './utils/validateEmail.js';
import type { EmailRecord, EmailsData, TStatus } from '../types/email.js';

const ACTIVE_DIR = 'data/active';
const TRASH_DIR = 'data/trash';

/** Registro no formato legado — ainda pode ter `status: 'duplicado'`. */
type RegistroLegado = Omit<EmailRecord, 'status'> & { status: TStatus | 'duplicado' };

/**
 * Localiza todo `emails.json` de primeiro nível dentro de um diretório
 * (`data/active/<slug>/emails.json` ou `data/trash/<pasta>/emails.json`).
 * Genérico de propósito — cobre qualquer projeto existente no momento em
 * que o script for rodado, sem hardcodar nomes.
 */
function findEmailsJsonFilesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((pasta) => join(dir, pasta, 'emails.json'))
    .filter((caminho) => existsSync(caminho) && statSync(caminho).isFile());
}

function findEmailsJsonFiles(): string[] {
  return [...findEmailsJsonFilesIn(ACTIVE_DIR), ...findEmailsJsonFilesIn(TRASH_DIR)];
}

/** Migra um único registro. Retorna o registro (já sem `'duplicado'`) e se algo mudou. */
function migrarRegistro(registro: RegistroLegado): { registro: EmailRecord; migrado: boolean } {
  if (registro.status !== 'duplicado') {
    // Já não tem o valor legado — nada a fazer (garante idempotência).
    return { registro: registro as EmailRecord, migrado: false };
  }

  const statusReal: TStatus = isValidEmail(registro.email) ? 'válido' : 'inválido';
  return {
    registro: { ...registro, status: statusReal, last_updated: new Date().toISOString() },
    migrado: true,
  };
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
    console.log(`Nenhum arquivo encontrado em ${ACTIVE_DIR}/*/emails.json ou ${TRASH_DIR}/*/emails.json.`);
    return;
  }

  console.log(
    dryRun
      ? 'Modo --dry-run: nenhum arquivo será alterado.\n'
      : "Migrando status: 'duplicado' -> status real (válido/inválido)...\n"
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
