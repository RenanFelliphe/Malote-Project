import type { TFiltro, TStatus } from '../types/email';
import { FILTROS, TODOS_OS_STATUS, type TOrdenacao } from './utils/emailData';
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

  return (
    <div className="toolbar">
      <div className="toolbar-linha toolbar-linha-1">
        <input
          type="text"
          className="search-input"
          placeholder="Buscar por nome ou e-mail..."
          value={termoBusca}
          onChange={(e) => onTermoBuscaChange(e.target.value)}
        />

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
          <OrdenacaoPrioridade ordenacao={ordenacao} onOrdenacaoChange={onOrdenacaoChange} />
        </div>

        <label className="exibir-registros">
          Exibir Registros
          <QuantidadeInput valor={quantidade} onChange={onQuantidadeChange} max={quantidadeMax} />
        </label>
      </div>
    </div>
  );
}