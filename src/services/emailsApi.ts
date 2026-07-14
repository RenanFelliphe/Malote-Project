import type { EmailsData } from '../types/email';

/**
 * Persiste o objeto completo `{ email, registros }` em data/emails.json,
 * via o middleware configurado em vite.config.ts (seção 2.2 —
 * toda alteração deve ser gravada imediatamente, sem botão Salvar).
 *
 * A partir da migração descrita em REFATORACAO-EMAIL-TITULO-CONTEUDO.md,
 * o arquivo passou a armazenar `email` (título/corpo) e `registros` juntos;
 * por isso toda gravação precisa enviar o objeto `EmailsData` completo —
 * nunca apenas o array de registros — para não perder o conteúdo do
 * e-mail já salvo.
 */
export async function salvarEmails(dados: EmailsData): Promise<void> {
  const resposta = await fetch('/api/emails', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });

  if (!resposta.ok) {
    throw new Error('Falha ao salvar alterações em emails.json');
  }
}