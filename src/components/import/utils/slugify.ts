/**
 * Geração do "Nome do arquivo" (slug usado futuramente na URL do projeto).
 *
 * Duas variantes:
 * - `slugify`: normalização completa (usada, por ex., ao sincronizar
 *   automaticamente a partir do Nome do projeto — pode aparar hífens nas
 *   pontas livremente, já que o texto de origem não está sendo digitado
 *   diretamente neste campo).
 * - `slugifyDigitando`: versão usada no próprio campo "Nome do arquivo"
 *   enquanto o usuário digita nele. Não remove um hífen ao final do texto,
 *   para não atrapalhar quem acabou de digitar um espaço (convertido em
 *   hífen) e está prestes a continuar a próxima palavra.
 */

function normalizarBase(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // remove caracteres inválidos para URL
    .replace(/[\s_]+/g, '-') // espaços/underscore -> hífen
    .replace(/-{2,}/g, '-'); // colapsa hífens repetidos
}

/** Slug final, sem hífens nas pontas. Uso: sincronização automática e URL de preview. */
export function slugify(texto: string): string {
  return normalizarBase(texto).replace(/^-+|-+$/g, '');
}

/** Slug "ao vivo": preserva hífen final para não atrapalhar a digitação. */
export function slugifyDigitando(texto: string): string {
  return normalizarBase(texto).replace(/^-+/, '');
}
