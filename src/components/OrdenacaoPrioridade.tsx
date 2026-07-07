import { useEffect, useRef, useState } from 'react';

import { CRITERIO_ORDENACAO_LABELS, type TOrdenacao } from './utils/emailData';

interface Props {
  ordenacao: TOrdenacao;
  onOrdenacaoChange: (nova: TOrdenacao) => void;
}

/**
 * Controle de ordenação com aparência de `<select>`: um "gatilho" fechado
 * mostrando apenas o critério primário atual (ex.: "Status") que, ao ser
 * clicado, abre um painel-dropdown com a lista completa arrastável — o
 * rótulo "Ordenar por:" fica fora deste componente, ao lado, como um
 * `<label>` de select comum.
 *
 * A posição de cada item na lista é a sua prioridade — o primeiro (topo) é
 * aplicado primeiro; os seguintes só desempatam os registros que ficaram
 * empatados no(s) critério(s) anterior(es). Reordenação por arrastar-e-
 * soltar (HTML5 Drag and Drop nativo) ou pelos botões ▲/▼, sem depender de
 * bibliotecas externas.
 */
export function OrdenacaoPrioridade({ ordenacao, onOrdenacaoChange }: Props) {
  const [aberto, setAberto] = useState(false);
  const [indiceArrastado, setIndiceArrastado] = useState<number | null>(null);
  const [indiceSobrevoado, setIndiceSobrevoado] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;

    function aoClicarFora(evento: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(evento.target as Node)) {
        setAberto(false);
      }
    }

    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [aberto]);

  function mover(origem: number, destino: number) {
    if (origem === destino) return;
    const nova = [...ordenacao];
    const [criterio] = nova.splice(origem, 1);
    nova.splice(destino, 0, criterio);
    onOrdenacaoChange(nova);
  }

  function moverComBotao(index: number, direcao: -1 | 1) {
    const destino = index + direcao;
    if (destino < 0 || destino >= ordenacao.length) return;
    mover(index, destino);
  }

  function soltar(index: number) {
    if (indiceArrastado !== null) {
      mover(indiceArrastado, index);
    }
    setIndiceArrastado(null);
    setIndiceSobrevoado(null);
  }

  const principal = CRITERIO_ORDENACAO_LABELS[ordenacao[0]];

  return (
    <div className="ordenacao-select" ref={containerRef}>
      <button
        type="button"
        className="ordenacao-trigger"
        onClick={() => setAberto((atual) => !atual)}
        aria-haspopup="true"
        aria-expanded={aberto}
      >
        <span className="ordenacao-trigger-texto">{principal}</span>
        <span className={`ordenacao-trigger-seta ${aberto ? 'aberta' : ''}`} aria-hidden="true">
          ▾
        </span>
      </button>

      {aberto && (
        <div className="ordenacao-dropdown">
          <ol className="ordenacao-lista">
            {ordenacao.map((criterio, index) => (
              <li
                key={criterio}
                className={[
                  'ordenacao-item',
                  indiceArrastado === index ? 'arrastando' : '',
                  indiceSobrevoado === index && indiceArrastado !== null && indiceArrastado !== index
                    ? 'sobrevoado'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                draggable
                onDragStart={() => setIndiceArrastado(index)}
                onDragEnter={() => setIndiceSobrevoado(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  soltar(index);
                }}
                onDragEnd={() => {
                  setIndiceArrastado(null);
                  setIndiceSobrevoado(null);
                }}
              >
                <span className="ordenacao-alca" aria-hidden="true">
                  ⠿
                </span>
                <span className="ordenacao-label">{CRITERIO_ORDENACAO_LABELS[criterio]}</span>
                <span className="ordenacao-botoes">
                  <button
                    type="button"
                    aria-label={`Subir "${CRITERIO_ORDENACAO_LABELS[criterio]}" na prioridade`}
                    disabled={index === 0}
                    onClick={() => moverComBotao(index, -1)}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label={`Descer "${CRITERIO_ORDENACAO_LABELS[criterio]}" na prioridade`}
                    disabled={index === ordenacao.length - 1}
                    onClick={() => moverComBotao(index, 1)}
                  >
                    ▼
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
