/**
 * Regras de validação de e-mail e de recálculo automático de status.
 *
 * Este módulo é puro (sem dependências de Node ou do DOM) de propósito:
 * ele é compartilhado pelo script de sincronização (`src/scripts/sync.ts`,
 * Etapa 2, que roda no terminal) e pela interface React (`emails.tsx`,
 * ação "Restaurar") — ambos precisam aplicar exatamente a mesma
 * regra de prioridade de status (seção 5.2) e de detecção de duplicados
 * (seção 5.4), e mantê-la em um só lugar evita que as duas implementações
 * divirjam com o tempo.
 */
import type { EmailRecord, TStatus } from '../types/email';

// Regex simples: algo@algo.algo — sem espaços, sem validação real de domínio
// (seção 5.1: "não deverá verificar existência da conta, domínio, DNS...").
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/** Normaliza um e-mail para comparação (trim + minúsculas). Usado para detectar duplicados. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Recalcula o status "automático" (válido / inválido / duplicado) de todos
 * os registros cujo `status_alterado` seja `false`, respeitando a prioridade
 * da seção 5.2 (não há "enviado"/"deletado" automáticos — esses só existem
 * via ação manual, portanto aqui a disputa é apenas entre duplicado e
 * válido/inválido). Registros com `status_alterado = true` são preservados
 * sem alteração — enquanto esse atributo for verdadeiro, o status não pode
 * ser recalculado automaticamente (seção 5.3).
 *
 * Usada:
 * - pelo script de sincronização (Etapa 2), sobre todos os registros;
 * - pela ação "Restaurar" da interface (Etapa 5), depois de zerar
 *   `status_alterado` do(s) registro(s) restaurado(s) — o registro "volta a
 *   ser processado normalmente pelo sistema", conforme a especificação.
 *
 * Não muta `records`; retorna um novo array.
 */
export function recalcularStatusAutomatico(records: EmailRecord[]): EmailRecord[] {
  const now = new Date().toISOString();

  // Agrupa por e-mail normalizado, considerando TODOS os registros com
  // e-mail sintaticamente válido — independentemente de status_alterado —
  // pois pertencer a um grupo duplicado é um fato sobre os dados, e não
  // depende de o registro em si poder ou não ser recalculado.
  const groupSizeByEmail = new Map<string, number>();
  for (const r of records) {
    if (!r.email || !isValidEmail(r.email)) continue;
    const key = normalizeEmail(r.email);
    groupSizeByEmail.set(key, (groupSizeByEmail.get(key) ?? 0) + 1);
  }

  return records.map((record) => {
    if (record.status_alterado) return record;

    const emailValid = !!record.email && isValidEmail(record.email);
    const isDuplicate = emailValid && (groupSizeByEmail.get(normalizeEmail(record.email)) ?? 0) > 1;

    let novoStatus: TStatus;
    if (isDuplicate) {
      novoStatus = 'duplicado';
    } else {
      novoStatus = emailValid ? 'válido' : 'inválido';
    }

    if (novoStatus === record.status) return record;

    return { ...record, status: novoStatus, last_updated: now };
  });
}