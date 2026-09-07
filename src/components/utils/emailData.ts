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
import type { EmailCounters, EmailRecord, TStatus } from '../../types/email';
import { calcularEmailsDuplicados, normalizeEmail } from '../EmailStatus';

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

/**
 * Todos os status existentes hoje (seção 5.2, já sem `'duplicado'` desde a
 * Demanda 10 — Etapa 1), na ordem em que aparecem nos filtros/contadores.
 * O filtro "Duplicados" não faz mais parte deste conjunto a partir da
 * Etapa 5 (`RefatoracaoSistemadeDuplicatas.md`): passou a ser controlado
 * por um estado próprio (`duplicadosFiltroAtivo`, em `emails.tsx`), já que
 * deixou de ser um valor de `TStatus`.
 */
export const TODOS_OS_STATUS: TStatus[] = ['válido', 'inválido', 'deletado', 'enviado'];

/**
 * Ordem de exibição ao ordenar por "Status" — definida pelo usuário e
 * independente da prioridade de cálculo automático (seção 5.2, usada na
 * sincronização): Enviados, Válidos, Inválidos, Deletados.
 *
 * `'duplicado'` foi removido desta lista na Demanda 10 (Etapa 6,
 * `RefatoracaoSistemadeDuplicatas.md`), consequência direta de deixar de
 * ser um `TStatus` (Etapa 1) — passou a ser uma flag calculada, não um
 * status ordenável. Registros duplicados agora aparecem intercalados
 * dentro da posição do seu status real, em vez de agrupados numa faixa
 * própria.
 */
export const STATUS_ORDEM_EXIBICAO: TStatus[] = ['enviado', 'válido', 'inválido', 'deletado'];

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
 *
 * A partir da Demanda 10 (`RefatoracaoSistemadeDuplicatas.md`, Etapa 4),
 * "Duplicados" deixou de ser um dos valores possíveis de `registro.status`
 * (ver Etapa 1) e passou a ser contado separadamente, a partir da flag
 * calculada `emailsDuplicados` (`calcularEmailsDuplicados`, em
 * `EmailStatus.ts`): o total de registros **ativos** (não `deletado`) cujo
 * e-mail aparece mais de uma vez, independentemente do status real de cada
 * um — um registro `válido` duplicado é contado tanto em `válido` quanto em
 * `duplicado`. `emailsDuplicados` é recebido já calculado (pelo chamador),
 * em vez de recalculado aqui, seguindo a decisão da Etapa 3 de centralizar
 * esse cálculo uma única vez por conjunto de registros.
 */
export function calcularContadores(registros: EmailRecord[], emailsDuplicados: Set<string>): EmailCounters {
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

    if (registro.status !== 'deletado' && emailsDuplicados.has(normalizeEmail(registro.email))) {
      contadores.duplicado += 1;
    }
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
 *
 * Diferente de `emails.tsx` (que recebe `emailsDuplicados` já calculado via
 * `useMemo`, Etapa 3), aqui o `Set` é calculado por planilha, dentro do
 * próprio loop: `ExportarModal` também é usado fora do contexto de uma
 * única planilha (seleção múltipla em `pages/home.tsx`), então não há um
 * `emailsDuplicados` único aplicável a todas de uma vez — duplicidade só
 * faz sentido calculada dentro de cada planilha, nunca entre planilhas
 * diferentes.
 */
export function calcularContadoresPorPlanilha(planilhas: PlanilhaParaContagem[]): ContadorPorPlanilha[] {
  return planilhas.map(({ slug, nome, registros }) => ({
    slug,
    nome,
    contadores: calcularContadores(registros, calcularEmailsDuplicados(registros)),
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
 * Opções do filtro de duplicados, separado do conjunto de status desde a
 * Demanda 10 (Etapa 5): `ativo` é o estado do switch "Duplicados" e
 * `emailsDuplicados` é a mesma flag calculada (`calcularEmailsDuplicados`)
 * já usada pelos contadores (Etapa 4) e pela tabela (Etapa 7).
 */
export interface OpcoesFiltroDuplicados {
  ativo: boolean;
  emailsDuplicados: Set<string>;
}

/**
 * Filtra os registros por um conjunto de status simultaneamente selecionados
 * (usado pela barra de filtros da tabela principal, onde cada botão
 * marca/desmarca seu status independentemente dos demais) **em união** com
 * o filtro de duplicados: um registro passa se seu status estiver no
 * conjunto selecionado OU se o filtro "Duplicados" estiver ativo e ele for,
 * de fato, duplicado (Demanda 10, Etapa 5 — antes da Etapa 1, "duplicado"
 * era só mais um valor de `status`, então participava do mesmo `Set`; a
 * partir de agora é avaliado à parte, com a mesma semântica de união que os
 * demais switches já tinham entre si). `statusSelecionados` vazio e filtro
 * de duplicados inativo juntos significam "nenhum filtro selecionado" —
 * nenhum registro é exibido.
 */
export function filtrarPorStatusMultiplo(
  registros: EmailRecord[],
  statusSelecionados: Set<TStatus>,
  duplicados: OpcoesFiltroDuplicados
): EmailRecord[] {
  return registros.filter((registro) => {
    if (statusSelecionados.has(registro.status)) return true;
    return (
      duplicados.ativo &&
      registro.status !== 'deletado' &&
      duplicados.emailsDuplicados.has(normalizeEmail(registro.email))
    );
  });
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
 * Aplica, em sequência, filtro por status + duplicados (multi-seleção em
 * união), busca e ordenação. Filtro e busca são comutativos entre si; a
 * ordenação é sempre aplicada por último.
 */
export function processarRegistros(
  registros: EmailRecord[],
  opcoes: {
    statusFiltrados: Set<TStatus>;
    duplicadosFiltroAtivo: boolean;
    emailsDuplicados: Set<string>;
    termoBusca: string;
    ordenacao: TOrdenacao;
  }
): EmailRecord[] {
  const filtrados = filtrarPorStatusMultiplo(registros, opcoes.statusFiltrados, {
    ativo: opcoes.duplicadosFiltroAtivo,
    emailsDuplicados: opcoes.emailsDuplicados,
  });
  const buscados = buscar(filtrados, opcoes.termoBusca);
  return ordenar(buscados, opcoes.ordenacao);
}
