import { useEffect, useRef, useState } from 'react';

import type { EmailRecord, TStatusManual } from '../types/email';
import { STATUS_SELECIONAVEIS } from '../types/email';
import { copiarTexto } from './utils/clipboard';
import {
  IconeArrastar,
  IconeConfirmarEnvio,
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
   * Desde a Etapa 3, "enviado" não é mais uma opção deste select: passou a
   * ser exclusivo do botão "Confirmar envio" no cabeçalho da tabela.
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
   * Chamada ao clicar no ícone "Confirmar envio" no cabeçalho da tabela
   * (Etapa 3), posicionado à esquerda do botão de deletar. Segue o mesmo
   * padrão do botão de deletar: aplica o status "enviado" a todos os
   * registros atualmente selecionados. Fica oculto quando o grupo
   * selecionado é o de registros "deletado" (mesma condição que troca
   * Deletar por Restaurar), já que não faz sentido confirmar o envio de
   * registros já deletados.
   */
  onConfirmarEnvio?: () => void;
  /**
   * Chamada ao clicar em "Restaurar" no dropdown de ações do cabeçalho.
   * Disponível para qualquer grupo selecionado (deletado, válido, inválido
   * ou enviado) — não depende de `todosSelecionadosDeletados`. Zera
   * `status_alterado` dos selecionados e deixa o sistema recalcular o
   * status normalmente a partir da regra automática (seção 5.2).
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
  onConfirmarEnvio,
  onRestaurar,
}: Props) {
  // Qual coluna mostrou "Copiado!" por último (null = nenhuma, ou o feedback já expirou).
  const [colunaCopiada, setColunaCopiada] = useState<TColunaCopiavel | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Há registros selecionados no momento (usado tanto pelos hooks abaixo
  // quanto na renderização) — precisa vir antes dos hooks que dependem dela.
  const temSelecao = selecionados.size > 0;

  // Controla a exibição do select de atualização em massa, aberto pelo
  // ícone de edição ao lado do cabeçalho da coluna Status (seção 5.2).
  const [selectMassaAberto, setSelectMassaAberto] = useState(false);
  const selectMassaRef = useRef<HTMLSelectElement | null>(null);

  // Controla o dropdown compacto de ações do cabeçalho da tabela.
  const [menuAcoesAberto, setMenuAcoesAberto] = useState(false);
  const menuAcoesRef = useRef<HTMLDivElement | null>(null);
  const botaoAcoesRef = useRef<HTMLButtonElement | null>(null);

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

  // Fecha o dropdown de ações se a seleção for zerada enquanto ele está
  // aberto — o botão que o abre fica invisível (não removido) nesse caso,
  // então o menu não pode continuar exibido sem seleção correspondente.
  useEffect(() => {
    if (!temSelecao) setMenuAcoesAberto(false);
  }, [temSelecao]);

  // Fecha o dropdown compacto de ações ao clicar fora dele ou pressionar Escape.
  useEffect(() => {
    if (!menuAcoesAberto) return;

    const handlePointerDown = (event: MouseEvent) => {
      const alvo = event.target as Node | null;
      if (!alvo) return;

      const clicouDentro =
        menuAcoesRef.current?.contains(alvo) || botaoAcoesRef.current?.contains(alvo);
      if (!clicouDentro) {
        setMenuAcoesAberto(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuAcoesAberto(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuAcoesAberto]);

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
   * - demais status (válido/inválido/enviado): badge vira um select inline.
   *   As opções exibidas são sempre "válido"/"inválido" (Etapa 3: "enviado"
   *   deixou de ser uma opção deste select, pois agora só é alcançável pelo
   *   botão "Confirmar envio" no cabeçalho). Quando o registro já está
   *   "enviado", sua opção atual é mantida no select (como último item, na
   *   mesma posição que ocupava antes) só para que o valor selecionado
   *   continue correspondendo a uma opção existente — escolhê-la de novo
   *   não tem efeito, mas o usuário pode trocar para válido/inválido
   *   normalmente.
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

    const opcoes: TStatusManual[] =
      registro.status === 'enviado' ? [...STATUS_SELECIONAVEIS, 'enviado'] : STATUS_SELECIONAVEIS;

    return (
      <select
        className={`status-select status-${registro.status}`}
        value={registro.status}
        onChange={(evento) =>
          onAtualizarStatusIndividual(registro.id, evento.target.value as TStatusManual)
        }
        aria-label={`Alterar status do registro ${registro.id}`}
      >
        {opcoes.map((status) => (
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
              <button
                type="button"
                className={`botao-icone-th ${colunaCopiada === 'nome' ? 'copiado' : ''} ${temSelecao ? '' : 'botao-icone-th-invisivel'
                  }`}
                onClick={() => void copiarColuna('nome')}
                title="Copiar nomes exibidos"
                aria-label="Copiar nomes exibidos"
              >
                <IconeCopiar />
              </button>
            </span>
          </th>
          <th>
            <span className="th-com-copia">
              E-mail
              <button
                type="button"
                className={`botao-icone-th ${colunaCopiada === 'email' ? 'copiado' : ''} ${temSelecao ? '' : 'botao-icone-th-invisivel'
                  }`}
                onClick={() => void copiarColuna('email')}
                title="Copiar e-mails exibidos"
                aria-label="Copiar e-mails exibidos"
              >
                <IconeCopiar />
              </button>
            </span>
          </th>
          <th>
            <span className="th-com-copia">
              Status
              {onAtualizarStatusEmMassa && (
                <span className="th-status-massa">
                  <button
                    type="button"
                    className={`botao-icone-th ${temSelecao ? '' : 'botao-icone-th-invisivel'}`}
                    onClick={() => {
                      if (!temSelecao) return;
                      setSelectMassaAberto((aberto) => !aberto);
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
                      {STATUS_SELECIONAVEIS.map((status) => (
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
            {(onConfirmarEnvio || onDeletar || onRestaurar) && (
              <div className="th-acoes-menu" ref={menuAcoesRef}>
                <button
                  ref={botaoAcoesRef}
                  type="button"
                  className={`botao-icone-th botao-icone-th-menu ${menuAcoesAberto ? 'botao-icone-th-menu-aberto' : ''} ${temSelecao ? '' : 'botao-icone-th-invisivel'
                    }`}
                  onClick={() => setMenuAcoesAberto((aberto) => !aberto)}
                  title="Mais ações"
                  aria-label="Abrir mais ações para os registros selecionados"
                  aria-haspopup="menu"
                  aria-expanded={menuAcoesAberto}
                >
                  <IconeArrastar />
                </button>

                {menuAcoesAberto && (
                  <div className="acoes-dropdown" role="menu">
                    {onConfirmarEnvio && !todosSelecionadosDeletados && (
                      <button
                        type="button"
                        className="acoes-dropdown-item acoes-dropdown-item-sucesso"
                        onClick={() => {
                          setMenuAcoesAberto(false);
                          onConfirmarEnvio();
                        }}
                        role="menuitem"
                      >
                        <span>Confirmar Envio</span>
                        <IconeConfirmarEnvio />
                      </button>
                    )}

                    {onRestaurar && (
                      <button
                        type="button"
                        className="acoes-dropdown-item acoes-dropdown-item-info"
                        onClick={() => {
                          setMenuAcoesAberto(false);
                          onRestaurar();
                        }}
                        role="menuitem"
                      >
                        <span>Restaurar</span>
                        <IconeRestaurar />
                      </button>
                    )}

                    {!todosSelecionadosDeletados && onDeletar && (
                      <button
                        type="button"
                        className="acoes-dropdown-item acoes-dropdown-item-perigo"
                        onClick={() => {
                          setMenuAcoesAberto(false);
                          onDeletar();
                        }}
                        role="menuitem"
                      >
                        <span>Deletar</span>
                        <IconeLixeira />
                      </button>
                    )}
                  </div>
                )}
              </div>
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