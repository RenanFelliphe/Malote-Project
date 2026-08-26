import { useState } from 'react';

import { ConflictDialog } from './ConflictDialog';
import type { TCampoRestauravel } from './utils/restaurarCampos';

/** Rótulo de exibição de cada campo restaurável (seções 3 e 5 do planner). */
const RESTAURAR_CAMPOS_LABELS: Record<TCampoRestauravel, string> = {
  nome: 'Nome',
  email: 'E-mail',
  status: 'Status',
};

interface RestaurarCamposModalProps {
  /**
   * Campos disponíveis para restaurar neste conflito. No modo individual
   * (único consumidor implementado nesta etapa — ver nota abaixo), são
   * exatamente as chaves presentes em `backup_dados` do registro clicado
   * (`onAbrirConflitoRestaurarCampos`, Etapa 6, `EmailTable.tsx`).
   */
  campos: TCampoRestauravel[];
  onCancelar: () => void;
  /** Confirma a restauração dos campos marcados pelo usuário (sempre ao menos 1 — botão fica desabilitado sem seleção). */
  onConfirmar: (camposEscolhidos: TCampoRestauravel[]) => void;
}

/**
 * Modal de conflito de restauração de campos (Etapa 7,
 * `EdicaoIndividualdeRegistro.md`, seção 5): aberto pelo botão "Restaurar"
 * de uma linha (`EmailTable.tsx`, Etapa 6) quando o registro clicado tem 2
 * ou mais campos em `backup_dados` — o caminho de 1 campo já resolve
 * direto, sem abrir modal algum (`restaurarCampos`, Etapa 5, chamada
 * diretamente pela tabela). Construído sobre `ConflictDialog` (mesmo casco
 * de `ConflitoExclusaoModal`/`DuplicadosConflitoModal`), com uma lista de
 * checkboxes — um por campo em `campos` — como o conteúdo "burro" da seção
 * 5 da especificação. A restauração de fato (aplicar `restaurarCampos` aos
 * campos escolhidos e persistir) é responsabilidade de quem consome
 * `onConfirmar` (`emails.tsx`), não deste componente — que só coleta a
 * escolha do usuário.
 *
 * **Cobre apenas o modo individual** (um único registro por vez, seção 5).
 * A variante "em massa" (união dos campos entre vários registros
 * selecionados, com no-op silencioso por registro/campo onde não se
 * aplica — tabela de exemplo da seção 5) foi deliberadamente **adiada**,
 * conforme a decisão já registrada na própria seção 5 do planner ("fora do
 * escopo mínimo de aprovação da demanda... pode ser feita na mesma leva se
 * o tempo permitir; se adiada, deixar registrada como pendência ao final
 * da Etapa 7, não como nova demanda"). Fica registrada aqui como pendência
 * explícita: não há, nesta implementação, nenhum ponto de entrada para
 * disparar a restauração em massa (nenhum botão na seleção múltipla chama
 * este modal) — só o fluxo individual por linha.
 *
 * Todos os campos vêm pré-marcados ao abrir: restaurar tudo é o caminho
 * mais comum (equivalente ao antigo botão único por campo, anterior a esta
 * demanda); desmarcar é a exceção, não o padrão. O botão de confirmar fica
 * desabilitado quando nenhum campo está marcado — não faz sentido confirmar
 * uma restauração vazia.
 */
export function RestaurarCamposModal({ campos, onCancelar, onConfirmar }: RestaurarCamposModalProps) {
  const [escolhidos, setEscolhidos] = useState<Set<TCampoRestauravel>>(() => new Set(campos));

  function alternarCampo(campo: TCampoRestauravel) {
    setEscolhidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(campo)) {
        novo.delete(campo);
      } else {
        novo.add(campo);
      }
      return novo;
    });
  }

  return (
    <ConflictDialog
      title="Restaurar valores originais"
      description="Este registro tem mais de um campo alterado manualmente. Escolha quais deseja restaurar ao valor da planilha original."
      onCancel={onCancelar}
      onConfirm={() => onConfirmar([...escolhidos])}
      confirmLabel="Restaurar"
      confirmDisabled={escolhidos.size === 0}
      disabledHint="Selecione ao menos um campo para restaurar."
    >
      <ul className="restaurar-campos-lista">
        {campos.map((campo) => (
          <li key={campo}>
            <label className="restaurar-campos-item">
              <input type="checkbox" checked={escolhidos.has(campo)} onChange={() => alternarCampo(campo)} />
              {RESTAURAR_CAMPOS_LABELS[campo]}
            </label>
          </li>
        ))}
      </ul>
    </ConflictDialog>
  );
}
