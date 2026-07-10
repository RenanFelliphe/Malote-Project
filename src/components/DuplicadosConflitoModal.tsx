import { useState } from 'react';

import type { EmailRecord } from '../types/email';
import { ConflictDialog } from './ConflictDialog';
import { DeleteConflictContent } from './DeleteConflictContent';

interface Props {
  /** Registros que compartilham o mesmo e-mail (grupo de duplicados). */
  registros: EmailRecord[];
  onCancelar: () => void;
  /** IDs marcados para exclusão — o chamador é quem efetivamente deleta. */
  onConfirmar: (idsParaDeletar: Set<number>) => void;
}

/**
 * Partições do grupo de duplicados exibido no modal:
 * - `enviados`: ficam visíveis mas travados (mesmo tratamento da seção
 *   "Enviados" do `DeleteConflictContent`) — nunca podem ser deletados.
 * - `elegiveis`: podem ser selecionados para exclusão.
 *
 * Registros já `deletado` são propositalmente excluídos das duas listas:
 * não faz sentido reexibi-los como "a deletar" (já estão deletados) nem
 * como "enviados" (não é o que são) — eles simplesmente não aparecem no
 * modal.
 */
function particionarGrupoDuplicados(registros: EmailRecord[]) {
  const enviados = registros.filter((r) => r.status === 'enviado');
  const elegiveis = registros.filter((r) => r.status !== 'enviado' && r.status !== 'deletado');
  return { enviados, elegiveis };
}

/**
 * Modal de duplicados como uma instância do template de conflito
 * (`ConflictDialog` + `DeleteConflictContent`), na mesma linha do
 * `ConflitoExclusaoModal`. Além de exibir o grupo de registros que
 * compartilham o mesmo e-mail, permite deletar registros do grupo até
 * sobrar apenas 1 — a partir daí ele deixa de ser duplicado
 * automaticamente (recálculo feito por `recalcularStatusAutomatico`,
 * disparado pelo pipeline de exclusão existente; este componente não
 * precisa saber disso, só informa quais IDs foram marcados).
 *
 * Duas diferenças em relação ao `ConflitoExclusaoModal`:
 *
 * 1. `confirmDisabled` usa a regra "sobrar ao menos 1": o botão Confirmar
 *    fica desabilitado se a seleção deixaria menos de 1 registro elegível
 *    restante no grupo (`elegiveis.length - selecionados.size < 1`), e não
 *    a regra "nenhum selecionado" (`selecionados.size === 0`) usada na
 *    exclusão comum.
 * 2. A seleção nasce vazia — diferente do `ConflitoExclusaoModal`, onde
 *    todos os elegíveis já chegam pré-marcados. Se a seleção aqui nascesse
 *    cheia, o botão Confirmar nasceria desabilitado (por violar a regra
 *    "sobrar 1") sem o usuário ter feito nada.
 */
export function DuplicadosConflitoModal({ registros, onCancelar, onConfirmar }: Props) {
  const { enviados, elegiveis } = particionarGrupoDuplicados(registros);

  const [selecionados, setSelecionados] = useState<Set<number>>(() => new Set());

  const todosSelecionados = elegiveis.length > 0 && elegiveis.every((r) => selecionados.has(r.id));

  // Mínimo de 1 registro elegível deve restar ativo no grupo após a
  // exclusão — equivalente ao `confirmDisabled` do `ConflitoExclusaoModal`
  // ("nenhum selecionado"), só que invertido: aqui o problema não é
  // selecionar 0, e sim selecionar demais a ponto de zerar o grupo.
  const confirmDisabled = elegiveis.length - selecionados.size < 1;

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
        elegiveis.forEach((r) => novo.delete(r.id));
        return novo;
      }
      const novo = new Set(atual);
      elegiveis.forEach((r) => novo.add(r.id));
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
      title="Gerenciar registros duplicados"
      description="Selecione os registros que deseja deletar. É preciso manter ao menos 1 registro ativo neste grupo."
      onCancel={cancelar}
      onConfirm={confirmar}
      confirmVariant="danger"
      confirmLabel="Deletar"
      confirmDisabled={confirmDisabled}
      className="modal-duplicados"
    >
      <DeleteConflictContent
        enviados={enviados}
        aDeletar={elegiveis}
        selecionados={selecionados}
        todosSelecionados={todosSelecionados}
        onToggle={alternarSelecionado}
        onToggleAll={alternarSelecionarTodos}
      />
    </ConflictDialog>
  );
}
