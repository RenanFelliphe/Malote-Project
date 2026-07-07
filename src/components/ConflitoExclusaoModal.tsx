import { useState } from 'react';

import type { EmailRecord } from '../types/email';

interface Props {
  /** Registros com status "enviado" presentes na seleção — não podem ser deletados (seção 7). */
  enviados: EmailRecord[];
  /** Registros elegíveis para exclusão (todos os selecionados que não são "enviado"). */
  aDeletar: EmailRecord[];
  onCancelar: () => void;
  onConfirmar: (idsParaDeletar: Set<number>) => void;
}

/**
 * Modal de resolução de conflito exibido quando a seleção para exclusão
 * contém registros "enviado" (seção 7 — "Restrição para enviados").
 *
 * Seção "Enviados": somente exibição (quantidade + lista), sem seleção.
 * Seção "A Deletar": todos os registros elegíveis, previamente selecionados,
 * com opção de selecionar/desmarcar individualmente ou via "Selecionar Todos".
 */
export function ConflitoExclusaoModal({ enviados, aDeletar, onCancelar, onConfirmar }: Props) {
  // Todos os elegíveis vêm previamente selecionados, conforme a especificação.
  const [selecionados, setSelecionados] = useState<Set<number>>(
    () => new Set(aDeletar.map((r) => r.id))
  );

  const todosSelecionados = aDeletar.length > 0 && aDeletar.every((r) => selecionados.has(r.id));

  function alternarSelecionado(id: number) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) {
        novo.delete(id);
      } else {
        novo.add(id);
      }
      return novo;
    });
  }

  function alternarSelecionarTodos() {
    setSelecionados((atual) => {
      if (todosSelecionados) {
        const novo = new Set(atual);
        aDeletar.forEach((r) => novo.delete(r.id));
        return novo;
      }
      const novo = new Set(atual);
      aDeletar.forEach((r) => novo.add(r.id));
      return novo;
    });
  }

  function cancelar() {
    onCancelar();
  }

  function confirmar() {
    onConfirmar(selecionados);
  }

  return (
    <div className="modal-overlay" onClick={cancelar}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Não é possível deletar registros enviados</h2>
          <button type="button" className="modal-fechar" onClick={cancelar} aria-label="Fechar">
            ×
          </button>
        </div>

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
          <label className="modal-selecionar-todos">
            <input
              type="checkbox"
              checked={todosSelecionados}
              onChange={alternarSelecionarTodos}
              disabled={aDeletar.length === 0}
            />
            Selecionar Todos
          </label>
          <ul className="conflito-lista conflito-lista-deletar">
            {aDeletar.map((registro) => (
              <li key={registro.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selecionados.has(registro.id)}
                    onChange={() => alternarSelecionado(registro.id)}
                  />
                  <span className="conflito-nome">{registro.nome || '(sem nome)'}</span>
                  <span className="conflito-email">{registro.email || '(sem e-mail)'}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        <div className="modal-rodape">
          <button type="button" className="modal-botao-cancelar" onClick={cancelar}>
            Cancelar
          </button>
          <button
            type="button"
            className="modal-botao-deletar"
            onClick={confirmar}
            disabled={selecionados.size === 0}
          >
            Deletar
          </button>
        </div>
      </div>
    </div>
  );
}
