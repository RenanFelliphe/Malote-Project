import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  /**
   * Ref do botão-gatilho que abriu este popover — usada tanto para
   * calcular a posição inicial (`getBoundingClientRect`) quanto para o
   * fechamento por clique-fora (um clique no próprio gatilho não deve
   * contar como "fora").
   */
  anchorRef: RefObject<HTMLElement | null>;
  /** Chamado ao fechar (clique fora, Esc). */
  onClose: () => void;
  /** Classes extras (ex.: `email-editor-toolbar-popover-cores`, `-link`). */
  className?: string;
  children: ReactNode;
}

/**
 * Popover de botão da toolbar do editor de e-mail
 * (RefatoracaoToolbarEmail.md — Etapa 1). Substitui o antigo
 * `ToolbarGrupo.tsx`: em vez de nascer como filho posicionado
 * (`position: absolute`) de um ancestral `position: relative` dentro da
 * `.email-editor-toolbar` — a causa raiz do bug diagnosticado na Etapa 0
 * (`overflow: hidden` da toolbar cortando/empurrando o popover) —, este
 * componente renderiza via `createPortal` direto em `document.body`, no
 * mesmo espírito do `Dialog.tsx` já existente no projeto, e calcula sua
 * própria posição (`top`/`left`) a partir do retângulo do botão-gatilho.
 *
 * Encapsula também o fechamento por clique-fora e Esc — antes replicado
 * manualmente em `EmailEditorToolbar.tsx` para cada painel (cor, realce,
 * link, botão); agora é responsabilidade única deste componente, então
 * quem usa só precisa fornecer `anchorRef` e `onClose`.
 *
 * A posição é recalculada em `resize`/`scroll` (captura, para acompanhar
 * scroll de qualquer ancestral, inclusive o `dialog-content` do modal)
 * enquanto o popover estiver aberto, para que ele continue ancorado ao
 * botão mesmo que o layout ao redor mude.
 */
export function ToolbarPopover({ anchorRef, onClose, className = '', children }: Props) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    function atualizarPosicao() {
      const elemento = anchorRef.current;
      if (!elemento) return;
      const retangulo = elemento.getBoundingClientRect();
      setCoords({ top: retangulo.bottom + 6, left: retangulo.left });
    }

    atualizarPosicao();
    window.addEventListener('resize', atualizarPosicao);
    window.addEventListener('scroll', atualizarPosicao, true);
    return () => {
      window.removeEventListener('resize', atualizarPosicao);
      window.removeEventListener('scroll', atualizarPosicao, true);
    };
  }, [anchorRef]);

  // Fecha ao clicar fora do popover E fora do próprio gatilho (o clique que
  // fecha o painel ao alternar o estado já é tratado por quem chama
  // `onClose`/reabre; aqui só cobre "clicou em qualquer outro lugar").
  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      const alvo = e.target as Node;
      if (popoverRef.current?.contains(alvo)) return;
      if (anchorRef.current?.contains(alvo)) return;
      onClose();
    }

    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, [anchorRef, onClose]);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Enquanto a posição inicial ainda não foi calculada (primeiro efeito
  // ainda não rodou), não renderiza nada — evita um piscar no canto
  // superior esquerdo da tela antes da primeira medição.
  if (!coords) return null;

  return createPortal(
    <div
      ref={popoverRef}
      className={`email-editor-toolbar-popover ${className}`.trim()}
      style={{ top: coords.top, left: coords.left }}
    >
      {children}
    </div>,
    document.body
  );
}

export default ToolbarPopover;