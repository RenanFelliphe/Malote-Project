import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';

/**
 * Estratégia de "Ver Mais" por largura (RefatoracaoToolbarEmail.md — Etapa
 * 2), extraída da implementação original de `EmailEditorToolbar` para ser
 * reaproveitada por qualquer faixa de botões — a barra principal do editor
 * e, desde `RefatoracaoTabelaToolbar.md`, também a barra contextual de
 * tabela. Nenhuma mudança de comportamento em relação ao original: mesmo
 * algoritmo de medição (uma vez, via `requestAnimationFrame`) e mesma
 * decisão de ocultação (percorre `ordemOcultacao` até a faixa caber na
 * largura observada por `ResizeObserver`).
 *
 * `ativo` existe só para faixas que podem sair do DOM inteiramente (a barra
 * contextual de tabela só existe com o cursor dentro de uma tabela) — a
 * barra principal nunca desmonta, então sempre passa `ativo: true` e o
 * parâmetro não muda nada para ela. Quando a faixa desmonta e remonta
 * depois, `containerRef.current`/os refs de cada item ficam `null`
 * enquanto ela não existe; sem depender de `ativo` nos efeitos abaixo, o
 * `ResizeObserver`/a medição inicial rodariam uma única vez (no primeiro
 * mount do componente pai) e nunca tentariam de novo quando a faixa
 * reaparecesse com nós DOM novos.
 */
export function useToolbarOverflow<T extends string>({
  itemIds,
  ordemOcultacao,
  quantidadeClusters,
  refs,
  containerRef,
  larguraSeparadorPx,
  ativo = true,
}: {
  itemIds: readonly T[];
  /** Ordem de ocultação, do primeiro item a esconder até o último. */
  ordemOcultacao: readonly T[];
  /** Número de clusters visuais (separadores decorativos) da faixa — só
   * usado para orçar a largura ocupada por separadores no cálculo. */
  quantidadeClusters: number;
  refs: Record<T, RefObject<HTMLElement | null>>;
  containerRef: RefObject<HTMLElement | null>;
  larguraSeparadorPx: number;
  /** Falso enquanto a faixa não existe no DOM — ver JSDoc acima. */
  ativo?: boolean;
}) {
  const [larguraDisponivel, setLarguraDisponivel] = useState<number | null>(null);
  const [larguraGapPx, setLarguraGapPx] = useState(0);
  const [larguras, setLarguras] = useState<Partial<Record<T, number>>>({});
  const medicaoFeitaRef = useRef(false);

  // Observa a largura de conteúdo disponível para os botões + separadores +
  // gatilho de "Ver Mais". Depende de `ativo` para se reconectar a um nó DOM
  // novo se a faixa desmontar e remontar (ver JSDoc acima).
  useEffect(() => {
    if (!ativo) return;
    const elemento = containerRef.current;
    if (!elemento) return;

    const observer = new ResizeObserver((entradas) => {
      const largura = entradas[0]?.contentRect.width;
      if (largura !== undefined) setLarguraDisponivel(largura);
    });
    observer.observe(elemento);
    return () => observer.disconnect();
  }, [ativo, containerRef]);

  // Lê o `gap` de fato aplicado pelo CSS uma única vez por (re)montagem.
  useLayoutEffect(() => {
    if (!ativo) return;
    const elemento = containerRef.current;
    if (!elemento) return;
    const estilo = getComputedStyle(elemento);
    const gap = parseFloat(estilo.columnGap || estilo.gap || '0');
    setLarguraGapPx(Number.isNaN(gap) ? 0 : gap);
  }, [ativo, containerRef]);

  // Mede a largura natural de cada item uma única vez, na primeira vez em
  // que todos aparecem visíveis (antes de qualquer ocultação ter sido
  // decidida).
  useLayoutEffect(() => {
    if (!ativo || medicaoFeitaRef.current) return;

    const frame = requestAnimationFrame(() => {
      if (medicaoFeitaRef.current) return;

      const novo: Partial<Record<T, number>> = {};
      for (const id of itemIds) {
        const elemento = refs[id].current;
        if (!elemento) return; // ainda não montaram todos; tenta de novo no próximo commit
        novo[id] = elemento.getBoundingClientRect().width;
      }
      medicaoFeitaRef.current = true;
      setLarguras(novo);
    });

    return () => cancelAnimationFrame(frame);
  }, [ativo, itemIds, refs]);

  const larguraMedida = itemIds.every((id) => larguras[id] !== undefined);

  const ocultos = useMemo(() => {
    const resultado = new Set<T>();
    if (!larguraMedida || larguraDisponivel === null) return resultado;

    // Todo botão-gatilho usa a mesma classe de botão simples da faixa, então
    // o gatilho de "Ver Mais" tem aproximadamente a mesma largura de
    // qualquer item já medido — usa o primeiro como representativo.
    const larguraGatilhoVerMais = larguras[itemIds[0]] as number;

    function larguraTotalAtual(candidato: Set<T>): number {
      const visiveis = itemIds.filter((id) => !candidato.has(id));

      let total = visiveis.reduce((soma, id) => soma + (larguras[id] as number), 0);
      total += Math.max(0, quantidadeClusters - 1) * larguraSeparadorPx;

      let quantidadeFilhos = visiveis.length + Math.max(0, quantidadeClusters - 1);
      if (candidato.size > 0) {
        total += larguraGatilhoVerMais;
        quantidadeFilhos += 1;
      }
      total += Math.max(0, quantidadeFilhos - 1) * larguraGapPx;

      return total;
    }

    for (const id of ordemOcultacao) {
      if (larguraTotalAtual(resultado) <= larguraDisponivel) break;
      resultado.add(id);
    }

    return resultado;
  }, [larguraMedida, larguraDisponivel, larguras, larguraGapPx, itemIds, ordemOcultacao, quantidadeClusters, larguraSeparadorPx]);

  return { ocultos };
}
