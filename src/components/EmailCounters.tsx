import type { EmailCounters as EmailCountersType } from '../types/email';
import { CONTADOR_LABELS } from './utils/emailData';

interface Props {
  contadores: EmailCountersType;
}

/** Exibe os contadores de registros (total, válidos, inválidos, duplicados, deletados, enviados). */
export function EmailCounters({ contadores }: Props) {
  return (
    <div className="counters">
      {CONTADOR_LABELS.map(({ key, label }) => (
        <div key={key} className={`counter-card counter-${key}`}>
          <span className="counter-value">{contadores[key]}</span>
          <span className="counter-label">{label}</span>
        </div>
      ))}
    </div>
  );
}
