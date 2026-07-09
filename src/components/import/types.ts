/** As 3 etapas do assistente de importação, na ordem em que aparecem. */
export type TEtapaImportacao = 1 | 2 | 3;

/**
 * Estado do formulário do assistente, mantido enquanto o modal estiver
 * aberto. Nada aqui é persistido — vive só na memória do componente e é
 * descartado ao cancelar ou concluir (etapa "apenas interface").
 */
export interface EstadoImportacao {
  nomeProjeto: string;
  nomeArquivoSlug: string;
  /** Uma vez editado manualmente, o slug para de ser sincronizado a partir do nome do projeto. */
  nomeArquivoEditadoManualmente: boolean;
  /** Colunas selecionadas para Nome, em ordem de prioridade (índice 0 = maior prioridade). */
  colunasNome: string[];
  /** Colunas selecionadas para E-mail, em ordem de prioridade (índice 0 = maior prioridade). */
  colunasEmail: string[];
  buscaColunasNome: string;
  buscaColunasEmail: string;
}

export const ESTADO_IMPORTACAO_INICIAL: EstadoImportacao = {
  nomeProjeto: '',
  nomeArquivoSlug: '',
  nomeArquivoEditadoManualmente: false,
  colunasNome: [],
  colunasEmail: [],
  buscaColunasNome: '',
  buscaColunasEmail: '',
};
