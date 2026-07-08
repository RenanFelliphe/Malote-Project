import { useEffect, useRef, useState } from 'react';

import type { EmailRecord, TStatusManual } from '../types/email';
import { STATUS_MANUAIS } from '../types/email';
import { copiarTexto } from './utils/clipboard';
import {
  IconeCopiar,
  IconeEditarStatus,
  IconeLixeira,
  IconeRestaurar,
} from './Icons';

/** Colunas copiáveis via botão no cabeçalho (seção 7). */
type TColunaCopiavel = 'nome' | 'email';

/** Por quanto tempo o botão de copiar mostra o feedback "Copiado!" antes de voltar ao normal. */
const DURACAO_FEEDBACK_COPIA_MS = 1500;

interface Props {
  registros: EmailRecord[];
  selecionados: Set<number>;
  onAlternarSelecao: (id: number) => void;
  onAlternarSelecaoTodos: () => void;
  /**
   * Indica se um registro pode ser (des)selecionado no momento. Usada para
   * desabilitar visualmente os registros do "outro grupo" quando já há uma
   * seleção em andamento — regra de seleção da seção 7: não é permitido
   * selecionar deletados e não deletados simultaneamente.
   */
  selecionavel?: (registro: EmailRecord) => boolean;
  /**
   * Chamada ao clicar no badge de status de um registro com status
   * "duplicado", para abrir o modal com os demais registros do mesmo
   * e-mail. Registros com outros status não são clicáveis.
   */
  onClicarDuplicado?: (registro: EmailRecord) => void;
  /**
   * Chamada ao selecionar uma nova opção no select inline de status de um
   * registro individual (qualquer status exceto "duplicado" e "deletado" —
   * ver `renderStatus` abaixo). Atualiza imediatamente apenas aquele
   * registro.
   */
  onAtualizarStatusIndividual?: (id: number, status: TStatusManual) => void;
  /**
   * Chamada ao escolher uma opção no select de atualização em massa, aberto
   * pelo ícone de edição ao lado do cabeçalho da coluna Status. Aplica o
   * novo status a todos os registros atualmente selecionados — a exclusão
   * dos registros com status "duplicado" dentre os selecionados é feita no
   * handler (seção 7, regra importante da alteração em massa), não aqui.
   */
  onAtualizarStatusEmMassa?: (status: TStatusManual) => void;
  /**
   * true quando TODOS os registros selecionados já estão com status
   * "deletado" — decide qual dos dois ícones aparece no cabeçalho (seção 7):
   * registros já deletados não podem ser deletados de novo, então o ícone de
   * lixeira dá lugar ao de restaurar nesse caso.
   */
  todosSelecionadosDeletados?: boolean;
  /**
   * Chamada ao clicar no ícone de lixeira no extremo direito do cabeçalho
   * da tabela (Etapa 3). Dispara a mesma lógica de exclusão de sempre
   * (inclusive o modal de conflito para registros "enviado") — só a
   * posição do botão mudou.
   */
  onDeletar?: () => void;
  /**
   * Chamada ao clicar no ícone de restaurar, exibido no mesmo lugar da
   * lixeira quando TODOS os selecionados já estão com status "deletado"
   * (Etapa 5 — funcionalidade que antes vivia na `SelecaoAcoesBar`, agora
   * removida). Zera `status_alterado` dos selecionados e deixa o sistema
   * recalcular o status normalmente.
   */
  onRestaurar?: () => void;
}

/** Tabela com ID, Nome, E-mail e Status de cada registro (seção 6). */
export function EmailTable({
  registros,
  selecionados,
  onAlternarSelecao,
  onAlternarSelecaoTodos,
  selecionavel,
  onClicarDuplicado,
  onAtualizarStatusIndividual,
  onAtualizarStatusEmMassa,
  todosSelecionadosDeletados,
  onDeletar,
  onRestaurar,
}: Props) {
  // Qual coluna mostrou "Copiado!" por último (null = nenhuma, ou o feedback já expirou).
  const [colunaCopiada, setColunaCopiada] = useState<TColunaCopiavel | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Controla a exibição do select de atualização em massa, aberto pelo
  // ícone de edição ao lado do cabeçalho da coluna Status (seção 5.2).
  const [selectMassaAberto, setSelectMassaAberto] = useState(false);
  const selectMassaRef = useRef<HTMLSelectElement | null>(null);

  // Limpa o timer pendente ao desmontar, para não chamar setState em um
  // componente já desmontado.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Ao abrir o select de atualização em massa, leva o foco a ele e já
  // dispara o dropdown nativo (`showPicker`, quando suportado) — evita um
  // clique extra do usuário para ver as opções. `requestAnimationFrame`
  // garante que o `<select>` já esteja montado no DOM antes de focar.
  useEffect(() => {
    if (!selectMassaAberto) return;

    const frame = window.requestAnimationFrame(() => {
      const select = selectMassaRef.current;
      if (!select) return;

      select.focus();
      if ('showPicker' in select && typeof select.showPicker === 'function') {
        select.showPicker();
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectMassaAberto]);

  /**
   * Copia a coluna indicada (nome ou e-mail) dos registros atualmente
   * renderizados que também estão selecionados — ou seja, a interseção entre
   * `registros` (que já reflete busca, filtros, ordenação e a quantidade
   * definida no input ao lado da searchbar, seção 7) e `selecionados`. Sem
   * deduplicação: valores repetidos são copiados uma vez para cada registro,
   * na ordem exibida.
   */
  async function copiarColuna(coluna: TColunaCopiavel) {
    const valores = registros
      .filter((registro) => selecionados.has(registro.id))
      .map((registro) => registro[coluna]);
    await copiarTexto(valores);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setColunaCopiada(coluna);
    timeoutRef.current = setTimeout(() => setColunaCopiada(null), DURACAO_FEEDBACK_COPIA_MS);
  }

  /**
   * Renderiza a célula de status de um registro (seção 7, revisão pós-Etapa
   * 4 — antes vivia numa seção fixa acima da tabela, agora distribuída na
   * própria célula). Três casos, conforme as respostas de esclarecimento:
   *
   * - "duplicado": comportamento inalterado — badge não editável que abre
   *   o modal de duplicados (nunca um select: é calculado automaticamente).
   * - "deletado": badge não editável e não clicável — só pode ser revertido
   *   pelo botão de restaurar (seleção em massa), nunca por este select.
   * - demais status (válido/inválido/enviado): badge vira um select inline
   *   com as três opções manuais; ao escolher uma, atualiza imediatamente
   *   apenas este registro. Para "enviado", isso permite mudar para
   *   válido/inválido — mas excluir continua exigindo o modal de conflito,
   *   já que "deletado" nunca é uma opção deste select.
   */
  function renderStatus(registro: EmailRecord) {
    if (registro.status === 'duplicado') {
      return onClicarDuplicado ? (
        <button
          type="button"
          className="status-badge status-duplicado status-badge-clicavel"
          onClick={() => onClicarDuplicado(registro)}
          title="Ver todos os registros com este e-mail"
        >
          {registro.status}
        </button>
      ) : (
        <span className="status-badge status-duplicado">{registro.status}</span>
      );
    }

    if (registro.status === 'deletado' || !onAtualizarStatusIndividual) {
      return <span className={`status-badge status-${registro.status}`}>{registro.status}</span>;
    }

    return (
      <select
        className={`status-select status-${registro.status}`}
        value={registro.status}
        onChange={(evento) =>
          onAtualizarStatusIndividual(registro.id, evento.target.value as TStatusManual)
        }
        aria-label={`Alterar status do registro ${registro.id}`}
      >
        {STATUS_MANUAIS.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
    );
  }

  /**
   * Aplica o novo status a todos os registros selecionados (seção 5.2, ícone
   * de edição no cabeçalho da coluna Status). A exclusão dos registros
   * "duplicado" dentre os selecionados é responsabilidade do handler
   * (`handleAtualizarStatus`, em emails.tsx) — aqui apenas repassamos a
   * escolha e fechamos o select.
   */
  function handleSelecionarStatusEmMassa(evento: React.ChangeEvent<HTMLSelectElement>) {
    const valor = evento.target.value as TStatusManual | '';
    setSelectMassaAberto(false);
    if (valor && onAtualizarStatusEmMassa) onAtualizarStatusEmMassa(valor);
  }

  if (registros.length === 0) {
    return <p className="tabela-vazia">Nenhum registro encontrado.</p>;
  }

  // "Selecionar todos" considera apenas os registros exibidos (após busca/filtro).
  const todosSelecionados = registros.every((r) => selecionados.has(r.id));
  const temSelecao = selecionados.size > 0;

  return (
    <table className="email-table">
      <thead>
        <tr>
          <th>
            <input
              type="checkbox"
              checked={todosSelecionados}
              onChange={onAlternarSelecaoTodos}
              aria-label="Selecionar todos os registros exibidos"
            />
          </th>
          <th>ID</th>
          <th>
            <span className="th-com-copia">
              Nome
              {temSelecao && (
                <button
                  type="button"
                  className={`botao-copiar-coluna ${colunaCopiada === 'nome' ? 'copiado' : ''}`}
                  onClick={() => void copiarColuna('nome')}
                  title="Copiar nomes exibidos"
                  aria-label="Copiar nomes exibidos"
                >
                  <IconeCopiar />
                </button>
              )}
            </span>
          </th>
          <th>
            <span className="th-com-copia">
              E-mail
              {temSelecao && (
                <button
                  type="button"
                  className={`botao-copiar-coluna ${colunaCopiada === 'email' ? 'copiado' : ''}`}
                  onClick={() => void copiarColuna('email')}
                  title="Copiar e-mails exibidos"
                  aria-label="Copiar e-mails exibidos"
                >
                  <IconeCopiar />
                </button>
              )}
            </span>
          </th>
          <th>
            <span className="th-com-copia">
              Status
              {temSelecao && onAtualizarStatusEmMassa && (
                <span className="th-status-massa">
                  <button
                    type="button"
                    className="botao-icone botao-editar-status"
                    onClick={() => {
                      if (selectMassaAberto) {
                        setSelectMassaAberto(false);
                        return;
                      }

                      setSelectMassaAberto(true);
                    }}
                    title="Atualizar status dos selecionados"
                    aria-label="Atualizar status dos registros selecionados"
                    aria-expanded={selectMassaAberto}
                  >
                    <IconeEditarStatus />
                  </button>
                  {selectMassaAberto && (
                    <select
                      ref={selectMassaRef}
                      className="select-atualizar-status-massa"
                      value=""
                      onChange={handleSelecionarStatusEmMassa}
                      onBlur={() => setSelectMassaAberto(false)}
                      aria-label="Novo status para os registros selecionados"
                    >
                      <option value="" disabled>
                        Selecione...
                      </option>
                      {STATUS_MANUAIS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  )}
                </span>
              )}
            </span>
          </th>
          <th className="th-acoes">
            {onDeletar && temSelecao && !todosSelecionadosDeletados && (
              <button
                type="button"
                className="botao-icone botao-icone-deletar"
                onClick={onDeletar}
                title="Deletar"
                aria-label="Deletar registros selecionados"
              >
                <IconeLixeira />
              </button>
            )}
            {onRestaurar && temSelecao && todosSelecionadosDeletados && (
              <button
                type="button"
                className="botao-icone botao-icone-restaurar"
                onClick={onRestaurar}
                title="Restaurar"
                aria-label="Restaurar registros selecionados"
              >
                <IconeRestaurar />
              </button>
            )}
          </th>
        </tr>
      </thead>
      <tbody>
        {registros.map((registro) => {
          const podeSelecionar = selecionavel ? selecionavel(registro) : true;
          return (
            <tr key={registro.id}>
              <td>
                <input
                  type="checkbox"
                  checked={selecionados.has(registro.id)}
                  onChange={() => onAlternarSelecao(registro.id)}
                  disabled={!podeSelecionar}
                  title={
                    podeSelecionar
                      ? undefined
                      : 'Não é possível selecionar registros deletados e não deletados ao mesmo tempo.'
                  }
                  aria-label={`Selecionar registro ${registro.id}`}
                />
              </td>
              <td>{registro.id}</td>
              <td>{registro.nome}</td>
              <td>{registro.email}</td>
              <td>{renderStatus(registro)}</td>
              <td className="td-acoes" />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}