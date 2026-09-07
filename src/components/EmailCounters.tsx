import type { EmailCounters as EmailCountersType, TFiltro, TStatus } from '../types/email';
import { CONTADOR_LABELS, TODOS_OS_STATUS } from './utils/emailData';

interface Props {
  contadores: EmailCountersType;
  statusFiltrados: Set<TStatus>;
  /**
   * Estado do switch "Duplicados", separado de `statusFiltrados` desde a
   * Demanda 10 (Etapa 5) — `'duplicado'` deixou de ser um `TStatus` válido
   * (Etapa 1), então não faz mais parte do `Set` de status selecionados.
   */
  duplicadosFiltroAtivo: boolean;
  onAlternarFiltro: (filtro: TFiltro) => void;
}

/**
 * Exibe os contadores de registros (total, válidos, inválidos, duplicados,
 * deletados, enviados) e, ao mesmo tempo, funciona como os filtros de
 * status: cada card é um switch independente — clicar nele marca/desmarca
 * seu status na seleção (mesma lógica de `alternarFiltro`, antes exposta só
 * pelos pills da `EmailToolbar`). O card "Total" é um atalho que marca ou
 * desmarca todos os status de uma vez, assim como o antigo filtro "Todos".
 *
 * Demanda 10, Etapa 4 (`RefatoracaoSistemadeDuplicatas.md`): o valor
 * exibido no card "Duplicados" (`contadores.duplicado`) mudou de
 * significado em `calcularContadores` (`emailData.ts`) — deixou de contar
 * `status === 'duplicado'` (valor que não existe mais) e passou a contar
 * registros ativos cujo e-mail está na flag calculada, independente do
 * status real de cada um.
 *
 * Demanda 10, Etapa 5: o próprio switch deste card passou a refletir a
 * mesma flag — `duplicadosFiltroAtivo`, recebido como propriedade própria,
 * em vez de `statusFiltrados.has('duplicado')` (que nunca mais será
 * verdadeiro, já que `'duplicado'` não é mais um `TStatus`). O card "Total"
 * agora só é considerado "marcado" quando todos os 4 status **e** o filtro
 * de duplicados estão ativos ao mesmo tempo.
 */
export function EmailCounters({ contadores, statusFiltrados, duplicadosFiltroAtivo, onAlternarFiltro }: Props) {
  const todosMarcados = TODOS_OS_STATUS.every((status) => statusFiltrados.has(status)) && duplicadosFiltroAtivo;

  return (
    <div className="counters">
      {CONTADOR_LABELS.map(({ key, label }) => {
        const filtro: TFiltro = key === 'total' ? 'todos' : key;
        const ativo = key === 'total'
          ? todosMarcados
          : key === 'duplicado'
            ? duplicadosFiltroAtivo
            : statusFiltrados.has(key as TStatus);

        return (
          <button
            key={key}
            type="button"
            className={`counter-card counter-${key} ${ativo ? 'counter-ativo' : 'counter-inativo'}`}
            onClick={() => onAlternarFiltro(filtro)}
            aria-pressed={ativo}
          >
            <span className="counter-switch" aria-hidden="true" />
            <span className="counter-value">{contadores[key]}</span>
            <span className="counter-label">{label}</span>
          </button>
        );
      })}
    </div>
  );
}