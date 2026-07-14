/**
 * As 4 etapas do assistente de importação, na ordem em que aparecem:
 * Informações → Mapeamento → Definição → Revisão.
 */
export type TEtapaImportacao = 1 | 2 | 3 | 4;

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
  /**
   * Título/corpo do e-mail preenchidos opcionalmente já durante a
   * importação (ver REFATORACAO-EMAIL-TITULO-CONTEUDO.md, Etapa 4).
   * Não bloqueiam o avanço de nenhuma etapa do wizard e, assim como o
   * restante do assistente nesta fase, ainda não são conectados a uma
   * importação real — o preenchimento definitivo continua podendo ser
   * feito depois pelo modal "Editar e-mail" na tela principal.
   */
  titulo: string;
  conteudo: string;
}

export const ESTADO_IMPORTACAO_INICIAL: EstadoImportacao = {
  nomeProjeto: '',
  nomeArquivoSlug: '',
  nomeArquivoEditadoManualmente: false,
  colunasNome: [],
  colunasEmail: [],
  buscaColunasNome: '',
  buscaColunasEmail: '',
  titulo: '',
  conteudo: '',
};
