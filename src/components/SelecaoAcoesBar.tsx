import { IconeRestaurar } from './IconeRestaurar';

type TStatusManual = 'válido' | 'inválido' | 'enviado';

const STATUS_MANUAIS: TStatusManual[] = ['válido', 'inválido', 'enviado'];

interface Props {
  quantidadeSelecionada: number;
  /** true quando TODOS os registros selecionados já estão com status "deletado". */
  todosDeletados: boolean;
  onAtualizarStatus: (novoStatus: TStatusManual) => void;
  onRestaurar: () => void;
}

/**
 * Bloco de ações da seleção, exibido inline na segunda linha da toolbar
 * quando há registros selecionados: "N selecionado(s)" + select "Atualizar
 * para" (seção 7 — "Atualizar Status", agora como `<select>` em vez de um
 * grupo de botões) + botão de restaurar.
 *
 * "Atualizar para" não aparece quando toda a seleção já está deletada — não
 * é permitido definir válido/inválido/enviado diretamente em registros
 * deletados, é preciso restaurar primeiro (mesma regra da antiga
 * `AtualizarStatusBar`). "duplicado" nunca é uma opção do select: é
 * calculado automaticamente pelo sistema (seção 5.1).
 *
 * O botão de deletar saiu daqui na Etapa 3 — agora vive no extremo direito
 * do cabeçalho da tabela (`EmailTable`). Só o botão de restaurar permanece
 * aqui, exibido quando `todosDeletados` for true; o resto deste bloco
 * (contagem + select) será removido na Etapa 5, junto do resto da barra.
 */
export function SelecaoAcoesBar({
  quantidadeSelecionada,
  todosDeletados,
  onAtualizarStatus,
  onRestaurar,
}: Props) {
  if (quantidadeSelecionada === 0) {
    return null;
  }

  function handleSelecionarStatus(evento: React.ChangeEvent<HTMLSelectElement>) {
    const valor = evento.target.value as TStatusManual | '';
    if (valor) onAtualizarStatus(valor);
  }

  return (
    <div className="selecao-acoes">
      <span className="selecao-acoes-contagem">{quantidadeSelecionada} selecionado(s)</span>

      {!todosDeletados && (
        <label className="selecao-acoes-atualizar">
          Atualizar para
          <select
            className="select-atualizar-status"
            value=""
            onChange={handleSelecionarStatus}
            aria-label="Atualizar status dos registros selecionados"
          >
            <option value="" disabled>
              Selecione...
            </option>
            {STATUS_MANUAIS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      )}

      {todosDeletados && (
        <button
          type="button"
          className="botao-icone botao-icone-restaurar"
          onClick={onRestaurar}
          title="Restaurar"
          aria-label="Restaurar registros selecionados"
        >
          <IconeRestaurar />
        </button>
      )}
    </div>
  );
}