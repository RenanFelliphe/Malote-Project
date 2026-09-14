import type { EmailRecord } from '../types/email';
import { CheckboxCustomizado } from './CheckboxCustomizado';

interface Props {
  /** Registros com status "enviado" presentes na seleção — apenas exibição. */
  enviados: EmailRecord[];
  /** Registros elegíveis para exclusão (todos os selecionados que não são "enviado"). */
  aDeletar: EmailRecord[];
  /** IDs atualmente marcados para exclusão, controlado por quem usa este componente. */
  selecionados: Set<string>;
  /** Indica se todos os itens de `aDeletar` estão marcados (estado do "Selecionar Todos"). */
  todosSelecionados: boolean;
  /** Alterna a seleção de um único registro. */
  onToggle: (id: string) => void;
  /** Alterna a seleção de todos os registros de `aDeletar` de uma vez. */
  onToggleAll: () => void;
}

/**
 * Conteúdo "burro" do conflito de exclusão de registros enviados (seção 7 —
 * "Restrição para enviados"). Recebe apenas dados e callbacks, e renderiza
 * as seções "Enviados" (somente exibição) e "A Deletar" (com seleção) — não
 * sabe nada sobre modal, overlay ou dialog. Quem o envolve (por ora
 * `ConflitoExclusaoModal`, e a partir da etapa 5 o `ConflictDialog`) é quem
 * decide o "casco" e o rodapé de ações.
 *
 * A seleção em si (estado de `selecionados`) é controlada por quem usa este
 * componente, já que os botões de cancelar/confirmar do rodapé vivem fora
 * dele.
 */
export function DeleteConflictContent({
  enviados,
  aDeletar,
  selecionados,
  todosSelecionados,
  onToggle,
  onToggleAll,
}: Props) {
  return (
    <>
      <section className="conflito-secao">
        <h3>Enviados ({enviados.length})</h3>
        <p className="conflito-descricao">
          Estes registros não serão alterados, pois já foram enviados.
        </p>
        <ul className="conflito-lista conflito-lista-enviados">
          {enviados.map((registro) => (
            <li key={registro.id}>
              <span className="conflito-nome">{registro.nome || '(sem nome)'}</span>
              <span className="conflito-email">{registro.email || '(sem e-mail)'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="conflito-secao">
        <h3>A Deletar ({aDeletar.length})</h3>
        <CheckboxCustomizado
          className="modal-selecionar-todos"
          checked={todosSelecionados}
          onChange={onToggleAll}
          disabled={aDeletar.length === 0}
        >
          Selecionar Todos
        </CheckboxCustomizado>
        <ul className="conflito-lista conflito-lista-deletar">
          {aDeletar.map((registro) => (
            <li key={registro.id}>
              <CheckboxCustomizado
                checked={selecionados.has(registro.id)}
                onChange={() => onToggle(registro.id)}
              >
                <span className="conflito-nome">{registro.nome || '(sem nome)'}</span>
                <span className="conflito-email">{registro.email || '(sem e-mail)'}</span>
              </CheckboxCustomizado>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
