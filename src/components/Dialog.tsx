import { useEffect, useId, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';

import { IconeFechar } from './Icons';

interface DialogProps {
  /** Controla se o dialog está montado/visível. */
  isOpen: boolean;
  /** Chamado ao fechar via ESC, clique no overlay ou botão de fechar. */
  onClose: () => void;
  /**
   * Conteúdo do corpo do dialog. Renderizado como filhos diretos do
   * container (junto de header/rodapé), preservando o espaçamento em
   * flex-column já usado pelos modais atuais — o Dialog não sabe nada sobre
   * o que há dentro.
   */
  children: ReactNode;
  /** Título exibido no header. Quando omitido, nenhum header é renderizado
   * a menos que `showCloseButton` seja true. */
  title?: ReactNode;
  /** Conteúdo do rodapé (ex.: botões de ação). Omitido = sem rodapé. */
  footer?: ReactNode;
  /** `alertdialog` para confirmações destrutivas/interruptivas. */
  role?: 'dialog' | 'alertdialog';
  /** Rótulo acessível para dialogs sem título visível. */
  ariaLabel?: string;
  /** Exibe o botão "X" no header. Padrão: true. */
  showCloseButton?: boolean;
  /** Fecha ao pressionar ESC. Padrão: true. */
  closeOnEsc?: boolean;
  /** Fecha ao clicar no overlay (fora do container). Padrão: true. */
  closeOnOverlayClick?: boolean;
  /** Classes extras para o container (ex.: variantes de largura). */
  className?: string;
  /** Classes extras para o overlay. */
  overlayClassName?: string;
  /** Classes extras para o rodapé (ex.: variante centralizada). */
  footerClassName?: string;
  /** Elemento a receber foco ao abrir; padrão é o próprio container. */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Componente base, composable e sem lógica de negócio para todos os modais
 * do sistema. Concentra o padrão antes repetido em cada modal: overlay,
 * container, header (título + botão fechar), rodapé, fechamento por
 * ESC/clique fora, trava de scroll do body, foco inicial + devolução de
 * foco ao fechar, trava de foco (Tab/Shift+Tab) dentro do dialog e
 * renderização via portal.
 *
 * Quem decide o que aparece dentro (`children`) e as ações do rodapé
 * (`footer`) é sempre o componente consumidor — o Dialog só fornece o
 * "casco".
 */
export function Dialog({
  isOpen,
  onClose,
  children,
  title,
  footer,
  role = 'dialog',
  ariaLabel,
  showCloseButton = true,
  closeOnEsc = true,
  closeOnOverlayClick = true,
  className = '',
  overlayClassName = '',
  footerClassName = '',
  initialFocusRef,
}: DialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const focoAnteriorRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Fechamento via ESC.
  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEsc, onClose]);

  // Trava de scroll do body enquanto o dialog estiver aberto.
  useEffect(() => {
    if (!isOpen) return;

    const overflowOriginal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflowOriginal;
    };
  }, [isOpen]);

  // Foco inicial ao abrir + devolução de foco ao elemento anterior ao fechar.
  useEffect(() => {
    if (!isOpen) return;

    focoAnteriorRef.current = document.activeElement as HTMLElement | null;
    const alvo = initialFocusRef?.current ?? containerRef.current;
    alvo?.focus();

    return () => {
      focoAnteriorRef.current?.focus?.();
    };
  }, [isOpen, initialFocusRef]);

  // Trava o foco (Tab/Shift+Tab) dentro do dialog (etapa 8 — QA e
  // acessibilidade). Ignora o evento se o foco atual não está dentro deste
  // container: isso deixa o dialog aninhado mais recente (ex.: confirmação
  // de cancelamento em cima do wizard de importação) tratar o Tab, já que é
  // ele quem detém o foco no momento.
  useEffect(() => {
    if (!isOpen) return;

    function handleTabKey(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;

      const container = containerRef.current;
      if (!container || !container.contains(document.activeElement)) return;

      const focaveis = container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focaveis.length === 0) {
        e.preventDefault();
        return;
      }

      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];

      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    }

    window.addEventListener('keydown', handleTabKey);
    return () => window.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);

  if (!isOpen) return null;

  function handleOverlayClick() {
    if (closeOnOverlayClick) onClose();
  }

  const temHeader = Boolean(title) || showCloseButton;

  return createPortal(
    <div className={`dialog-overlay ${overlayClassName}`.trim()} onClick={handleOverlayClick}>
      <div
        ref={containerRef}
        className={`dialog-content ${className}`.trim()}
        onClick={(e) => e.stopPropagation()}
        role={role}
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? ariaLabel : undefined}
        tabIndex={-1}
      >
        {temHeader && (
          <div className="dialog-header">
            {title ? <h2 id={titleId}>{title}</h2> : <span />}
            {showCloseButton && (
              <button type="button" className="dialog-fechar" onClick={onClose} aria-label="Fechar">
                <IconeFechar />
              </button>
            )}
          </div>
        )}

        {children}

        {footer && <div className={`dialog-rodape ${footerClassName}`.trim()}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
