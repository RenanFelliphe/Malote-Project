import { IconePaginaAnterior, IconePaginaProxima } from './Icons';
import type { PaginaInfo } from './utils/paginacao';
import { useEffect, useRef, useState } from 'react';

interface Props {
  paginacao: PaginaInfo;
  onPaginaChange: (pagina: number) => void;
}

/**
 * Controles de navegação entre páginas (anterior/1/atual/última/próxima +
 * atalho "buscar página"). Extraído da `EmailToolbar` para poder ser
 * posicionado junto ao contador de selecionados, entre a toolbar e a
 * tabela (ver `pages/emails.tsx`).
 */
export function Paginacao({ paginacao, onPaginaChange }: Props) {
  const [valor, setValor] = useState(String(paginacao.paginaAtual));

  const inputRef = useRef<HTMLInputElement>(null);
  const confirmandoRef = useRef(false);

  useEffect(() => {
    setValor(String(paginacao.paginaAtual));
  }, [paginacao.paginaAtual]);

  function confirmarPagina() {
    confirmandoRef.current = true;

    let numero = Number.parseInt(valor, 10);

    if (Number.isNaN(numero)) {
      setValor(String(paginacao.paginaAtual));
      return;
    }

    numero = Math.max(1, Math.min(numero, paginacao.totalPaginas));

    onPaginaChange(numero);
    setValor(String(numero));
  }

  if (paginacao.totalPaginas <= 0) {
    return null;
  }

  const larguraInput = `${Math.max(2, String(paginacao.totalPaginas).length) + 1.5}ch`;
  const exibirBotaoUltima = paginacao.totalPaginas > 1;

  return (
    <div className="paginacao" aria-label="Navegação entre páginas">
      <button
        type="button"
        className="paginacao-btn"
        onClick={() => onPaginaChange(Math.max(1, paginacao.paginaAtual - 1))}
        disabled={paginacao.paginaAtual <= 1}
        aria-label="Página anterior"
      >
        <IconePaginaAnterior />
      </button>
      <button
        type="button"
        className={`paginacao-btn${paginacao.paginaAtual === 1 ? ' ativo' : ''}`}
        onClick={() => onPaginaChange(1)}
        disabled={paginacao.paginaAtual === 1}
      >
        1
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        ref={inputRef}
        className="paginacao-atual"
        style={{ width: larguraInput }}
        value={valor}
        onChange={(e) => setValor(e.target.value.replace(/\D/g, ''))}
        onFocus={(e) => e.target.select()}
        onWheel={(e) => e.currentTarget.blur()}
        onBlur={() => {
          if (!confirmandoRef.current) confirmarPagina();
          confirmandoRef.current = false;
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            confirmarPagina();
            inputRef.current?.blur();
          }
          if (e.key === 'Escape') {
            confirmandoRef.current = true;
            setValor(String(paginacao.paginaAtual));
            inputRef.current?.blur();
          }
        }}
        aria-label="Página atual"
      />
      {exibirBotaoUltima && (
        <button
          type="button"
          className={`paginacao-btn${paginacao.paginaAtual === paginacao.totalPaginas ? ' ativo' : ''}`}
          onClick={() => onPaginaChange(paginacao.totalPaginas)}
          disabled={paginacao.paginaAtual === paginacao.totalPaginas}
        >
          {paginacao.totalPaginas}
        </button>
      )}
      <button
        type="button"
        className="paginacao-btn"
        onClick={() => onPaginaChange(Math.min(paginacao.totalPaginas, paginacao.paginaAtual + 1))}
        disabled={paginacao.paginaAtual >= paginacao.totalPaginas}
        aria-label="Próxima página"
      >
        <IconePaginaProxima />
      </button>
    </div>
  );
}