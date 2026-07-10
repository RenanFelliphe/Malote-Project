import type { EmailRecord, TStatusManual } from '../types/email';

interface Props {
  /** Status manual de destino da operação em massa (ex.: "válido", "inválido", "enviado"). */
  novoStatus: TStatusManual;
  /**
   * Registros selecionados com status "duplicado" — nunca são alterados por
   * uma atualização manual de status (é calculado automaticamente pelo
   * sistema, seção 5.1/7). Apenas exibição, no mesmo papel que "Enviados"
   * tem em `DeleteConflictContent`.
   */
  ignorados: EmailRecord[];
  /** Registros elegíveis para receber `novoStatus` (todos os selecionados que não são "duplicado"). */
  aAtualizar: EmailRecord[];
  /** IDs atualmente marcados para atualização, controlado por quem usa este componente. */
  selecionados: Set<number>;
  /** Indica se todos os itens de `aAtualizar` estão marcados (estado do "Selecionar Todos"). */
  todosSelecionados: boolean;
  /** Alterna a seleção de um único registro. */
  onToggle: (id: number) => void;
  /** Alterna a seleção de todos os registros de `aAtualizar` de uma vez. */
  onToggleAll: () => void;
}

/**
 * Conteúdo "burro" do futuro conflito de atualização de status em massa
 * (seção 7 — quando a seleção para uma troca de status manual contém
 * registros "duplicado", que nunca podem ser alterados manualmente e por
 * isso precisam ser destacados/ignorados, análogo à restrição já existente
 * para "enviado" na exclusão).
 *
 * Este componente ainda não é usado em nenhum fluxo real: não existe hoje
 * nenhum ponto do código que detecte esse conflito e abra um
 * `ConflictDialog` com ele (`handleAtualizarStatus`, em `emails.tsx`,
 * apenas ignora silenciosamente os "duplicado" da seleção). Ele é definido
 * agora seguindo exatamente o mesmo molde de `DeleteConflictContent`
 * (mesma forma de props — dados + callbacks, nada de modal/overlay/dialog;
 * mesmas duas seções, uma só-leitura e outra selecionável) para que, no dia
 * em que a restrição de duplicados virar um conflito real na interface,
 * baste plugá-lo dentro do `ConflictDialog` já existente:
 *
 * ```tsx
 * <ConflictDialog
 *   title="Alguns registros não podem ter o status alterado"
 *   onCancel={cancelar}
 *   onConfirm={confirmar}
 *   confirmLabel="Atualizar"
 *   confirmDisabled={selecionados.size === 0}
 * >
 *   <StatusUpdateConflict
 *     novoStatus={novoStatus}
 *     ignorados={ignorados}
 *     aAtualizar={aAtualizar}
 *     selecionados={selecionados}
 *     todosSelecionados={todosSelecionados}
 *     onToggle={alternarSelecionado}
 *     onToggleAll={alternarSelecionarTodos}
 *   />
 * </ConflictDialog>
 * ```
 */
export function StatusUpdateConflict({
  novoStatus,
  ignorados,
  aAtualizar,
  selecionados,
  todosSelecionados,
  onToggle,
  onToggleAll,
}: Props) {
  return (
    <>
      <section className="conflito-secao">
        <h3>Ignorados ({ignorados.length})</h3>
        <p className="conflito-descricao">
          Estes registros não serão alterados, pois o status "duplicado" é calculado
          automaticamente pelo sistema.
        </p>
        <ul className="conflito-lista conflito-lista-ignorados">
          {ignorados.map((registro) => (
            <li key={registro.id}>
              <span className="conflito-nome">{registro.nome || '(sem nome)'}</span>
              <span className="conflito-email">{registro.email || '(sem e-mail)'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="conflito-secao">
        <h3>
          A Atualizar para "{novoStatus}" ({aAtualizar.length})
        </h3>
        <label className="modal-selecionar-todos">
          <input
            type="checkbox"
            checked={todosSelecionados}
            onChange={onToggleAll}
            disabled={aAtualizar.length === 0}
          />
          Selecionar Todos
        </label>
        <ul className="conflito-lista conflito-lista-atualizar">
          {aAtualizar.map((registro) => (
            <li key={registro.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selecionados.has(registro.id)}
                  onChange={() => onToggle(registro.id)}
                />
                <span className="conflito-nome">{registro.nome || '(sem nome)'}</span>
                <span className="conflito-email">{registro.email || '(sem e-mail)'}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
