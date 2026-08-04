import { useEffect, useState } from 'react';

import type { TFiltro, TStatus } from '../types/email';
import { CRITERIO_ORDENACAO_LABELS, FILTROS, TODOS_OS_STATUS, type TOrdenacao } from './utils/emailData';
import { OrdenacaoPrioridade } from './OrdenacaoPrioridade';
import { QuantidadeInput } from './QuantidadeInput';

interface Props {
  termoBusca: string;
  onTermoBuscaChange: (termo: string) => void;
  quantidade: number;
  onQuantidadeChange: (quantidade: number) => void;
  /** Maior valor aceito no input de quantidade (total de registros após filtro/busca). */
  quantidadeMax: number;
  statusFiltrados: Set<TStatus>;
  onAlternarFiltro: (filtro: TFiltro) => void;
  ordenacao: TOrdenacao;
  onOrdenacaoChange: (ordenacao: TOrdenacao) => void;
}

/** Atraso do debounce da busca (ms) — evita reprocessar a cada tecla digitada. */
const ATRASO_DEBOUNCE_BUSCA = 250;

/**
 * Toolbar em duas linhas (melhoria de estilização):
 *
 * Linha 1 — busca (nome + e-mail) e filtros por status.
 * Linha 2 — ordenação e quantidade de registros exibidos. As ações de
 * seleção (alterar status, deletar/restaurar, contador) saíram daqui na
 * Etapa 5 e agora vivem distribuídas na própria tabela (`EmailTable`) e no
 * contador fixo entre a toolbar e a tabela (`Emails`, em `pages/emails.tsx`).
 * A paginação também vive nessa mesma linha fixa, ao lado do contador
 * (ver `Paginacao`, renderizado por `pages/emails.tsx`).
 *
 * Os filtros funcionam como um grupo de switches independentes: cada botão
 * marca/desmarca seu status na seleção, permitindo combinações como
 * "Válidos + Inválidos" ao mesmo tempo. "Todos" é um atalho que marca ou
 * desmarca todos os status de uma vez (marcado quando todos já estão
 * selecionados).
 */
export function EmailToolbar({
  termoBusca,
  onTermoBuscaChange,
  quantidade,
  onQuantidadeChange,
  quantidadeMax,
  statusFiltrados,
  onAlternarFiltro,
  ordenacao,
  onOrdenacaoChange,
}: Props) {
  const todosMarcados = TODOS_OS_STATUS.every((status) => statusFiltrados.has(status));

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

        <div className="filtros">
          {FILTROS.map(({ value, label }) => {
            const ativo = value === 'todos' ? todosMarcados : statusFiltrados.has(value);
            return (
              <button
                key={value}
                type="button"
                className={`filtro-btn ${ativo ? 'ativo' : ''}`}
                onClick={() => onAlternarFiltro(value)}
                aria-pressed={ativo}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="toolbar-linha toolbar-linha-2">
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