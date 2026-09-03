import type { RegistroSumido } from '../../scripts/utils/calcularMerge';

export type DecisaoSumido = 'ignorar' | 'marcar-deletado';

interface Props {
  registros: RegistroSumido[];
  decisoes: Record<number, DecisaoSumido>;
  onDecisaoChange: (id: number, decisao: DecisaoSumido) => void;
}

/**
 * Seção "Registro sumido da planilha" — item 6 da taxonomia de conflitos
 * (seção 4 de AtualizacaoDaPlanilhaViaUI.md), única entre as quatro seções
 * navegáveis que **não** usa o componente de merge theirs/ours
 * (`MergeCampoConflito`, Etapa 6): um `id` que sumiu da planilha nova não
 * tem um "theirs" de nome/e-mail para comparar, só a decisão de ignorar
 * (manter como está) ou marcar o registro como deletado.
 *
 * Ajuste de rota (Etapa 6): este arquivo fazia parte dos "Arquivos
 * Criados" desde a Etapa 0, e o cabeçalho de `AtualizarRegistrosModal.tsx`
 * (Etapa 5) já descrevia esta seção como usando "o componente definitivo,
 * desta etapa" — mas o arquivo chegou vazio na última entrega. Implementado
 * agora, sem mudar a assinatura já assumida pelo import em
 * `AtualizarRegistrosModal.tsx` (`RegistrosSumidosSection`/`DecisaoSumido`).
 */
export function RegistrosSumidosSection({ registros, decisoes, onDecisaoChange }: Props) {
  return (
    <div className="etapa-atualizar secao-conflito">
      <p className="etapa-atualizar-instrucao">
        Estes registros existiam na planilha anterior, mas não aparecem mais na planilha nova. Escolha se cada um
        deve ser ignorado (permanece como está) ou marcado como deletado.
      </p>

      <ul className="lista-sumidos">
        {registros.map((registro) => (
          <li key={registro.id} className="lista-sumidos-item">
            <p className="lista-sumidos-titulo">
              {registro.nome || '(sem nome)'} — {registro.email || '(sem e-mail)'}
              <span className="lista-conflitos-campos">
                {' '}
                (id {registro.id}, status atual: {registro.status})
              </span>
            </p>

            <div
              className="conflito-opcoes"
              role="radiogroup"
              aria-label={`Decisão para o registro sumido de id ${registro.id}`}
            >
              <button
                type="button"
                className={`opcao-decisao ${decisoes[registro.id] === 'ignorar' ? 'selecionada' : ''}`}
                onClick={() => onDecisaoChange(registro.id, 'ignorar')}
                aria-pressed={decisoes[registro.id] === 'ignorar'}
              >
                Ignorar (manter como está)
              </button>
              <button
                type="button"
                className={`opcao-decisao ${decisoes[registro.id] === 'marcar-deletado' ? 'selecionada' : ''}`}
                onClick={() => onDecisaoChange(registro.id, 'marcar-deletado')}
                aria-pressed={decisoes[registro.id] === 'marcar-deletado'}
              >
                Marcar como deletado
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
