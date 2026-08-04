/**
 * Ordenação dos cards de projeto na Home — Etapa 7 do plano de refatoração
 * multi-página (refatoracaoMultiPaginas-v2.md, seção 3.5 / Etapa 7).
 *
 * Reaproveita o mesmo padrão de `components/utils/emailData.ts`
 * (hierarquia de critérios + função de ordenação em cascata) e o mesmo
 * componente de interface (`OrdenacaoPrioridade`, agora genérico), mas com
 * um conjunto de critérios próprio da Home — nome do projeto, última
 * atualização e data de criação — em vez dos critérios da tabela de
 * e-mails (id/alfabética/status).
 */
import type { Projeto } from '../../data/projetos';

/** Critérios de ordenação disponíveis para os cards da Home (seção 3.5). */
export type TCriterioOrdenacaoHome = 'alfabetica' | 'atualizado' | 'criado';

/**
 * Hierarquia de ordenação da Home: mesmo conceito de prioridade em cascata
 * usado em `TOrdenacao` (emailData.ts) — o primeiro critério é aplicado
 * primeiro, os seguintes só desempatam. Na prática, dificilmente dois
 * projetos empatam em nome, atualização e criação ao mesmo tempo (ver nota
 * na seção 3.5 do plano), mas a hierarquia é mantida para reaproveitar o
 * componente `OrdenacaoPrioridade` tal como ele já existe.
 */
export type TOrdenacaoHome = TCriterioOrdenacaoHome[];

/** Hierarquia padrão ao carregar a Home — alfabética primeiro (seção 3.5). */
export const ORDENACAO_HOME_PADRAO: TOrdenacaoHome = ['alfabetica', 'atualizado', 'criado'];

/** Rótulos exibidos para cada critério na lista arrastável da Home. */
export const CRITERIO_ORDENACAO_HOME_LABELS: Record<TCriterioOrdenacaoHome, string> = {
  alfabetica: 'Ordem Alfabética',
  atualizado: 'Última Atualização',
  criado: 'Data de Criação',
};

/**
 * Compara dois projetos por um único critério. Retorna 0 quando empatam
 * nesse critério — quem chama decide se segue para o próximo da hierarquia.
 * "Última Atualização" e "Data de Criação" ordenam do mais recente para o
 * mais antigo (datas ISO 8601 comparam corretamente como string).
 */
function compararPorCriterio(a: Projeto, b: Projeto, criterio: TCriterioOrdenacaoHome): number {
  if (criterio === 'alfabetica') {
    return a.dados.projeto.localeCompare(b.dados.projeto, 'pt-BR', { sensitivity: 'base' });
  }
  if (criterio === 'atualizado') {
    return b.dados.atualizado_em.localeCompare(a.dados.atualizado_em);
  }
  // criado — mais recente primeiro.
  return b.dados.criado_em.localeCompare(a.dados.criado_em);
}

/**
 * Ordena os projetos em cascata pela hierarquia de critérios informada —
 * mesmo comportamento de `ordenar()` em `components/utils/emailData.ts`,
 * aplicado à lista de projetos descoberta em `PROJETOS` (Etapa 3).
 */
export function ordenarProjetos(projetos: Projeto[], hierarquia: TOrdenacaoHome): Projeto[] {
  const copia = [...projetos];

  copia.sort((a, b) => {
    for (const criterio of hierarquia) {
      const diferenca = compararPorCriterio(a, b, criterio);
      if (diferenca !== 0) return diferenca;
    }
    return 0;
  });

  return copia;
}