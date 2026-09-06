import type { EmailsData } from '../types/email';
// Etapa 4 (LogsDeAlteracoes.md): relata cada resposta 4xx/5xx como
// `erro_cliente`, em paralelo ao `throw` que os chamadores já tratam.
import { reportarErroApi } from './logsApi';

/**
 * Item devolvido por `GET /api/lixeira` (Etapa 6 de implementacaoDelecao.md)
 * — um por pasta em `data/trash/`. Espelha `ItemLixeira` de `vite.config.ts`;
 * não vive em `src/types/email.ts` porque não é um formato persistido, é só
 * a forma da resposta desta rota.
 */
export interface ItemLixeira {
  slug: string;
  projeto: string;
  deletado_em: string;
  diasRestantes: number;
  totalRegistros: number;
}

/**
 * Lê `{ error }` do corpo de uma resposta não-`ok`, quando presente — mesmo
 * padrão de `projetosApi.ts` (Etapa 3 de implementacaoDelecao.md).
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
 * Lista os projetos na lixeira via `GET /api/lixeira` (Etapa 6). Este
 * serviço nasce só na Etapa 8: na Etapa 7, sem nenhuma outra rota da
 * lixeira consumida pelo client, a listagem vivia como `fetch` cru dentro
 * de `LixeiraSidebar.tsx` — deixou de fazer sentido assim que
 * `restaurarProjetos` (abaixo) também precisou de um lugar para viver.
 */
export async function listarLixeira(): Promise<ItemLixeira[]> {
  const resposta = await fetch('/api/lixeira');

  if (!resposta.ok) {
    const mensagem = await extrairMensagemDeErro(resposta);
    reportarErroApi('GET', '/api/lixeira', resposta.status, mensagem);
    throw new Error(mensagem ?? 'Não foi possível carregar a lixeira.');
  }

  return (await resposta.json()) as ItemLixeira[];
}

/**
 * Resultado individual de uma tentativa de restauração, espelhando o
 * formato devolvido por `POST /api/lixeira/restaurar` (Etapa 8) para cada
 * slug do lote. Quando o slug já está em uso por um projeto ativo, `ok` é
 * `false` e `conflito` traz os dados completos dos dois lados (o projeto
 * ativo e o da lixeira) — pensado para a Etapa 9 (modal de resolução de
 * conflito) resolver sem precisar de uma segunda chamada ao servidor.
 */
export interface ResultadoRestauracaoProjeto {
  slug: string;
  ok: boolean;
  conflito?: {
    ativo: EmailsData;
    lixeira: EmailsData;
  };
  error?: string;
}

/**
 * Restaura um ou mais projetos da lixeira via `POST /api/lixeira/restaurar`
 * (Etapa 8), movendo cada pasta de volta para `data/active/<slug>`. Mesmo
 * padrão em lote de `deletarProjetos` (`projetosApi.ts`, seção 2 do plano):
 * o endpoint sempre recebe `{ slugs }`, mesmo para a restauração de um
 * único item selecionado na sidebar — evita duas rotas fazendo a mesma
 * coisa.
 *
 * Cada slug é tratado de forma independente pelo servidor: a promise só
 * rejeita em falha de rede/parsing da própria requisição. Falhas por
 * slug — inclusive o caso de conflito (slug já ativo) — vêm dentro do
 * array de retorno; quem chama decide como tratar cada item.
 */
export async function restaurarProjetos(slugs: string[]): Promise<ResultadoRestauracaoProjeto[]> {
  const resposta = await fetch('/api/lixeira/restaurar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slugs }),
  });

  if (resposta.status !== 200 && resposta.status !== 207) {
    const mensagem = await extrairMensagemDeErro(resposta);
    reportarErroApi('POST', '/api/lixeira/restaurar', resposta.status, mensagem);
    throw new Error(mensagem ?? 'Falha ao restaurar o(s) projeto(s).');
  }

  const dados = (await resposta.json()) as { ok: boolean; resultados: ResultadoRestauracaoProjeto[] };
  return dados.resultados;
}

/** Qual dos dois lados de um conflito de restauração está sendo renomeado. */
export type TOrigemRenomeio = 'ativo' | 'lixeira';

/**
 * Renomeia um dos lados de um conflito de restauração via
 * `PATCH /api/projetos/:slug` (Etapa 9). `slugAtual` é o slug conflitante —
 * o mesmo hoje nos dois lados, já que foi o que causou a colisão — e
 * `origem` diz qual dos dois (`conflito.ativo` ou `conflito.lixeira`, de
 * `ResultadoRestauracaoProjeto`) está sendo renomeado para `novoSlug`.
 * Usado por `ConflitoRestauracaoModal` antes de chamar `restaurarProjetos`
 * de novo — agora sem conflito, reaproveitando o caminho feliz da Etapa 8.
 */
export async function renomearProjeto(
  slugAtual: string,
  novoSlug: string,
  origem: TOrigemRenomeio,
): Promise<string> {
  const resposta = await fetch(`/api/projetos/${encodeURIComponent(slugAtual)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ novoSlug, origem }),
  });

  if (!resposta.ok) {
    const mensagem = await extrairMensagemDeErro(resposta);
    reportarErroApi('PATCH', `/api/projetos/${slugAtual}`, resposta.status, mensagem);
    throw new Error(mensagem ?? 'Não foi possível renomear a planilha.');
  }

  const dados = (await resposta.json()) as { ok: true; slug: string };
  return dados.slug;
}

/**
 * Resultado individual de uma tentativa de exclusão permanente, espelhando
 * o formato devolvido por `DELETE /api/lixeira` (Etapa 10) para cada slug
 * do lote.
 */
export interface ResultadoExclusaoPermanente {
  slug: string;
  ok: boolean;
  error?: string;
}

/**
 * Exclui permanentemente um ou mais itens da lixeira via
 * `DELETE /api/lixeira` (Etapa 10), removendo a(s) pasta(s) de vez — ação
 * irreversível. Mesmo padrão em lote das demais rotas (seção 2 do plano):
 * sempre `{ slugs }`, mesmo para exclusão individual (ícone por item) ou
 * "Esvaziar lixeira" (todos os slugs de uma vez).
 *
 * Cada slug é tratado de forma independente pelo servidor: a promise só
 * rejeita em falha de rede/parsing da própria requisição; falhas por slug
 * vêm dentro do array de retorno.
 */
export async function excluirPermanentemente(slugs: string[]): Promise<ResultadoExclusaoPermanente[]> {
  const resposta = await fetch('/api/lixeira', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slugs }),
  });

  if (resposta.status !== 200 && resposta.status !== 207) {
    const mensagem = await extrairMensagemDeErro(resposta);
    reportarErroApi('DELETE', '/api/lixeira', resposta.status, mensagem);
    throw new Error(mensagem ?? 'Falha ao excluir permanentemente o(s) item(ns).');
  }

  const dados = (await resposta.json()) as { ok: boolean; resultados: ResultadoExclusaoPermanente[] };
  return dados.resultados;
}