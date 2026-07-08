import { IconeBuscarPagina, IconePaginaAnterior, IconePaginaProxima } from './Icons';
import type { PaginaInfo } from './utils/paginacao';

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
      <button type="button" className="paginacao-btn" onClick={() => onPaginaChange(1)}>
        1
      </button>
      <span className="paginacao-atual">{paginacao.paginaAtual}</span>
      <button type="button" className="paginacao-btn" onClick={() => onPaginaChange(paginacao.totalPaginas)}>
        {paginacao.totalPaginas}
      </button>
      <button
        type="button"
        className="paginacao-btn"
        onClick={() => onPaginaChange(Math.min(paginacao.totalPaginas, paginacao.paginaAtual + 1))}
        disabled={paginacao.paginaAtual >= paginacao.totalPaginas}
        aria-label="Próxima página"
      >
        <IconePaginaProxima />
      </button>
      <button
        type="button"
        className="paginacao-btn"
        aria-label="Buscar página"
        onClick={() => {
          const valor = window.prompt('Digite o número da página desejada');
          const numero = Number.parseInt(valor ?? '', 10);
          if (Number.isFinite(numero) && numero >= 1 && numero <= paginacao.totalPaginas) {
            onPaginaChange(numero);
          }
        }}
      >
        <IconeBuscarPagina />
      </button>
    </div>
  );
}