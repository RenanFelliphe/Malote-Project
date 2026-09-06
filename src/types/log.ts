/**
 * Tipos do sistema de Logs de Alterações (Demanda 9, `LogsDeAlteracoes.md`).
 *
 * `TIPOS_ACAO` é a taxonomia fechada da seção 4 do planner — whitelist
 * validada em runtime por `registrarLog` (`scripts/utils/registrarLog.ts`).
 * "Adicionável" no futuro significa mudança de código (novo valor aqui +
 * novo caso no template de mensagem), nunca uma interface para o usuário
 * criar um tipo de log novo.
 */
export const TIPOS_ACAO = [
  'importar_planilha',
  'alterar_planilha',
  'reimportar_planilha',
  'deletar_projeto',
  'restaurar_projeto',
  'deletar_projeto_permanente',
  'exportar_planilha',
  'alterar_registro',
  'restaurar_registro',
  'editar_email',
  'erro_servidor',
  'erro_cliente',
] as const;

export type TipoAcao = (typeof TIPOS_ACAO)[number];

/**
 * Subconjunto de `TipoAcao` que representa erro não tratado, sem ação de
 * usuário por trás — `origem`/`detalhe` só existem para esses dois tipos
 * (seção 4, "Formato da linha (erro...)").
 */
export const TIPOS_ACAO_ERRO = ['erro_servidor', 'erro_cliente'] as const;

export type TipoAcaoErro = (typeof TIPOS_ACAO_ERRO)[number];

export function ehTipoAcaoErro(acao: TipoAcao): acao is TipoAcaoErro {
  return (TIPOS_ACAO_ERRO as readonly string[]).includes(acao);
}

/**
 * Parâmetros estruturados aceitos por `registrarLog` (planner, seção 5).
 *
 * - Para os 10 tipos de ação "normal": `projeto`/`registroId`/`quantidade`
 *   descrevem o alvo da mutação; `original`/`atual` descrevem o que mudou
 *   (dois formatos aceitos — ver `descreverDiferencas` em
 *   `registrarLog.ts`: diff genérico por chave, ou a forma dedicada de
 *   `editar_email`, `{ campo, de }`/`{ campo, para }`).
 * - Para `erro_servidor`/`erro_cliente`: `origem`/`detalhe` descrevem a
 *   falha; `mensagem`, quando informado, substitui o texto padrão do tipo
 *   — única exceção à regra de "mensagem sempre por template fixo" (seção
 *   5), já que o conteúdo de um erro é inerentemente livre (stack trace,
 *   texto de exceção). Para os outros 10 tipos, `mensagem` é ignorado.
 */
export interface DadosLog {
  projeto?: string | null;
  registroId?: string | null;
  quantidade?: number | null;
  original?: Record<string, unknown> | null;
  atual?: Record<string, unknown> | null;
  origem?: 'servidor' | 'cliente';
  detalhe?: string;
  /** Só usado para `erro_servidor`/`erro_cliente` — ver comentário acima. */
  mensagem?: string;
}

/** Formato de uma linha de log de ação normal (seção 4, "Formato da linha (ação normal)"). */
export interface LinhaLogAcao {
  id: string;
  data: string;
  acao: Exclude<TipoAcao, TipoAcaoErro>;
  projeto: string | null;
  registroId: string | null;
  quantidade: number | null;
  original: Record<string, unknown> | null;
  atual: Record<string, unknown> | null;
  mensagem: string;
}

/** Formato de uma linha de log de erro, sem ação de usuário por trás (seção 4, "Formato da linha (erro...)"). */
export interface LinhaLogErro {
  id: string;
  data: string;
  acao: TipoAcaoErro;
  origem: 'servidor' | 'cliente';
  projeto: null;
  registroId: null;
  quantidade: null;
  original: null;
  atual: null;
  mensagem: string;
  detalhe?: string;
}

/** União das duas formas de linha — o que efetivamente é serializado em `data/logs/<AAAA-MM>.jsonl`. */
export type LinhaLog = LinhaLogAcao | LinhaLogErro;
