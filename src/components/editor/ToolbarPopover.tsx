import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
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

/** Distância mínima mantida entre o popover e a borda da viewport (Etapa 3
 * — RefatoracaoToolbarEmail.md), tanto no ajuste horizontal quanto na
 * decisão de abrir acima/abaixo do gatilho. */
const MARGEM_VIEWPORT_PX = 8;

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
 *
 * Ajuste fino da Etapa 3: a posição inicial (`calcularPosicaoInicial`) é
 * sempre "logo abaixo, alinhado à esquerda do gatilho" — não tem como
 * saber o tamanho real do popover antes dele existir no DOM. Um segundo
 * efeito (`ajustarSeUltrapassarViewport`), que só roda depois que o
 * popover já foi montado com essa posição inicial, mede o próprio
 * retângulo e corrige em dois casos, achados no diagnóstico da Etapa 0 ao
 * testar a toolbar num modal estreito (`dialog-content`, `max-width:
 * 520px`): (1) se o popover ultrapassar a borda direita da viewport,
 * desliza para a esquerda o suficiente para caber; (2) se não houver
 * espaço vertical suficiente abaixo do gatilho (comum quando o botão está
 * perto do fim do modal), abre para cima dele em vez de para baixo.
 */
export function ToolbarPopover({ anchorRef, onClose, className = '', children }: Props) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const calcularPosicaoInicial = useCallback(() => {
    const elemento = anchorRef.current;
    if (!elemento) return null;
    const retangulo = elemento.getBoundingClientRect();
    return { top: retangulo.bottom + 6, left: retangulo.left };
  }, [anchorRef]);

  useLayoutEffect(() => {
    function atualizarPosicao() {
      const posicao = calcularPosicaoInicial();
      if (posicao) setCoords(posicao);
    }

    atualizarPosicao();
    window.addEventListener('resize', atualizarPosicao);
    window.addEventListener('scroll', atualizarPosicao, true);
    return () => {
      window.removeEventListener('resize', atualizarPosicao);
      window.removeEventListener('scroll', atualizarPosicao, true);
    };
  }, [calcularPosicaoInicial]);

  // Etapa 3 — só roda depois que `coords` já existe (o popover já está no
  // DOM com a posição inicial calculada acima), para poder medir o
  // tamanho real do popover e corrigir se ele ultrapassar a viewport. Ver
  // JSDoc do componente.
  useLayoutEffect(() => {
    if (!coords) return;
    const elementoAncora = anchorRef.current;
    const elementoPopover = popoverRef.current;
    if (!elementoAncora || !elementoPopover) return;

    const retanguloAncora = elementoAncora.getBoundingClientRect();
    const retanguloPopover = elementoPopover.getBoundingClientRect();

    let left = coords.left;
    const maximoLeft = window.innerWidth - retanguloPopover.width - MARGEM_VIEWPORT_PX;
    if (left > maximoLeft) left = maximoLeft;
    if (left < MARGEM_VIEWPORT_PX) left = MARGEM_VIEWPORT_PX;

    let top = coords.top;
    const espacoAbaixo = window.innerHeight - retanguloAncora.bottom;
    const cabeAbaixo = espacoAbaixo >= retanguloPopover.height + MARGEM_VIEWPORT_PX;
    const cabeAcima = retanguloAncora.top >= retanguloPopover.height + MARGEM_VIEWPORT_PX;
    if (!cabeAbaixo && cabeAcima) {
      top = retanguloAncora.top - retanguloPopover.height - 6;
    }

    // Só atualiza se algo de fato mudou — evita um loop de re-render (o
    // segundo cálculo, sobre a posição já corrigida, deve bater com a
    // mesma posição e parar por aqui).
    if (left !== coords.left || top !== coords.top) {
      setCoords({ top, left });
    }
  }, [coords, anchorRef]);

  // Fecha ao clicar fora do popover E fora do próprio gatilho (o clique que
  // fecha o painel ao alternar o estado já é tratado por quem chama
  // `onClose`/reabre; aqui só cobre "clicou em qualquer outro lugar").
  //
  // Ajuste fino da Etapa 3: um botão oculto (dentro do painel de "Ver
  // Mais") pode ter seu próprio popover companheiro (ex.: "cor", "realce",
  // "botão"), aberto por cima do painel de "Ver Mais" sem fechá-lo — os
  // dois usam estados independentes de propósito (`painelAberto` e
  // `verMaisAberto`, ver JSDoc de `EmailEditorToolbar`). Como cada instância
  // deste componente só conhecia seu próprio `popoverRef`/`anchorRef`, um
  // clique dentro do popover "filho" (ex.: escolher uma cor) contava como
  // "fora" para a instância "pai" (o painel de "Ver Mais"), fechando-o e
  // desmontando o próprio popover filho no meio da interação. Todo popover
  // desta toolbar compartilha a classe `email-editor-toolbar-popover`
  // (única classe fixa; `className` só adiciona classes extras) — por
  // isso, um clique cujo alvo esteja dentro de QUALQUER popover da toolbar
  // (não só o deste componente) nunca conta como "fora": ou é este próprio
  // popover (já coberto acima), ou é um popover irmão/filho que deve
  // continuar tomando a decisão de fechar por conta própria.
  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      const alvo = e.target as Node;
      if (popoverRef.current?.contains(alvo)) return;
      if (anchorRef.current?.contains(alvo)) return;
      if (alvo instanceof Element && alvo.closest('.email-editor-toolbar-popover')) return;
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