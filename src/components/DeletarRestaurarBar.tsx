interface Props {
  quantidadeSelecionada: number;
  /** true quando TODOS os registros selecionados já estão com status "deletado". */
  todosDeletados: boolean;
  onDeletar: () => void;
  onRestaurar: () => void;
}

/**
 * Barra de ação para exclusão lógica / restauração (seção 7 —
 * "Exclusão lógica" e "Restaurar").
 *
 * É sempre um único botão: mostra "Deletar" enquanto a seleção tiver ao
 * menos um registro não deletado, e troca automaticamente para "Restaurar"
 * quando TODOS os registros selecionados já estiverem deletados — a regra
 * de seleção (que impede misturar deletados e não deletados) garante que
 * essas duas situações nunca coexistem na mesma seleção.
 */
export function DeletarRestaurarBar({
  quantidadeSelecionada,
  todosDeletados,
  onDeletar,
  onRestaurar,
}: Props) {
  if (quantidadeSelecionada === 0) {
    return null;
  }

  return (
    <div className="deletar-restaurar-bar">
      {todosDeletados ? (
        <button type="button" className="botao-restaurar" onClick={onRestaurar}>
          Restaurar
        </button>
      ) : (
        <button type="button" className="botao-deletar" onClick={onDeletar}>
          Deletar
        </button>
      )}
    </div>
  );
}
