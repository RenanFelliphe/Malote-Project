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

/**
 * Calcula o conjunto de e-mails (normalizados) que aparecem em mais de um
 * registro **ativo** (não `deletado`) — a flag de duplicidade da Demanda 10
 * (`public/RefatoracaoSistemadeDuplicatas.md`, Etapa 2). Nunca persistida.
 *
 * Contraparte, do lado Node, de `calcularEmailsDuplicados` em
 * `src/components/EmailStatus.ts` (mesma lógica, reimplementada aqui em vez
 * de importada): `sync.ts` já mantém esse desacoplamento deliberado entre
 * `src/scripts/` (Node) e `src/components/` (browser) para os dois módulos
 * irmãos `isValidEmail`/`normalizeEmail` acima, e a mesma razão se aplica
 * aqui — os dois lados precisam da regra de agrupamento idêntica, mas sem
 * uma dependência cruzada entre os dois ambientes.
 */
export function calcularEmailsDuplicados(records: { email: string; status: string }[]): Set<string> {
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
