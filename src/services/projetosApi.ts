import type { EmailConteudo, EmailRecord } from '../types/email';

/**
 * Lançado especificamente quando o servidor responde `409` — slug já
 * existente em `data/active/` (checagem real contra o disco, ver
 * `projetosApiPlugin` em vite.config.ts, Etapa 5 de
 * implementacaoImportacao.md). A validação de slug do client (Etapa 4)
 * já deveria ter bloqueado esse caso antes do envio, mas o servidor é
 * quem garante de fato — este erro existe para a Etapa 7 poder distinguir
 * essa colisão de qualquer outra falha e agir de forma específica (ex.
 * reabrir a Etapa 1 do wizard em vez de só mostrar um erro genérico).
 */
export class ProjetoSlugDuplicadoError extends Error {
  constructor(mensagem: string = 'Já existe um projeto com esse slug.') {
    super(mensagem);
    this.name = 'ProjetoSlugDuplicadoError';
  }
}

/**
 * Lê `{ error }` do corpo de uma resposta não-`ok`, quando presente.
 * O middleware (`projetosApiPlugin`) sempre responde JSON em erro, mas a
 * leitura é protegida mesmo assim — uma falha de rede antes de chegar ao
 * middleware, por exemplo, não devolveria JSON válido.
 */
async function extrairMensagemDeErro(resposta: Response): Promise<string | undefined> {
  try {
    const corpo = await resposta.json();
    return typeof corpo?.error === 'string' ? corpo.error : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Cria um projeto novo via `POST /api/projetos` (Etapa 5), persistindo
 * `data/active/<slug>/emails.json` do zero — mesmo padrão de
 * `salvarEmails` (services/emailsApi.ts) já existente, mas para criação em
 * vez de atualização. Em sucesso, devolve o `slug` confirmado pelo
 * servidor (usado pela Etapa 8 para o redirecionamento pós-criação).
 */
export async function criarProjeto(
  slug: string,
  projeto: string,
  email: EmailConteudo,
  registros: EmailRecord[],
): Promise<string> {
  const resposta = await fetch('/api/projetos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, projeto, email, registros }),
  });

  if (!resposta.ok) {
    const mensagem = await extrairMensagemDeErro(resposta);

    if (resposta.status === 409) {
      throw new ProjetoSlugDuplicadoError(mensagem);
    }

    throw new Error(mensagem ?? 'Falha ao criar o novo projeto.');
  }

  const dados = (await resposta.json()) as { ok: true; slug: string };
  return dados.slug;
}

/**
 * Resultado individual de uma tentativa de exclusão, espelhando o formato
 * devolvido por `DELETE /api/projetos` (Etapa 2 de
 * implementacaoDelecao.md) para cada slug do lote.
 */
export interface ResultadoDelecaoProjeto {
  slug: string;
  ok: boolean;
  error?: string;
}

/**
 * Deleta (soft delete) um ou mais projetos via `DELETE /api/projetos`
 * (Etapa 2 de implementacaoDelecao.md), movendo cada pasta para
 * `data/trash/`. Endpoint sempre em lote (`{ slugs }`), mesmo para o caso
 * de uso individual do Header (Etapa 3) — evita duas rotas fazendo a
 * mesma coisa (ver seção 2 do plano).
 *
 * Cada slug é tratado de forma independente pelo servidor: a promise só
 * rejeita em falha de rede/parsing da própria requisição. Falhas por slug
 * (projeto não encontrado, etc.) vêm dentro do array de retorno — quem
 * chama decide como tratar cada item (ex.: Etapa 3 trata o único item do
 * lote como sucesso/falha da ação; Etapa 5 trata o lote inteiro).
 */
export async function deletarProjetos(slugs: string[]): Promise<ResultadoDelecaoProjeto[]> {
  const resposta = await fetch('/api/projetos', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slugs }),
  });

  if (resposta.status !== 200 && resposta.status !== 207) {
    const mensagem = await extrairMensagemDeErro(resposta);
    throw new Error(mensagem ?? 'Falha ao deletar o(s) projeto(s).');
  }

  const dados = (await resposta.json()) as { ok: boolean; resultados: ResultadoDelecaoProjeto[] };
  return dados.resultados;
}
