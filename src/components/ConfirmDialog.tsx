import type { ReactNode } from 'react';

import { IconeAlerta } from './Icons';
import { Dialog } from './Dialog';

interface Props {
  /** Rótulo acessível do dialog (usado como `aria-label`, já que ele não tem header). */
  ariaLabel: string;
  /** Título curto exibido junto ao ícone de alerta (ex.: "Deseja cancelar a importação?"). */
  titulo: ReactNode;
  /** Texto de apoio abaixo do título, explicando a consequência da ação. */
  descricao: ReactNode;
  /** Rótulo do botão que mantém o estado atual (ex.: "Continuar editando"). */
  rotuloCancelar: string;
  /** Rótulo do botão que confirma a ação destrutiva (ex.: "Cancelar importação"). */
  rotuloConfirmar: string;
  onCancelar: () => void;
  onConfirmar: () => void;
}

/**
 * Dialog de confirmação genérico (ícone de alerta + título + descrição +
 * par de botões cancelar/confirmar), extraído do padrão "Deseja cancelar a
 * importação?" originalmente implementado só dentro do `ImportWizardModal`.
 *
 * Reaproveita as mesmas classes de estilo já existentes para essa variante
 * (`modal-overlay-confirmacao`, `modal-confirmacao-cancelamento`,
 * `confirmacao-cancelamento-icone`), que já eram genéricas o suficiente
 * para não precisar de nenhum CSS novo.
 *
 * Pensado para ser renderizado como um `Dialog` aninhado (`role="alertdialog"`,
 * sem header próprio) por qualquer modal que precise confirmar uma ação
 * interruptiva — por ora o fechamento com alterações não salvas do
 * `EmailConteudoModal` (Etapa 6); o `ImportWizardModal` continua com sua
 * própria implementação equivalente por enquanto.
 */
export function ConfirmDialog({
  ariaLabel,
  titulo,
  descricao,
  rotuloCancelar,
  rotuloConfirmar,
  onCancelar,
  onConfirmar,
}: Props) {
  return (
    <Dialog
      isOpen
      onClose={onCancelar}
      role="alertdialog"
      showCloseButton={false}
      ariaLabel={ariaLabel}
      overlayClassName="modal-overlay-confirmacao"
      className="modal-confirmacao-cancelamento"
      footerClassName="dialog-rodape-centralizado"
      footer={
        <>
          <button type="button" className="dialog-botao-cancelar" onClick={onCancelar}>
            {rotuloCancelar}
          </button>
          <button type="button" className="dialog-botao-deletar" onClick={onConfirmar}>
            {rotuloConfirmar}
          </button>
        </>
      }
    >
      <div className="confirmacao-cancelamento-icone">
        <IconeAlerta />
      </div>
      <h2>{titulo}</h2>
      <p>{descricao}</p>
    </Dialog>
  );
}
