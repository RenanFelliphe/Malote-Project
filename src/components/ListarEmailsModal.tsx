import { useMemo, useState } from 'react';

import type { EmailRecord, TFiltro } from '../types/email';
import { FILTROS, filtrarPorStatusMultiplo, ordenar } from './utils/emailData';
import { IconeFechar } from './Icons';

type TModoExibicao = 'nome' | 'email';

interface Props {
  onFechar: () => void;
  /** Conjunto completo de registros (não o já filtrado/buscado da página) — o modal aplica seu próprio filtro, seção 7. */
  registros: EmailRecord[];
}

/**
 * Modal "Listar E-mails" — Etapa 4 da especificação (seção 7).
 *
 * Permite: definir quantidade, escolher filtro (reaproveitando as opções
 * da Etapa 3), selecionar registros individualmente ou todos, alternar
 * visualmente entre nome e e-mail, e copiar os e-mails selecionados no
 * formato "email1@email.com;email2@email.com", respeitando a ordem exibida.
 *
 * A atualização de status a partir da seleção (também descrita na seção 7)
 * fica para a Etapa 5 — não implementada aqui.
 *
 * Observação sobre montagem: este componente não controla mais sua própria
 * visibilidade (não recebe `aberto`). Quem decide quando ele existe é o pai
 * (`emails.tsx`), que só o renderiza enquanto o modal estiver aberto e usa uma
 * `key` que muda a cada abertura — isso garante uma instância nova (estado
 * limpo: filtro, quantidade e seleção) a cada vez, sem precisar de um efeito
 * "ao abrir, resetar estado" (ver https://react.dev/learn/you-might-not-need-an-effect).
 */
export function ListarEmailsModal({ onFechar, registros }: Props) {
  const [filtro, setFiltro] = useState<TFiltro>('todos');
  const [quantidade, setQuantidade] = useState<number>(0);
  const [modoExibicao, setModoExibicao] = useState<TModoExibicao>('email');
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [copiado, setCopiado] = useState(false);

  // Ordem exibida: por id (ordem original da planilha), já que a seção 7
  // não define um seletor de ordenação próprio para o modal.
  const registrosFiltrados = useMemo(() => {
    const statusSelecionados = new Set<TFiltro>([filtro]);
    return ordenar(filtrarPorStatusMultiplo(registros, statusSelecionados as Set<any>), ['id']);
  }, [registros, filtro]);

  const quantidadeMaxima = registrosFiltrados.length;

  // Quantidade efetiva: 0 ou vazio = "mostrar todos os registros do filtro".
  const quantidadeEfetiva =
    quantidade > 0 ? Math.min(quantidade, quantidadeMaxima) : quantidadeMaxima;

  const registrosExibidos = useMemo(
    () => registrosFiltrados.slice(0, quantidadeEfetiva),
    [registrosFiltrados, quantidadeEfetiva]
  );

  const idsExibidos = useMemo(() => registrosExibidos.map((r) => r.id), [registrosExibidos]);

  // Quantos dos selecionados estão de fato visíveis na lista atual (filtro +
  // quantidade). Derivado a cada renderização — não precisamos "podar" o
  // estado de seleção; basta nunca contar/copiar o que não está visível.
  const selecionadosVisiveis = useMemo(
    () => idsExibidos.filter((id) => selecionados.has(id)),
    [idsExibidos, selecionados]
  );

  const todosSelecionados =
    idsExibidos.length > 0 && selecionadosVisiveis.length === idsExibidos.length;

  function alternarSelecionado(id: number) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) {
        novo.delete(id);
      } else {
        novo.add(id);
      }
      return novo;
    });
    setCopiado(false);
  }

  function alternarSelecionarTodos() {
    setSelecionados((atual) => {
      if (todosSelecionados) {
        // Desmarca apenas os que estão visíveis, preservando o restante (não deveria haver restante, mas por segurança).
        const novo = new Set(atual);
        idsExibidos.forEach((id) => novo.delete(id));
        return novo;
      }
      const novo = new Set(atual);
      idsExibidos.forEach((id) => novo.add(id));
      return novo;
    });
    setCopiado(false);
  }

  async function copiarEmails() {
    // Ordem exatamente a ordem exibida (seção 7); e-mails duplicados
    // selecionados são todos copiados, pois não há deduplicação aqui.
    const emails = registrosExibidos
      .filter((r) => selecionados.has(r.id))
      .map((r) => r.email);

    const texto = emails.join(';');

    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Fallback para navegadores/contextos sem Clipboard API disponível.
      const textarea = document.createElement('textarea');
      textarea.value = texto;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    setCopiado(true);
  }

  function fechar() {
    onFechar();
  }

  return (
    <div className="modal-overlay" onClick={fechar}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Listar E-mails</h2>
          <button type="button" className="modal-fechar" onClick={fechar} aria-label="Fechar">
            <IconeFechar />
          </button>
        </div>

        <div className="modal-controles">
          <label className="modal-campo">
            Quantidade
            <input
              type="number"
              min={0}
              max={quantidadeMaxima}
              placeholder={`Todos (${quantidadeMaxima})`}
              value={quantidade === 0 ? '' : quantidade}
              onChange={(e) => setQuantidade(Number(e.target.value))}
            />
          </label>

          <label className="modal-campo">
            Filtro
            <select
              value={filtro}
              onChange={(e) => {
                setFiltro(e.target.value as TFiltro);
                // Ao trocar de filtro, a quantidade volta a representar
                // "todos" do novo filtro.
                setQuantidade(0);
              }}
            >
              {FILTROS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <div className="modal-modo-exibicao">
            <span className="modal-campo-label">Exibir</span>
            <div className="modal-modo-botoes">
              <button
                type="button"
                className={modoExibicao === 'nome' ? 'ativo' : ''}
                onClick={() => setModoExibicao('nome')}
              >
                Nome
              </button>
              <button
                type="button"
                className={modoExibicao === 'email' ? 'ativo' : ''}
                onClick={() => setModoExibicao('email')}
              >
                E-mail
              </button>
            </div>
          </div>
        </div>

        <label className="modal-selecionar-todos">
          <input
            type="checkbox"
            checked={todosSelecionados}
            onChange={alternarSelecionarTodos}
            disabled={idsExibidos.length === 0}
          />
          Selecionar todos ({registrosExibidos.length})
        </label>

        {registrosExibidos.length === 0 ? (
          <p className="modal-lista-vazia">Nenhum registro encontrado para este filtro.</p>
        ) : (
          <ul className="modal-lista">
            {registrosExibidos.map((registro) => (
              <li key={registro.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selecionados.has(registro.id)}
                    onChange={() => alternarSelecionado(registro.id)}
                  />
                  <span className={`status-badge status-${registro.status}`}>
                    {registro.status}
                  </span>
                  <span className="modal-lista-texto">
                    {modoExibicao === 'nome'
                      ? registro.nome || '(sem nome)'
                      : registro.email || '(sem e-mail)'}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <div className="modal-rodape">
          <span className="modal-contagem-selecionados">
            {selecionadosVisiveis.length} selecionado(s)
          </span>
          <button
            type="button"
            className="modal-botao-copiar"
            onClick={copiarEmails}
            disabled={selecionadosVisiveis.length === 0}
          >
            {copiado ? 'Copiado!' : 'Copiar e-mails'}
          </button>
        </div>
      </div>
    </div>
  );
}