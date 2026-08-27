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
   * Campos disponíveis para restaurar neste conflito. No modo individual,
   * são exatamente as chaves presentes em `backup_dados` do registro
   * clicado (`onAbrirConflitoRestaurarCampos`, Etapa 6, `EmailTable.tsx`).
   * No modo em massa, é a **união** dos campos alterados entre todos os
   * registros selecionados com algo em `backup_dados`
   * (`onAbrirConflitoRestaurarCamposEmMassa`).
   */
  campos: TCampoRestauravel[];
  /**
   * Quantos registros serão afetados por esta restauração — decide o texto
   * exibido (singular/plural) e serve como o próprio sinal de qual modo
   * está em uso: `1` é sempre o caminho individual (por linha), `2+` é
   * sempre o caminho em massa (seleção múltipla). Não muda o comportamento
   * dos checkboxes em si — a lista de `campos` já vem pronta de fora nos
   * dois casos.
   */
  quantidadeRegistros: number;
  onCancelar: () => void;
  /** Confirma a restauração dos campos marcados pelo usuário (sempre ao menos 1 — botão fica desabilitado sem seleção). */
  onConfirmar: (camposEscolhidos: TCampoRestauravel[]) => void;
}

/**
 * Modal de conflito de restauração de campos (`EdicaoIndividualdeRegistro.md`,
 * seção 5), com dois pontos de entrada:
 *
 * - **Individual** (Etapa 6/7): botão "Restaurar" de uma linha
 *   (`EmailTable.tsx`) quando o registro clicado tem 2+ campos em
 *   `backup_dados` — o caminho de 1 campo já resolve direto, sem abrir
 *   modal algum (`restaurarCampos`, Etapa 5, chamada diretamente pela
 *   tabela).
 * - **Em massa** (variante da seção 5): item "Restaurar campos" no
 *   dropdown de ações do cabeçalho, com 1+ registros selecionados tendo
 *   algo em `backup_dados` — `campos` chega como a união entre eles.
 *
 * Construído sobre `ConflictDialog` (mesmo casco de
 * `ConflitoExclusaoModal`/`DuplicadosConflitoModal`), com uma lista de
 * checkboxes — um por campo em `campos` — como o conteúdo "burro" da seção
 * 5 da especificação; o próprio componente não sabe (nem precisa saber)
 * quantos registros cada campo afeta de fato, ou se algum campo será um
 * no-op para um registro específico — isso é decidido por `restaurarCampos`
 * (Etapa 5), aplicado pelo lado de fora (`emails.tsx`) depois da
 * confirmação, um registro por vez (tabela de exemplo da seção 5: cada
 * campo escolhido só tem efeito nos registros que de fato o tinham
 * alterado).
 *
 * Todos os campos vêm pré-marcados ao abrir: restaurar tudo é o caminho
 * mais comum (equivalente ao antigo botão único por campo, anterior a esta
 * demanda); desmarcar é a exceção, não o padrão. O botão de confirmar fica
 * desabilitado quando nenhum campo está marcado — não faz sentido confirmar
 * uma restauração vazia.
 */
export function RestaurarCamposModal({
  campos,
  quantidadeRegistros,
  onCancelar,
  onConfirmar,
}: RestaurarCamposModalProps) {
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

  const emMassa = quantidadeRegistros > 1;
  const descricao = emMassa
    ? `Os ${quantidadeRegistros} registros selecionados têm campos alterados manualmente. Escolha quais restaurar — cada campo só afeta os registros que de fato o têm alterado; os demais não são afetados.`
    : 'Este registro tem mais de um campo alterado manualmente. Escolha quais deseja restaurar ao valor da planilha original.';

  return (
    <ConflictDialog
      title="Restaurar valores originais"
      description={descricao}
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
