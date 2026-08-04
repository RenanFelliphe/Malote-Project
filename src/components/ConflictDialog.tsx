import type { ReactNode } from 'react';

import { Dialog } from './Dialog';
import { IconeAlerta } from './Icons';

interface ConflictDialogProps {
  /** Título do conflito, exibido no header do Dialog. */
  title: string;
  /** Texto de apoio exibido logo abaixo do header, explicando o conflito. */
  description?: ReactNode;
  /**
   * Conteúdo "burro" do conflito (ex.: `DeleteConflictContent`,
   * `StatusUpdateConflict`) — recebe apenas dados/callbacks e não sabe nada
   * sobre modal/overlay/dialog. O `ConflictDialog` só decide o que envolve
   * esse conteúdo.
   */
  children: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  /** Rótulo do botão de cancelar. Padrão: "Cancelar". */
  cancelLabel?: string;
  /** Rótulo do botão de confirmar. Padrão: "Confirmar". */
  confirmLabel?: string;
  /** Desabilita o botão de confirmar (ex.: nenhum item selecionado). */
  confirmDisabled?: boolean;
  /**
   * Estilo do botão de confirmar. "danger" para ações destrutivas
   * (ex.: exclusão), "primary" para as demais. Padrão: "primary".
   */
  confirmVariant?: 'primary' | 'danger';
  /** Classes extras para o container do Dialog (ex.: variantes de largura). */
  className?: string;
  /**
   * Explicação contextual de por que o botão de confirmar está desabilitado
   * (ex.: "É necessário manter pelo menos um registro ativo neste grupo.").
   * Só é exibida quando `confirmDisabled` é `true` — enquanto a seleção for
   * válida, nenhuma mensagem aparece. Mantém o `ConflictDialog` genérico:
   * cada consumidor decide se e qual mensagem faz sentido para sua própria
   * regra de desabilitação.
   */
  disabledHint?: ReactNode;
}

/**
 * Template único para modais de resolução de conflito real (seção 7 —
 * exclusão de registros enviados, duplicados, atualização de status, etc.).
 * Construído sobre o `Dialog` (etapa 1): fornece título, descrição e uma
 * área de ações padronizada (cancelar/confirmar), deixando o conteúdo
 * específico de cada conflito a cargo de um componente filho "burro"
 * passado via `children` (ex.: `DeleteConflictContent`).
 *
 * Reservado apenas para conflitos reais — modais genéricos (exportar,
 * importar) seguem usando o `Dialog` diretamente, sem a área de ações
 * padronizada daqui. Duplicados também é um consumidor deste template
 * (`DuplicadosConflitoModal`): deixou de ser só leitura ao ganhar a opção
 * de deletar registros do grupo até sobrar 1, o que o torna um conflito
 * real como os demais.
 *
 * Uso:
 * ```tsx
 * <ConflictDialog
 *   title="Não é possível deletar registros enviados"
 *   description="Escolha como deseja prosseguir."
 *   onCancel={cancelar}
 *   onConfirm={confirmar}
 *   confirmVariant="danger"
 *   confirmLabel="Deletar"
 *   confirmDisabled={selecionados.size === 0}
 * >
 *   <DeleteConflictContent ... />
 * </ConflictDialog>
 * ```
 */
export function ConflictDialog({
  title,
  description,
  children,
  onCancel,
  onConfirm,
  cancelLabel = 'Cancelar',
  confirmLabel = 'Confirmar',
  confirmDisabled = false,
  confirmVariant = 'primary',
  className,
  disabledHint,
}: ConflictDialogProps) {
  const mostrarAviso = confirmDisabled && Boolean(disabledHint);

  return (
    <Dialog
      isOpen
      onClose={onCancel}
      title={title}
      role="alertdialog"
      className={`dialog-rolavel ${className ?? ''}`.trim()}
      footerClassName={mostrarAviso ? 'dialog-rodape-com-aviso' : undefined}
      footer={
        <>
          {mostrarAviso && (
            <p className="conflict-dialog-aviso" role="status">
              <IconeAlerta />
              <span>{disabledHint}</span>
            </p>
          )}
          <div className="dialog-rodape-botoes">
            <button type="button" className="dialog-botao-cancelar" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button
              type="button"
              className={confirmVariant === 'danger' ? 'dialog-botao-deletar' : 'dialog-botao-primario'}
              onClick={onConfirm}
              disabled={confirmDisabled}
            >
              {confirmLabel}
            </button>
          </div>
        </>
      }
    >
      {description && <p className="conflict-dialog-descricao">{description}</p>}
      {children}
    </Dialog>
  );
}
