import type { ReactNode } from 'react';

import { FiCheck } from 'react-icons/fi';

interface Props {
  /** Estado marcado/desmarcado, controlado por quem usa o componente. */
  checked: boolean;
  /** Disparado ao alternar o estado (clique na label, na caixa ou tecla no input). */
  onChange: () => void;
  /** Desabilita interação e aplica o estilo esmaecido correspondente. */
  disabled?: boolean;
  /** Conteúdo exibido ao lado da caixa (texto simples ou markup mais elaborado, como nome/e-mail empilhados). */
  children?: ReactNode;
  /** Classes extras aplicadas à `<label>` externa, para reaproveitar layout já existente (ex.: `.modal-selecionar-todos`). */
  className?: string;
  id?: string;
}

/**
 * Checkbox customizado reutilizável (Etapa 3 da refatoração de modais).
 *
 * Substitui os `<input type="checkbox">` nativos (estilizados apenas via
 * `accent-color`) nas listas de seleção múltipla dos modais de conflito,
 * unificando a linguagem visual com os cartões já customizados do
 * `ExportarModal` (`.formato-card`).
 *
 * Acessibilidade: o `<input type="checkbox">` nativo continua no DOM e
 * recebe todo o comportamento de teclado/leitor de tela (foco, tab, barra
 * de espaço, `checked`/`disabled`), apenas oculto visualmente via
 * `.checkbox-customizado-input` (clip, não `display: none`). A caixa
 * customizada (`.checkbox-customizado-caixa`) é puramente decorativa
 * (`aria-hidden`) e reage ao estado do input real através de CSS
 * (`:checked ~ .checkbox-customizado-caixa`, `:focus-visible ~ ...`).
 */
export function CheckboxCustomizado({ checked, onChange, disabled, children, className, id }: Props) {
  const classes = ['checkbox-customizado'];
  if (disabled) classes.push('desabilitado');
  if (className) classes.push(className);

  return (
    <label className={classes.join(' ')}>
      <input
        type="checkbox"
        id={id}
        className="checkbox-customizado-input"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span className="checkbox-customizado-caixa" aria-hidden="true">
        {checked && <FiCheck size={11} strokeWidth={3} />}
      </span>
      {children != null && <span className="checkbox-customizado-conteudo">{children}</span>}
    </label>
  );
}
