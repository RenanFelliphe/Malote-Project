import type { EmailConteudo, EmailRecord } from '../types/email';

type DadosEditaveis = {
  email: EmailConteudo;
  registros: EmailRecord[];
};

/**
 * Persiste `{ email, registros }` no projeto indicado,
 * via o middleware configurado em vite.config.ts (seção 2.2 —
 * toda alteração deve ser gravada imediatamente, sem botão Salvar). O
 * middleware preserva os metadados do projeto no arquivo existente.
 *
 */
export async function salvarEmails(slug: string, dados: DadosEditaveis): Promise<void> {
  const resposta = await fetch(`/api/emails/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });

  if (!resposta.ok) {
    throw new Error('Falha ao salvar alterações em emails.json');
  }
}