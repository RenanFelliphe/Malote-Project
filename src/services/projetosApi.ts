import type { EmailConteudo, EmailRecord } from '../types/email';
// Etapa 4 (LogsDeAlteracoes.md): relata cada resposta 4xx/5xx como
// `erro_cliente`, em paralelo ao `throw` que os chamadores já tratam.
import { reportarErroApi } from './logsApi';

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
 * Converte um `File` em base64 para envio embutido no corpo JSON de
 * `criarProjeto`/`enviarSheet` (Etapa 1 de AtualizacaoDaPlanilhaViaUI.md)
 * — evita depender de `multipart/form-data` e mantém consistência com o
 * restante da API, que já é JSON em toda parte. Processado em blocos de
 * 0x8000 bytes para não estourar a pilha de `String.fromCharCode` em
 * arquivos maiores.
 */
export async function arquivoParaBase64(arquivo: File): Promise<string> {
  const buffer = await arquivo.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const TAMANHO_BLOCO = 0x8000;
  let binario = '';
  for (let indice = 0; indice < bytes.length; indice += TAMANHO_BLOCO) {
    const bloco = bytes.subarray(indice, indice + TAMANHO_BLOCO);
    binario += String.fromCharCode(...bloco);
  }
  return btoa(binario);
}

/**
 * Cria um projeto novo via `POST /api/projetos` (Etapa 5), persistindo
 * `data/active/<slug>/emails.json` do zero — mesmo padrão de
 * `salvarEmails` (services/emailsApi.ts) já existente, mas para criação em
 * vez de atualização. Em sucesso, devolve o `slug` confirmado pelo
 * servidor (usado pela Etapa 8 para o redirecionamento pós-criação).
 *
 * A partir da Etapa 1 de AtualizacaoDaPlanilhaViaUI.md, também envia o
 * `arquivo` original (planilha bruta) em base64, persistido pelo servidor
 * como `sheet.<ext>` ao lado de `emails.json` — sem mudar o restante do
 * fluxo de importação, que já tinha o `File` em mãos (prop `arquivo` de
 * `ImportWizardModal`).
 *
 * Demanda 7 (Mapeamento de ID Personalizado, Etapa 7): novo parâmetro
 * opcional `colunaId`, enviado no corpo como campo próprio para o servidor
 * persistir em `EmailsData.colunaId` (`emails.json`). `undefined`/ausente
 * preserva o comportamento anterior a esta demanda ("Gerar
 * Automaticamente"). Opcional (não um parâmetro obrigatório a mais como em
 * `calcularMerge`/Etapa 3) para não arriscar quebrar outros chamadores de
 * `criarProjeto` que não fazem parte dos arquivos desta demanda e que eu
 * não tenho como enumerar aqui.
 *
 * PENDÊNCIA: enviar este campo no corpo da requisição só tem efeito se o
 * middleware do servidor (`projetosApiPlugin`, citado no comentário de
 * `ProjetoSlugDuplicadoError` acima como estando em `vite.config.ts`) for
 * ajustado para ler `colunaId` do corpo e gravá-lo em `EmailsData` ao
 * montar `emails.json`. Esse arquivo não está disponível nesta entrega —
 * a persistência de fato só fecha quando ele for enviado e ajustado.
 */
export async function criarProjeto(
  slug: string,
  projeto: string,
  email: EmailConteudo,
  registros: EmailRecord[],
  arquivo: File,
  colunaId?: string | null,
): Promise<string> {
  const conteudoBase64 = await arquivoParaBase64(arquivo);
  const resposta = await fetch('/api/projetos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug,
      projeto,
      email,
      registros,
      arquivo: { nomeArquivo: arquivo.name, conteudoBase64 },
      colunaId: colunaId ?? null,
    }),
  });

  if (!resposta.ok) {
    const mensagem = await extrairMensagemDeErro(resposta);
    reportarErroApi('POST', '/api/projetos', resposta.status, mensagem);

    if (resposta.status === 409) {
      throw new ProjetoSlugDuplicadoError(mensagem);
    }

    throw new Error(mensagem ?? 'Falha ao criar o novo projeto.');
  }

  const dados = (await resposta.json()) as { ok: true; slug: string };
  return dados.slug;
}

/**
 * Renomeia a pasta/slug de um projeto ativo via `PATCH /api/projetos/:slug`
 * (Etapa 3 de AtualizacaoDaPlanilhaViaUI.md) — endpoint já existente,
 * construído originalmente para o conflito de restauração da lixeira
 * (`origem: 'lixeira'`), reaproveitado tal como está (`origem: 'ativo'`)
 * pela seção "Projeto" do fluxo "Atualizar Dados" (Etapa 7), quando o
 * nome do arquivo/rota muda. Em sucesso, devolve o `slug` confirmado pelo
 * servidor — usado tanto na chamada seguinte a `salvarEmails` quanto no
 * redirecionamento para a nova rota (`/projetos/<slug>`).
 *
 * Reaproveita `ProjetoSlugDuplicadoError` para o `409` deste endpoint
 * também — mesmo significado (colisão de nome de arquivo/slug) do `409`
 * de `criarProjeto`.
 */
export async function renomearProjeto(slugAtual: string, novoSlug: string): Promise<string> {
  const resposta = await fetch(`/api/projetos/${encodeURIComponent(slugAtual)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ novoSlug, origem: 'ativo' }),
  });

  if (!resposta.ok) {
    const mensagem = await extrairMensagemDeErro(resposta);
    reportarErroApi('PATCH', `/api/projetos/${slugAtual}`, resposta.status, mensagem);

    if (resposta.status === 409) {
      throw new ProjetoSlugDuplicadoError(mensagem);
    }

    throw new Error(mensagem ?? 'Falha ao renomear o projeto.');
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
    reportarErroApi('DELETE', '/api/projetos', resposta.status, mensagem);
    throw new Error(mensagem ?? 'Falha ao deletar o(s) projeto(s).');
  }

  const dados = (await resposta.json()) as { ok: boolean; resultados: ResultadoDelecaoProjeto[] };
  return dados.resultados;
}