import type { EmailCounters as EmailCountersType, TFiltro, TStatus } from '../types/email';
import { CONTADOR_LABELS, TODOS_OS_STATUS } from './utils/emailData';

interface Props {
  contadores: EmailCountersType;
  statusFiltrados: Set<TStatus>;
  onAlternarFiltro: (filtro: TFiltro) => void;
}

/**
 * Exibe os contadores de registros (total, válidos, inválidos, duplicados,
 * deletados, enviados) e, ao mesmo tempo, funciona como os filtros de
 * status: cada card é um switch independente — clicar nele marca/desmarca
 * seu status na seleção (mesma lógica de `alternarFiltro`, antes exposta só
 * pelos pills da `EmailToolbar`). O card "Total" é um atalho que marca ou
 * desmarca todos os status de uma vez, assim como o antigo filtro "Todos".
 */
export function EmailCounters({ contadores, statusFiltrados, onAlternarFiltro }: Props) {
  const todosMarcados = TODOS_OS_STATUS.every((status) => statusFiltrados.has(status));

  return (
    <div className="counters">
      {CONTADOR_LABELS.map(({ key, label }) => {
        const filtro: TFiltro = key === 'total' ? 'todos' : key;
        const ativo = key === 'total' ? todosMarcados : statusFiltrados.has(key as TStatus);

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