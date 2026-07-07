type TStatusManual = 'válido' | 'inválido' | 'enviado';

const STATUS_MANUAIS: TStatusManual[] = ['válido', 'inválido', 'enviado'];

interface Props {
  quantidadeSelecionada: number;
  onAtualizarStatus: (novoStatus: TStatusManual) => void;
}

/**
 * Barra de ação exibida quando há registros selecionados, permitindo
 * atualizar o status para válido/inválido/enviado (seção 7 — "Atualizar
 * Status"). "duplicado" nunca aparece aqui: é calculado automaticamente
 * pelo sistema e não é um destino manual válido (seção 5.1 / 297).
 */
export function AtualizarStatusBar({ quantidadeSelecionada, onAtualizarStatus }: Props) {
  if (quantidadeSelecionada === 0) {
    return null;
  }

  return (
    <div className="atualizar-status-bar">
      <span>{quantidadeSelecionada} selecionado(s)</span>
      <span>Definir status:</span>
      {STATUS_MANUAIS.map((status) => (
        <button
          key={status}
          type="button"
          className={`botao-status botao-status-${status}`}
          onClick={() => onAtualizarStatus(status)}
        >
          {status}
        </button>
      ))}
    </div>
  );
}