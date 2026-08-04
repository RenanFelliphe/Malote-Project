/**
 * Validação de e-mail (seção 5.1 da especificação).
 *
 * Regra: apenas uma regex simples de sintaxe. NÃO verifica existência de
 * conta, domínio, DNS ou qualquer validação externa.
 */

// Regex simples: algo@algo.algo — sem espaços, sem validações de domínio real.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/** Normaliza um e-mail para comparação (trim + minúsculas). Usado para detectar duplicados. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
