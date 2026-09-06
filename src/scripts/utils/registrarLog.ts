/**
 * Utilitário central de log — Demanda 9 (`LogsDeAlteracoes.md`, seção 5),
 * Etapa 1.
 *
 * Função única, chamada por todo handler de mutação (`vite.config.ts`,
 * Etapa 2) e por todo ponto de captura de erro (Etapa 4) — nenhum outro
 * lugar do código escreve em `data/logs/` diretamente. Responsabilidades,
 * na ordem descrita na seção 5:
 *
 * 1. Valida `acao` contra a whitelist fixa (`TIPOS_ACAO`, `types/log.ts`).
 * 2. Checa o flag de ambiente `LOGS_ATIVOS` — `"false"` desativa a escrita
 *    sem que nenhum handler precise saber disso.
 * 3. Monta `mensagem` a partir de um template fixo por `acao` (única
 *    exceção: `erro_servidor`/`erro_cliente`, cujo conteúdo é
 *    inerentemente livre — ver `DadosLog.mensagem` em `types/log.ts`).
 * 4. Resolve `data/logs/<AAAA-MM>.jsonl` (mês corrente, em UTC — mesmo
 *    referencial de `data`), criando `data/logs/` automaticamente.
 * 5. Não grava nada quando a ação não resultou em mudança real — mesmo
 *    critério usado por `restaurarCampos.ts` para `last_updated`.
 * 6. `appendFile` (síncrono, mesmo padrão do resto de `vite.config.ts`)
 *    envolvido em `try/catch`: se falhar, tenta gravar uma única linha
 *    `erro_servidor` sobre essa falha; se essa segunda gravação também
 *    falhar, só `console.error`, sem nova tentativa — evita loop infinito
 *    de "log tentando logar sua própria falha".
 *
 * `data/logs/` é resolvido a partir de `process.cwd()` (mesmo padrão já
 * usado por `sync.ts` para `data/active/`) — assume-se, como o resto do
 * projeto, que o processo (dev server ou script CLI) sempre roda a partir
 * da raiz do repositório.
 */

import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

import {
  TIPOS_ACAO,
  ehTipoAcaoErro,
  type TipoAcao,
  type DadosLog,
  type LinhaLog,
} from '../../types/log.js';

/** Rótulos amigáveis para as chaves mais comuns em `original`/`atual` — usados só na mensagem, nunca no JSON gravado. */
const ROTULOS_CAMPO: Record<string, string> = {
  projeto: 'Nome do projeto',
  nome: 'Nome',
  email: 'E-mail',
  status: 'Status',
  assunto: 'Assunto',
  corpo: 'Corpo',
  // Adicionado na Etapa 2: usado pelo diff de renomeio de arquivo
  // (`handleRenomearProjeto` e a seção "Projeto"/coluna de `PUT
  // /api/emails/:slug`, ambos em `vite.config.ts`, tag `alterar_planilha`).
  // Distinto de `projeto` acima, que rotula o nome de exibição.
  slug: 'Nome do arquivo',
  colunaId: 'Coluna de ID',
};

function rotulo(chave: string): string {
  return ROTULOS_CAMPO[chave] ?? chave;
}

function formatarValor(valor: unknown): string {
  if (valor === undefined || valor === null || valor === '') return '(vazio)';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

/**
 * Descreve a(s) diferença(s) entre `original` e `atual`, cobrindo os dois
 * formatos aceitos pela seção 4 do planner:
 *  - diff genérico por chave — ex.: `{ status: 'pendente' }` → `{ status: 'enviado' }`;
 *  - forma dedicada de `editar_email` — `{ campo, de }` / `{ campo, para }`.
 * Devolve `null` quando não há nada para descrever (nenhuma chave mudou,
 * ou ambos ausentes/nulos) — o chamador decide a mensagem de fallback
 * nesse caso. Reaproveitada por `alterar_planilha`, `alterar_registro`,
 * `restaurar_registro` e `editar_email` em `montarMensagem`.
 */
function descreverDiferencas(dados: DadosLog): string | null {
  const original = dados.original ?? null;
  const atual = dados.atual ?? null;
  if (!original && !atual) return null;

  // Forma dedicada de editar_email: { campo, de } / { campo, para }.
  const campo = (atual?.campo ?? original?.campo) as unknown;
  if (typeof campo === 'string') {
    return `${rotulo(campo)} alterado: ${formatarValor(original?.de)} → ${formatarValor(atual?.para)}`;
  }

  // Diff genérico por chave.
  const chaves = new Set([...Object.keys(original ?? {}), ...Object.keys(atual ?? {})]);
  const partes: string[] = [];
  for (const chave of chaves) {
    const de = original?.[chave];
    const para = atual?.[chave];
    if (JSON.stringify(de) !== JSON.stringify(para)) {
      partes.push(`${rotulo(chave)}: ${formatarValor(de)} → ${formatarValor(para)}`);
    }
  }
  return partes.length > 0 ? partes.join('; ') : null;
}

/**
 * Template fixo de `mensagem` por `acao` (seção 5, item 3) — nunca texto
 * livre escrito por um handler, exceto para os dois tipos de erro (ver
 * `DadosLog.mensagem`, `types/log.ts`).
 *
 * Nota de execução (Etapa 1): a redação exata de cada template é a melhor
 * interpretação possível dos exemplos da seção 4 — como nenhum call site
 * real existe ainda (isso é Etapa 2), pode precisar de ajuste fino quando
 * os handlers de `vite.config.ts` passarem a chamar `registrarLog` de
 * verdade com o formato exato de `original`/`atual` que cada um produz.
 */
function montarMensagem(acao: TipoAcao, dados: DadosLog): string {
  if (ehTipoAcaoErro(acao)) {
    if (dados.mensagem?.trim()) return dados.mensagem.trim();
    return acao === 'erro_servidor' ? 'Erro não tratado no servidor.' : 'Erro não tratado no cliente.';
  }

  switch (acao) {
    case 'importar_planilha':
      return `Projeto "${dados.projeto ?? '?'}" importado` +
        (dados.quantidade != null ? ` (${dados.quantidade} registro(s)).` : '.');

    case 'alterar_planilha':
      return descreverDiferencas(dados) ??
        (dados.quantidade != null
          ? `Dados da planilha remapeados (${dados.quantidade} registro(s) afetado(s)).`
          : 'Dados da planilha remapeados.');

    case 'reimportar_planilha':
      return `Planilha reimportada` + (dados.quantidade != null ? ` (${dados.quantidade} registro(s)).` : '.');

    case 'deletar_projeto':
      return `Projeto "${dados.projeto ?? '?'}" movido para a lixeira.`;

    case 'restaurar_projeto':
      return `Projeto "${dados.projeto ?? '?'}" restaurado da lixeira.`;

    case 'deletar_projeto_permanente':
      return `Projeto "${dados.projeto ?? '?'}" excluído permanentemente.`;

    case 'exportar_planilha':
      return `Planilha exportada${dados.projeto ? ` do projeto "${dados.projeto}"` : ''}` +
        (dados.quantidade != null ? ` (${dados.quantidade} registro(s)).` : '.');

    case 'alterar_registro':
      return descreverDiferencas(dados) ?? 'Registro alterado.';

    case 'restaurar_registro':
      return `Campo(s) restaurado(s) a partir do backup: ${descreverDiferencas(dados) ?? '—'}.`;

    case 'editar_email':
      return descreverDiferencas(dados) ?? 'Conteúdo de e-mail do projeto alterado.';
  }
}

/**
 * Ações sem noção de "no-op" — a própria chamada já é a mudança real,
 * então `houveMudancaReal` nunca aplica o diff genérico de valor a elas.
 *
 * Ajuste de rota (Etapa 2): `restaurar_registro` entrou nesta lista ao
 * instrumentar `vite.config.ts` de verdade. Diferente de `alterar_registro`,
 * a "mudança real" de uma restauração é a própria remoção de chave(s) em
 * `backup_dados` (ver `restaurarCampos.ts`) — o valor do campo pode
 * permanecer idêntico (ex.: restaurar `status` não escreve nenhum valor
 * novo, seção 3/5 de `restaurarCampos.ts`). O chamador
 * (`registrarMutacoesDeRegistros`, `vite.config.ts`) só invoca
 * `registrarLog('restaurar_registro', ...)` depois de confirmar que ao
 * menos uma chave de `backup_dados` foi de fato removida — o diff
 * genérico de `original`/`atual` (que compararia só os valores) ficaria
 * incorretamente vazio nesse caso e descartaria uma linha legítima.
 */
const ACOES_SEMPRE_REAIS = new Set<TipoAcao>([
  'deletar_projeto',
  'restaurar_projeto',
  'deletar_projeto_permanente',
  'importar_planilha',
  'restaurar_registro',
]);

/**
 * Decide se a ação resultou em mudança real (seção 5, item 5):
 * - ações sempre reais (`ACOES_SEMPRE_REAIS`, ver acima): nunca são no-op;
 * - ações em massa (`quantidade` informado): reais só se `quantidade > 0`;
 * - ações com `original`/`atual`: reais só se algo de fato mudou de valor
 *   (mesmo critério de "no-op" de `restaurarCampos.ts`);
 * - nenhum dos casos acima: sem informação suficiente para negar, considera real.
 */
function houveMudancaReal(acao: TipoAcao, dados: DadosLog): boolean {
  if (ACOES_SEMPRE_REAIS.has(acao)) {
    return true;
  }
  if (dados.quantidade !== undefined && dados.quantidade !== null) {
    return dados.quantidade > 0;
  }
  if (dados.original !== undefined || dados.atual !== undefined) {
    return JSON.stringify(dados.original ?? null) !== JSON.stringify(dados.atual ?? null);
  }
  return true;
}

function pad(n: number, tamanho = 2): string {
  return String(n).padStart(tamanho, '0');
}

/** `AAAAMMDD-HHMMSS-xxxx` (seção 4) — ordena naturalmente por data, `xxxx` é sufixo aleatório (4 hex). Sempre em UTC, mesmo referencial de `data`. */
function gerarId(agora: Date): string {
  const data = `${agora.getUTCFullYear()}${pad(agora.getUTCMonth() + 1)}${pad(agora.getUTCDate())}`;
  const hora = `${pad(agora.getUTCHours())}${pad(agora.getUTCMinutes())}${pad(agora.getUTCSeconds())}`;
  return `${data}-${hora}-${randomBytes(2).toString('hex')}`;
}

/** `data/logs/<AAAA-MM>.jsonl`, resolvido a partir de `process.cwd()` (mês em UTC). */
function resolverArquivoMensal(agora: Date): string {
  const nomeArquivo = `${agora.getUTCFullYear()}-${pad(agora.getUTCMonth() + 1)}.jsonl`;
  return path.resolve(process.cwd(), 'data', 'logs', nomeArquivo);
}

function montarLinha(acao: TipoAcao, dados: DadosLog, agora: Date): LinhaLog {
  const id = gerarId(agora);
  const data = agora.toISOString();
  const mensagem = montarMensagem(acao, dados);

  if (ehTipoAcaoErro(acao)) {
    return {
      id,
      data,
      acao,
      origem: dados.origem ?? (acao === 'erro_servidor' ? 'servidor' : 'cliente'),
      projeto: null,
      registroId: null,
      quantidade: null,
      original: null,
      atual: null,
      mensagem,
      ...(dados.detalhe !== undefined ? { detalhe: dados.detalhe } : {}),
    };
  }

  return {
    id,
    data,
    acao,
    projeto: dados.projeto ?? null,
    registroId: dados.registroId ?? null,
    quantidade: dados.quantidade ?? null,
    original: dados.original ?? null,
    atual: dados.atual ?? null,
    mensagem,
  };
}

/**
 * Grava uma linha já montada, com o guard anti-loop do item 6 da seção 5.
 * `tentativaDeRecuperacao` (uso interno) marca que esta chamada já É a
 * tentativa de registrar uma falha anterior — se ela falhar de novo, desiste
 * silenciosamente (só `console.error`), sem gerar uma terceira tentativa.
 */
function gravarLinha(linha: LinhaLog, agora: Date, tentativaDeRecuperacao = false): void {
  try {
    const caminho = resolverArquivoMensal(agora);
    fs.mkdirSync(path.dirname(caminho), { recursive: true });
    fs.appendFileSync(caminho, JSON.stringify(linha) + '\n', 'utf-8');
  } catch (err) {
    console.error('registrarLog: falha ao gravar linha de log:', err);

    if (tentativaDeRecuperacao) {
      console.error('registrarLog: a tentativa de registrar essa falha como erro_servidor também falhou — desistindo (sem nova tentativa).');
      return;
    }

    const linhaDeErro = montarLinha(
      'erro_servidor',
      {
        origem: 'servidor',
        mensagem: `Falha ao gravar log de ${linha.acao}: ${err instanceof Error ? err.message : String(err)}`,
        detalhe: err instanceof Error ? err.stack : String(err),
      },
      agora,
    );
    gravarLinha(linhaDeErro, agora, true);
  }
}

/**
 * Registra uma linha de log — ponto de entrada único do sistema (seção 5).
 * `dados` pode ser omitido para os poucos tipos que não precisam de nenhum
 * parâmetro estruturado (nenhum caso real hoje, mas mantido opcional para
 * não obrigar `{}` em todo call site).
 */
export function registrarLog(acao: TipoAcao, dados: DadosLog = {}): void {
  if (!(TIPOS_ACAO as readonly string[]).includes(acao)) {
    console.error(`registrarLog: tipo de ação desconhecido, log descartado: ${String(acao)}`);
    return;
  }

  if (process.env.LOGS_ATIVOS === 'false') {
    return;
  }

  if (!ehTipoAcaoErro(acao) && !houveMudancaReal(acao, dados)) {
    return;
  }

  const agora = new Date();
  gravarLinha(montarLinha(acao, dados, agora), agora);
}
