import type { EmailRecord } from '../types/email';

/**
 * Persiste o array completo de registros em data/emails.json,
 * via o middleware configurado em vite.config.ts (seção 2.2 —
 * toda alteração deve ser gravada imediatamente, sem botão Salvar).
 */
export async function salvarEmails(registros: EmailRecord[]): Promise<void> {
  const resposta = await fetch('/api/emails', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registros),
  });

  if (!resposta.ok) {
    throw new Error('Falha ao salvar alterações em emails.json');
  }
}