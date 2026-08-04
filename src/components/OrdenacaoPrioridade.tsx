import { useEffect, useRef, useState } from 'react';

/**
 * Componente genérico o suficiente para ordenar qualquer lista por uma
 * hierarquia de critérios — usado tanto na tabela de e-mails (critérios
 * `TCriterioOrdenacao` de `components/utils/emailData.ts`) quanto na Home
 * (critérios `TCriterioOrdenacaoHome` de `pages/utils/homeOrdenacao.ts`,
 * Etapa 7 do plano de refatoração multi-página). Os rótulos de cada
 * critério deixam de vir de um import fixo e passam a ser recebidos via
 * prop (`labels`), o que permite reaproveitar o mesmo componente com um
 * `Record` de labels diferente em vez de duplicar código (ver seção 3.5 /
 * Etapa 7 do plano).
 */
interface Props<T extends string> {
  ordenacao: T[];
  labels: Record<T, string>;
  onOrdenacaoChange: (nova: T[]) => void;
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
 *
 * Nota: o drag-and-drop nativo (HTML5) não tem suporte em telas touch por
 * padrão — nesses ambientes os botões ▲/▼ são o fallback universal para
 * reordenar.
 */
export function OrdenacaoPrioridade<T extends string>({ ordenacao, labels, onOrdenacaoChange }: Props<T>) {
  const [aberto, setAberto] = useState(false);
  const [indiceArrastado, setIndiceArrastado] = useState<number | null>(null);
  const [indiceSobrevoado, setIndiceSobrevoado] = useState<number | null>(null);
  const [indiceDraggableAtivo, setIndiceDraggableAtivo] = useState<number | null>(null);
  const [anuncio, setAnuncio] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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

  // Escape fecha o dropdown e devolve o foco ao botão gatilho.
  useEffect(() => {
    if (!aberto) return;

    function aoPressionarTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        setAberto(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('keydown', aoPressionarTecla);
    return () => document.removeEventListener('keydown', aoPressionarTecla);
  }, [aberto]);

  function mover(origem: number, destino: number) {
    if (origem === destino) return;
    const nova = [...ordenacao];
    const [criterio] = nova.splice(origem, 1);
    nova.splice(destino, 0, criterio);
    onOrdenacaoChange(nova);
    setAnuncio(`${labels[criterio]} agora é o critério ${destino === 0 ? 'principal' : `de prioridade ${destino + 1}`} de ordenação.`);
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
    setIndiceDraggableAtivo(null);
  }

  const principal = ordenacao.length > 0 ? labels[ordenacao[0]] : 'Selecionar critério';

  return (
    <div className="ordenacao-select" ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        className="ordenacao-trigger"
        onClick={() => setAberto((atual) => !atual)}
        aria-haspopup="menu"
        aria-expanded={aberto}
      >
        <span className="ordenacao-trigger-texto">{principal}</span>
        <span className={`ordenacao-trigger-seta ${aberto ? 'aberta' : ''}`} aria-hidden="true">
          ▾
        </span>
      </button>

      {aberto && (
        <div className="ordenacao-dropdown">
          <ol className="ordenacao-lista" role="menu">
            {ordenacao.map((criterio, index) => (
              <li
                key={criterio}
                role="menuitem"
                className={[
                  'ordenacao-item',
                  indiceArrastado === index ? 'arrastando' : '',
                  indiceSobrevoado === index && indiceArrastado !== null && indiceArrastado !== index
                    ? 'sobrevoado'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                draggable={indiceDraggableAtivo === index}
                onMouseUp={() => setIndiceDraggableAtivo(null)}
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
                  setIndiceDraggableAtivo(null);
                }}
              >
                <span
                  className="ordenacao-alca"
                  aria-hidden="true"
                  onMouseDown={() => setIndiceDraggableAtivo(index)}
                >
                  ⠿
                </span>
                <span className="ordenacao-label">{labels[criterio]}</span>
                <span className="ordenacao-botoes">
                  <button
                    type="button"
                    aria-label={`Subir "${labels[criterio]}" na prioridade`}
                    disabled={index === 0}
                    onClick={() => moverComBotao(index, -1)}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label={`Descer "${labels[criterio]}" na prioridade`}
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

      <span className="sr-only" role="status" aria-live="polite">
        {anuncio}
      </span>
    </div>
  );
}