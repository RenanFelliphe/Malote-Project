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

  // Agrupa por e-mail normalizado, considerando os registros com e-mail
  // sintaticamente válido — independentemente de status_alterado, pois
  // pertencer a um grupo duplicado é um fato sobre os dados, e não depende
  // de o registro em si poder ou não ser recalculado. Registros
  // "deletado" ficam de fora da contagem: um registro deletado não deve
  // continuar "segurando" o(s) irmão(s) restante(s) como duplicado — ao
  // sobrar apenas 1 registro ativo no grupo, ele deixa de ser duplicado.
  //
  // IMPORTANTE: só é considerado "deletado" para fins de contagem o
  // registro que *permanecerá* deletado após este recálculo, isto é,
  // aquele com `status === 'deletado' && status_alterado === true`.
  // "deletado" é um status manual (só existe via ação explícita, sempre
  // acompanhado de status_alterado = true). Quando a ação "Restaurar" zera
  // `status_alterado` de um registro, ela não altera o campo `status`
  // (que continua "deletado" até este recálculo decidir o novo valor); se
  // a contagem do grupo usasse apenas `r.status === 'deletado'`, o próprio
  // registro restaurado seria excluído da contagem de duplicados — mesmo
  // estando prestes a voltar a ficar ativo — subestimando o tamanho real
  // do grupo e permitindo que vários registros com o mesmo e-mail
  // voltassem todos como "válido" simultaneamente.
  const groupSizeByEmail = new Map<string, number>();
  for (const r of records) {
    if (!r.email || !isValidEmail(r.email)) continue;
    if (r.status === 'deletado' && r.status_alterado) continue;
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