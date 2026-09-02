import { useEffect, useState } from 'react';

import { CRITERIO_ORDENACAO_LABELS, type TOrdenacao } from './utils/emailData';
import { OrdenacaoPrioridade } from './OrdenacaoPrioridade';
import { QuantidadeInput } from './QuantidadeInput';

interface Props {
  termoBusca: string;
  onTermoBuscaChange: (termo: string) => void;
  quantidade: number;
  onQuantidadeChange: (quantidade: number) => void;
  /** Maior valor aceito no input de quantidade (total de registros após filtro/busca). */
  quantidadeMax: number;
  ordenacao: TOrdenacao;
  onOrdenacaoChange: (ordenacao: TOrdenacao) => void;
}

/** Atraso do debounce da busca (ms) — evita reprocessar a cada tecla digitada. */
const ATRASO_DEBOUNCE_BUSCA = 250;

/**
 * Toolbar em duas linhas (melhoria de estilização):
 *
 * Linha 1 — busca (nome + e-mail).
 * Linha 2 — ordenação e quantidade de registros exibidos. As ações de
 * seleção (alterar status, deletar/restaurar, contador) saíram daqui na
 * Etapa 5 e agora vivem distribuídas na própria tabela (`EmailTable`) e no
 * contador fixo entre a toolbar e a tabela (`Emails`, em `pages/emails.tsx`).
 * A paginação também vive nessa mesma linha fixa, ao lado do contador
 * (ver `Paginacao`, renderizado por `pages/emails.tsx`).
 *
 * Os filtros por status saíram daqui (antigos pills "Todos/Válidos/...") e
 * foram fundidos com os contadores: agora cada card de `EmailCounters` é o
 * próprio switch de filtro (clicar nele marca/desmarca seu status).
 */
export function EmailToolbar({
  termoBusca,
  onTermoBuscaChange,
  quantidade,
  onQuantidadeChange,
  quantidadeMax,
  ordenacao,
  onOrdenacaoChange,
}: Props) {
  // Texto local (digitação fluida) desacoplado do `termoBusca` que
  // efetivamente dispara o filtro — só propaga pro pai após o debounce.
  const [textoLocal, setTextoLocal] = useState(termoBusca);

  // Mantém `textoLocal` sincronizado se `termoBusca` mudar por fora (ex.:
  // algum reset externo do filtro). Ajuste feito durante a própria
  // renderização, mesmo padrão usado em `QuantidadeInput`.
  const [termoBuscaSincronizado, setTermoBuscaSincronizado] = useState(termoBusca);
  if (termoBusca !== termoBuscaSincronizado) {
    setTermoBuscaSincronizado(termoBusca);
    setTextoLocal(termoBusca);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      onTermoBuscaChange(textoLocal);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, ATRASO_DEBOUNCE_BUSCA);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textoLocal]);

  /** Limpa a busca imediatamente, sem esperar o debounce. */
  function limparBusca() {
    setTextoLocal('');
    onTermoBuscaChange('');
  }

  return (
    <div className="toolbar">
      <div className="toolbar-linha toolbar-linha-1">
        <div className="search-input-wrapper">
          <svg
            className="search-input-icone"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>

          <input
            type="text"
            className="search-input"
            placeholder="Buscar por nome ou e-mail..."
            value={textoLocal}
            onChange={(e) => setTextoLocal(e.target.value)}
          />

          {textoLocal && (
            <button
              type="button"
              className="search-input-limpar"
              onClick={limparBusca}
              aria-label="Limpar busca"
            >
              ×
            </button>
          )}
        </div>
        <div className="ordenacao">
          <span className="ordenacao-rotulo">Ordenar por:</span>
          <OrdenacaoPrioridade
            ordenacao={ordenacao}
            labels={CRITERIO_ORDENACAO_LABELS}
            onOrdenacaoChange={onOrdenacaoChange}
          />
        </div>

        <label className="exibir-registros">
          Exibir Registros
          <QuantidadeInput valor={quantidade} onChange={onQuantidadeChange} max={quantidadeMax} min={1} />
        </label>
      </div>
    </div>
  );
}