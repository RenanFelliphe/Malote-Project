/**
 * Modelo de dados do Sistema de Organização e Envio de E-mails.
 * Ver seção 4 da especificação (Especificacao_Sistema_Emails_v3.md).
 */

/**
 * Status possíveis de um registro.
 * Prioridade (da maior para a menor), usada na sincronização (seção 5.2):
 *   1. enviado
 *   2. deletado
 *   3. duplicado
 *   4. válido / inválido
 */
export type TStatus = 'válido' | 'inválido' | 'duplicado' | 'deletado' | 'enviado';

/** Lista dos status em ordem de prioridade (maior prioridade primeiro). */
export const STATUS_PRIORIDADE: TStatus[] = ['enviado', 'deletado', 'duplicado', 'válido', 'inválido'];

/** Filtros disponíveis na interface (seção 6). "todos" não é um status, é uma opção de filtro. */
export type TFiltro = 'todos' | 'válido' | 'inválido' | 'duplicado' | 'deletado' | 'enviado';

/**
 * Subconjunto de status que podem ser definidos manualmente pelo usuário,
 * seja individualmente (clicando no badge de um registro) ou em massa
 * (ícone no cabeçalho da coluna Status), OU pelo botão "Confirmar envio"
 * (cabeçalho da tabela). "duplicado" nunca aparece aqui: é calculado
 * automaticamente pelo sistema (seção 5.1) e não é um destino manual válido.
 * "deletado" também não aparece aqui: só é alcançável pelo botão de exclusão
 * (que, para registros "enviado", exige o modal de conflito) — nunca por
 * este select manual.
 *
 * Esse tipo continua aceitando "enviado", pois é usado pela lógica de
 * atualização de status (individual e em massa), que precisa lidar com
 * "enviado" tanto quando ele chega via o botão "Confirmar envio" quanto
 * por outras origens já existentes no fluxo. Para as opções exibidas nos
 * SELECTs de status (que não devem mais incluir "enviado"), ver
 * `TStatusSelecionavel` / `STATUS_SELECIONAVEIS` abaixo.
 */
export type TStatusManual = 'válido' | 'inválido' | 'enviado';

/**
 * Subconjunto de `TStatusManual` que pode ser escolhido diretamente pelo
 * usuário nos SELECTs de status (individual e em massa). Não inclui
 * "enviado": esse status passou a ser definido exclusivamente pelo botão
 * "Confirmar envio" no cabeçalho da tabela, seguindo o mesmo padrão do
 * botão de exclusão para "deletado".
 */
export type TStatusSelecionavel = 'válido' | 'inválido';

/** Lista dos status manuais aceitos pela lógica de atualização (individual e em massa). */
export const STATUS_MANUAIS: TStatusManual[] = ['válido', 'inválido', 'enviado'];

/** Lista dos status exibidos nos SELECTs de status (sem "enviado"). */
export const STATUS_SELECIONAVEIS: TStatusSelecionavel[] = ['válido', 'inválido'];

/**
 * Registro de e-mail — a unidade central do sistema.
 * O `id` representa a ordem original do registro na planilha e é
 * o campo usado para identificar/casar registros durante a sincronização.
 */
export interface EmailRecord {
  id: number;
  nome: string;
  email: string;
  status: TStatus;
  /**
   * Indica que o status foi definido manualmente pelo usuário.
   * Enquanto `true`, a sincronização não deve recalcular o status automaticamente.
   */
  status_alterado: boolean;
  /** Data/hora ISO da última alteração persistida neste registro. */
  last_updated: string;
}

/** Contadores exibidos na interface (seção 5.5), respeitando o status efetivo de cada registro. */
export interface EmailCounters {
  total: number;
  válido: number;
  inválido: number;
  duplicado: number;
  deletado: number;
  enviado: number;
}
