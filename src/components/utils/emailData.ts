/**
 * Funções puras de leitura/derivação de dados da tabela de e-mails.
 *
 * Etapa 3 da especificação (Especificacao_Sistema_Emails_v3.md):
 * contadores (5.5), busca (6), filtros (6) e ordenação (6).
 *
 * Nenhuma função aqui muta os registros recebidos — todas retornam
 * novos arrays/objetos, o que mantém a lógica fácil de testar e
 * reaproveitar (inclusive futuramente no modal da Etapa 4).
 */
import type { EmailCounters, EmailRecord, TFiltro, TStatus } from '../../types/email';

/** Cada critério de ordenação individual disponível na interface (seção 6). */
export type TCriterioOrdenacao = 'id' | 'alfabetica' | 'status';

/**
 * Hierarquia de ordenação: uma lista dos três critérios, do de maior
 * prioridade (índice 0) para o de menor. O primeiro critério é aplicado
 * primeiro; os seguintes servem apenas de desempate, em cascata, para os
 * registros que ficarem empatados no(s) critério(s) anterior(es) — ver a
 * lista arrastável em `OrdenacaoPrioridade`.
 */
export type TOrdenacao = TCriterioOrdenacao[];

/** Hierarquia padrão ao carregar a página — equivalente ao comportamento anterior (ID). */
export const ORDENACAO_PADRAO: TOrdenacao = ['id', 'alfabetica', 'status'];

/** Rótulos exibidos para cada critério na lista arrastável. */
export const CRITERIO_ORDENACAO_LABELS: Record<TCriterioOrdenacao, string> = {
  id: 'ID',
  alfabetica: 'Ordem alfabética',
  status: 'Status',
};

/** Opções de filtro exibidas na interface, na ordem em que devem aparecer (seção 6). */
export const FILTROS: { value: TFiltro; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'válido', label: 'Válidos' },
  { value: 'inválido', label: 'Inválidos' },
  { value: 'duplicado', label: 'Duplicados' },
  { value: 'deletado', label: 'Deletados' },
  { value: 'enviado', label: 'Enviados' },
];

/** Todos os status existentes (seção 5.2), na ordem em que aparecem nos filtros/contadores. */
export const TODOS_OS_STATUS: TStatus[] = ['válido', 'inválido', 'duplicado', 'deletado', 'enviado'];

/**
 * Ordem de exibição ao ordenar por "Status" — definida pelo usuário e
 * independente da prioridade de cálculo automático (seção 5.2, usada na
 * sincronização): Enviados, Válidos, Inválidos, Duplicados, Deletados.
 */
export const STATUS_ORDEM_EXIBICAO: TStatus[] = ['enviado', 'válido', 'inválido', 'duplicado', 'deletado'];

/** Rótulos dos contadores, na ordem em que devem aparecer (seção 5.5). */
export const CONTADOR_LABELS: { key: keyof EmailCounters; label: string }[] = [
  { key: 'total', label: 'Total' },
  { key: 'válido', label: 'Válidos' },
  { key: 'inválido', label: 'Inválidos' },
  { key: 'duplicado', label: 'Duplicados' },
  { key: 'deletado', label: 'Deletados' },
  { key: 'enviado', label: 'Enviados' },
];

/**
 * Calcula os contadores exibidos na interface, respeitando o status
 * efetivo (atual) de cada registro — seção 5.5.
 */
export function calcularContadores(registros: EmailRecord[]): EmailCounters {
  const contadores: EmailCounters = {
    total: registros.length,
    válido: 0,
    inválido: 0,
    duplicado: 0,
    deletado: 0,
    enviado: 0,
  };

  for (const registro of registros) {
    contadores[registro.status] += 1;
  }

  return contadores;
}

/**
 * Uma planilha com seus registros atuais, identificada por slug + nome de
 * exibição — forma comum usada tanto pela seleção múltipla da Home
 * (`pages/home.tsx`) quanto pela página de uma única planilha (via
 * `Header`), ao montar a lista passada ao `ExportarModal` (Etapa 3 de
 * implementacaoExportacaoHome.md).
 */
export interface PlanilhaParaContagem {
  slug: string;
  nome: string;
  registros: EmailRecord[];
}

/** Contadores de uma planilha específica, identificados por slug/nome (breakdown do `ExportarModal`). */
export interface ContadorPorPlanilha {
  slug: string;
  nome: string;
  contadores: EmailCounters;
}

/**
 * Contadores individuais de cada planilha selecionada — usado pelo
 * breakdown por planilha do `ExportarModal` quando há mais de uma
 * selecionada (Etapa 3 de implementacaoExportacaoHome.md). Cada entrada
 * reaproveita a mesma `calcularContadores` já usada para uma única
 * planilha, então os números batem exatamente com os exibidos hoje dentro
 * da página de cada planilha.
 */
export function calcularContadoresPorPlanilha(planilhas: PlanilhaParaContagem[]): ContadorPorPlanilha[] {
  return planilhas.map(({ slug, nome, registros }) => ({
    slug,
    nome,
    contadores: calcularContadores(registros),
  }));
}

/**
 * Soma um conjunto de `EmailCounters` (ex.: o breakdown por planilha) num
 * único total agregado — exibido pela lista de status do `ExportarModal`,
 * que sempre trabalha com o total combinado de todas as planilhas
 * selecionadas, mesmo quando há apenas uma (nesse caso, a soma de um único
 * item é numericamente idêntica ao `calcularContadores` de antes).
 */
export function somarContadores(lista: EmailCounters[]): EmailCounters {
  return lista.reduce(
    (soma, atual) => ({
      total: soma.total + atual.total,
      válido: soma.válido + atual.válido,
      inválido: soma.inválido + atual.inválido,
      duplicado: soma.duplicado + atual.duplicado,
      deletado: soma.deletado + atual.deletado,
      enviado: soma.enviado + atual.enviado,
    }),
    { total: 0, válido: 0, inválido: 0, duplicado: 0, deletado: 0, enviado: 0 }
  );
}

/**
 * Filtra os registros por um conjunto de status simultaneamente selecionados
 * (usado pela barra de filtros da tabela principal, onde cada botão
 * marca/desmarca seu status independentemente dos demais). Conjunto vazio
 * significa "nenhum status selecionado" — nenhum registro é exibido.
 */
export function filtrarPorStatusMultiplo(registros: EmailRecord[], statusSelecionados: Set<TStatus>): EmailRecord[] {
  return registros.filter((registro) => statusSelecionados.has(registro.status));
}

/**
 * Busca única por nome e e-mail simultaneamente, parcial e case insensitive
 * (seção 6 — "não haverá campos de busca separados").
 */
export function buscar(registros: EmailRecord[], termo: string): EmailRecord[] {
  const termoNormalizado = termo.trim().toLowerCase();
  if (termoNormalizado === '') return registros;

  return registros.filter(
    (registro) =>
      registro.nome.toLowerCase().includes(termoNormalizado) ||
      registro.email.toLowerCase().includes(termoNormalizado)
  );
}

/**
 * Compara dois registros por um único critério. Retorna 0 quando empatam
 * nesse critério — quem chama decide se segue para o próximo da hierarquia.
 */
function compararPorCriterio(a: EmailRecord, b: EmailRecord, criterio: TCriterioOrdenacao): number {
  if (criterio === 'id') {
    return a.id - b.id;
  }
  if (criterio === 'alfabetica') {
    return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
  }
  // status — ordem de exibição definida pelo usuário, não a prioridade de cálculo automático (seção 5.2).
  return STATUS_ORDEM_EXIBICAO.indexOf(a.status) - STATUS_ORDEM_EXIBICAO.indexOf(b.status);
}

/**
 * Ordena em cascata pela hierarquia de critérios informada: aplica o
 * primeiro critério e, para os registros empatados nele, desempata pelo
 * segundo, depois pelo terceiro — assim sucessivamente. Como "ID" é sempre
 * único, incluí-lo na hierarquia (em qualquer posição) garante um resultado
 * totalmente determinístico.
 */
export function ordenar(registros: EmailRecord[], hierarquia: TOrdenacao): EmailRecord[] {
  const copia = [...registros];

  copia.sort((a, b) => {
    for (const criterio of hierarquia) {
      const diferenca = compararPorCriterio(a, b, criterio);
      if (diferenca !== 0) return diferenca;
    }
    return 0;
  });

  return copia;
}

/**
 * Aplica, em sequência, filtro por status (multi-seleção), busca e
 * ordenação. Filtro e busca são comutativos entre si; a ordenação é sempre
 * aplicada por último.
 */
export function processarRegistros(
  registros: EmailRecord[],
  opcoes: { statusFiltrados: Set<TStatus>; termoBusca: string; ordenacao: TOrdenacao }
): EmailRecord[] {
  const filtrados = filtrarPorStatusMultiplo(registros, opcoes.statusFiltrados);
  const buscados = buscar(filtrados, opcoes.termoBusca);
  return ordenar(buscados, opcoes.ordenacao);
}
