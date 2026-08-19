import { useState } from 'react';

/**
 * Hook genérico de seleção múltipla, usado pela Home para ativar um "modo de
 * seleção" nos cards de projeto (Etapa 0 de implementacaoExportacaoHome.md).
 *
 * Extraído do que antes vivia embutido em `home.tsx`, especificamente para
 * a exclusão em lote (Etapa 4 de implementacaoDelecao.md) — sem nenhuma
 * mudança de comportamento nesta extração. Passa a ser reaproveitado
 * também pela exportação em lote (Etapa 2) e por qualquer ação futura em
 * lote sobre os cards da Home, já que não sabe nada sobre qual ação está
 * sendo realizada com a seleção — só controla quais ids estão marcados.
 */
export interface SelecaoMultipla {
  /** Indica se o modo de seleção está ativo (checkboxes visíveis nos cards). */
  ativo: boolean;
  /** Ids (slugs) atualmente selecionados. */
  selecionados: Set<string>;
  /** Entra no modo de seleção, sempre com seleção vazia. */
  ativar: () => void;
  /** Sai do modo de seleção e limpa a seleção — usado pelo "Cancelar" da barra de ação. */
  cancelar: () => void;
  /** Marca/desmarca um id na seleção atual. */
  alternar: (id: string) => void;
}

export function useSelecaoMultipla(): SelecaoMultipla {
  const [ativo, setAtivo] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  function ativar() {
    setAtivo(true);
    setSelecionados(new Set());
  }

  function cancelar() {
    setAtivo(false);
    setSelecionados(new Set());
  }

  function alternar(id: string) {
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

  return { ativo, selecionados, ativar, cancelar, alternar };
}
