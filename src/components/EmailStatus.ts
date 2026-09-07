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
 * Conjunto de e-mails (normalizados) que aparecem em mais de um registro
 * **ativo** (não `deletado`) — a flag de duplicidade da Demanda 10
 * (`RefatoracaoSistemadeDuplicatas.md`, Etapa 1). Nunca persistida; sempre
 * calculada em runtime, tanto pela interface quanto pelo `sync.ts`.
 *
 * Extraída do agrupamento que antes vivia dentro de
 * `recalcularStatusAutomatico`, para ser reutilizável por qualquer parte do
 * sistema — a partir da Etapa 3, `emails.tsx` calcula este `Set` uma única
 * vez e repassa como propriedade a quem precisar, em vez de cada consumidor
 * chamar esta função por conta própria.
 *
 * Contraparte, do lado Node, de `calcularEmailsDuplicados` em
 * `src/scripts/utils/validateEmail.ts` (mesma lógica, reimplementada lá em
 * vez de importada — `sync.ts` mantém esse desacoplamento deliberado entre
 * `src/scripts/` (Node) e `src/components/` (browser)).
 */
export function calcularEmailsDuplicados(records: EmailRecord[]): Set<string> {
  const contagemPorEmail = new Map<string, number>();

  for (const registro of records) {
    if (registro.status === 'deletado') continue;
    if (!registro.email || !isValidEmail(registro.email)) continue;

    const chave = normalizeEmail(registro.email);
    contagemPorEmail.set(chave, (contagemPorEmail.get(chave) ?? 0) + 1);
  }

  const duplicados = new Set<string>();
  for (const [email, contagem] of contagemPorEmail) {
    if (contagem > 1) duplicados.add(email);
  }
  return duplicados;
}

/**
 * Recalcula o status "automático" (válido / inválido) de todos os registros
 * cuja `backup_dados?.status` seja ausente/`false`, respeitando a trava da
 * seção 5.3 (não há "enviado"/"deletado" automáticos — esses só existem via
 * ação manual). Registros com `backup_dados?.status === true` são
 * preservados sem alteração — enquanto essa chave estiver presente, o
 * status não pode ser recalculado automaticamente.
 *
 * A partir da Demanda 10 (Etapa 1), duplicidade deixou de ser uma
 * possibilidade de status decidida aqui — quem precisar saber se um
 * registro está duplicado chama `calcularEmailsDuplicados` separadamente
 * (o cálculo é totalmente independente da trava de `backup_dados.status`,
 * já que é um fato sobre os dados, não uma decisão de status).
 *
 * Usada:
 * - pelo script de sincronização (Etapa 2), sobre todos os registros;
 * - pela ação "Restaurar" da interface (Etapa 5 de
 *   `EdicaoIndividualdeRegistro.md`), depois de remover
 *   `backup_dados.status` do(s) registro(s) restaurado(s) — o registro
 *   "volta a ser processado normalmente pelo sistema", conforme a
 *   especificação.
 *
 * Não muta `records`; retorna um novo array.
 */
export function recalcularStatusAutomatico(records: EmailRecord[]): EmailRecord[] {
  const now = new Date().toISOString();

  return records.map((record) => {
    if (record.backup_dados?.status) return record;

    const novoStatus: TStatus = isValidEmail(record.email) ? 'válido' : 'inválido';

    if (novoStatus === record.status) return record;

    return { ...record, status: novoStatus, last_updated: now };
  });
}