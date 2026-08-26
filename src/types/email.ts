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
   * Modelo unificado de proteção contra sobrescrita manual (ver
   * `EdicaoIndividualdeRegistro.md`, seção 3). Substitui o antigo
   * `status_alterado` (booleano), generalizando o mesmo mecanismo para
   * `nome` e `email` além de `status`.
   *
   * Regra de captura ("primeira alteração vence", por campo,
   * independentemente): ao editar `nome`/`email` manualmente pela primeira
   * vez, a chave correspondente recebe o valor **anterior à edição** (que
   * nesse momento ainda é o valor vindo da planilha); edições seguintes do
   * mesmo campo não alteram a chave já capturada.
   *
   * A presença de uma chave aqui já funciona como trava de proteção contra
   * sobrescrita numa sincronização futura — não há booleano adicional por
   * campo.
   *
   * Restauração (assimétrica por design):
   * - `nome`/`email`: o valor capturado é escrito de volta literalmente.
   * - `status`: a chave é apenas removida e `recalcularStatusAutomatico`
   *   é disparado — o valor `true` armazenado nunca é lido como valor de
   *   status em si, só como marcação de proteção (mesmo papel que
   *   `status_alterado = true` cumpria antes).
   */
  backup_dados?: {
    /** Valor original da planilha para `nome`, capturado na primeira edição manual. */
    nome?: string;
    /** Valor original da planilha para `email`, capturado na primeira edição manual. */
    email?: string;
    /** `true` = status foi alterado manualmente (mesmo papel de `status_alterado` antigo). Nunca lido como valor de status. */
    status?: boolean;
  };
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

/**
 * Título e corpo do e-mail a ser enviado aos registros da planilha
 * (ver REFATORACAO-EMAIL-TITULO-CONTEUDO.md).
 */
export interface EmailConteudo {
  titulo: string;
  /**
   * Corpo do e-mail em **HTML** (não texto puro), produzido pelo editor
   * rico baseado em Tiptap (ver refatoracaoEmailFormatado.md). Registros
   * salvos antes dessa refatoração continuam válidos sem migração: texto
   * puro é HTML válido por si só (sem tags), então segue renderizando e
   * editando normalmente. Ao extrair o texto visível (ex. contador de
   * caracteres, exportações), usar o texto do editor (`editor.getText()`),
   * nunca `.length` desta string diretamente — ela inclui marcação HTML.
   */
  conteudo: string;
  /** Data/hora ISO da última alteração salva via o modal de edição. */
  atualizado_em: string;
}

/** Valor inicial/vazio de `EmailConteudo`, usado quando nada foi preenchido ainda. */
export const EMAIL_CONTEUDO_VAZIO: EmailConteudo = {
  titulo: '',
  conteudo: '',
  atualizado_em: '',
};

/**
 * Formato persistido em `data/<slug>/emails.json`: metadados do projeto
 * (nome de exibição e datas de criação/atualização), título/corpo do e-mail
 * e os registros da planilha, todos convivendo no mesmo arquivo — um por
 * projeto (ver plano de refatoração multi-página, seção 3.1).
 *
 * `slug` e `deletado_em` (ver `implementacaoDelecao.md`, seção 2 e Etapa 1):
 * quando um projeto é excluído, sua pasta inteira é movida de
 * `data/active/<slug>` para `data/trash/<slug>--<timestamp>` — o nome
 * físico da pasta na lixeira carrega o timestamp da exclusão apenas para
 * nunca colidir entre exclusões repetidas do mesmo slug ao longo do tempo.
 * A identidade real do projeto é o campo `slug` gravado aqui dentro do
 * próprio JSON, não o nome da pasta. Ao restaurar, a pasta volta a se
 * chamar `data/active/<slug>`, lendo o slug original deste campo.
 */
export interface EmailsData {
  /** Nome de exibição do projeto, livre, sem slugificação (definido no wizard). */
  projeto: string;
  /**
   * Data/hora ISO da última escrita bem-sucedida no arquivo (qualquer
   * alteração em `email` ou `registros`). Gravado pelo servidor a cada
   * `PUT`, nunca pelo client. Diferente de `email.atualizado_em`, que marca
   * especificamente a última edição do título/corpo do e-mail.
   */
  atualizado_em: string;
  /** Data/hora ISO de quando o projeto foi importado. Gravado uma única vez. */
  criado_em: string;
  /**
   * Identidade "de verdade" do projeto — ausente em projetos que nunca
   * passaram pela lixeira. Gravado no momento do primeiro soft delete
   * (Etapa 2), a partir de então usado para localizar a pasta em
   * `data/trash/` independentemente do timestamp no nome físico.
   */
  slug?: string;
  /**
   * Data/hora ISO do momento em que o projeto foi movido para
   * `data/trash/` (soft delete). Ausente em projetos que nunca passaram
   * pela lixeira; limpo (removido) ao restaurar.
   */
  deletado_em?: string;
  email: EmailConteudo;
  registros: EmailRecord[];
}