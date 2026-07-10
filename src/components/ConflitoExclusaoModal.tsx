import { useState } from 'react';

import type { EmailRecord } from '../types/email';
import { ConflictDialog } from './ConflictDialog';
import { DeleteConflictContent } from './DeleteConflictContent';

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
 * A partir da etapa 5, deixa de existir como modal próprio: é apenas a
 * composição do template `ConflictDialog` (etapa 3) com o conteúdo "burro"
 * `DeleteConflictContent` (etapa 4), no molde:
 *
 * ```tsx
 * <ConflictDialog title="..." onCancel={...} onConfirm={...}>
 *   <DeleteConflictContent ... />
 * </ConflictDialog>
 * ```
 *
 * Este componente permanece responsável apenas pelo estado de seleção
 * (quais IDs de `aDeletar` estão marcados para exclusão) — a parte de
 * modal/overlay/dialog e a área de ações (cancelar/confirmar) já vêm
 * prontas do `ConflictDialog`.
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
    <ConflictDialog
      title="Não é possível deletar registros enviados"
      onCancel={cancelar}
      onConfirm={confirmar}
      confirmVariant="danger"
      confirmLabel="Deletar"
      confirmDisabled={selecionados.size === 0}
    >
      <DeleteConflictContent
        enviados={enviados}
        aDeletar={aDeletar}
        selecionados={selecionados}
        todosSelecionados={todosSelecionados}
        onToggle={alternarSelecionado}
        onToggleAll={alternarSelecionarTodos}
      />
    </ConflictDialog>
  );
}
