import { useMemo, useState } from 'react';

import type { EmailRecord, TFiltro, TStatus, TStatusManual } from '../types/email';
import { calcularPaginacao } from '../components/utils/paginacao';
import { calcularContadores, processarRegistros, ORDENACAO_PADRAO, TODOS_OS_STATUS, type TOrdenacao } from '../components/utils/emailData';
import { recalcularStatusAutomatico, normalizeEmail } from '../components/EmailStatus';
import { EmailCounters } from '../components/EmailCounters';
import { EmailToolbar } from '../components/EmailToolbar';
import { EmailTable } from '../components/EmailTable';
import { ConflitoExclusaoModal } from '../components/ConflitoExclusaoModal';
import { DuplicadosModal } from '../components/DuplicadosModal';
import { salvarEmails } from '../services/emailsApi';

import emailsJson from '../../data/emails.json';

const registrosIniciais = emailsJson as EmailRecord[];

/** Grupo de seleção de um registro: "deletado" ou "ativo" (todos os demais status). */
function grupoDoStatus(status: EmailRecord['status']): 'deletado' | 'ativo' {
  return status === 'deletado' ? 'deletado' : 'ativo';
}

export function Emails() {
  const [registros, setRegistros] = useState<EmailRecord[]>(registrosIniciais);
  const [termoBusca, setTermoBusca] = useState('');
  const [statusFiltrados, setStatusFiltrados] = useState<Set<TStatus>>(new Set(TODOS_OS_STATUS));
  const [ordenacao, setOrdenacao] = useState<TOrdenacao>(ORDENACAO_PADRAO);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  // Quantidade de registros renderizados por página, usada como tamanho da
  // seção exibida na tabela.
  const [quantidade, setQuantidade] = useState<number>(() => Math.max(1, Math.min(20, registrosIniciais.length)));
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [grupoDuplicadoAberto, setGrupoDuplicadoAberto] = useState<EmailRecord[] | null>(null);
  const [conflitoExclusao, setConflitoExclusao] = useState<{
    enviados: EmailRecord[];
    aDeletar: EmailRecord[];
  } | null>(null);
  const [erroSalvamento, setErroSalvamento] = useState<string | null>(null);

  const contadores = useMemo(() => calcularContadores(registros), [registros]);

  // Pipeline completo (seção 7): filtro por status -> busca -> ordenação ->
  // corte pela quantidade definida no input ao lado da searchbar. A
  // quantidade é sempre aplicada por último, sobre o resultado já
  // filtrado/buscado/ordenado — é o que a tabela renderiza e também a base
  // usada pelos botões de copiar (seção 7, itens 3-5).
  const registrosProcessados = useMemo(
    () => processarRegistros(registros, { statusFiltrados, termoBusca, ordenacao }),
    [registros, statusFiltrados, termoBusca, ordenacao]
  );

  const paginacao = useMemo(
    () => calcularPaginacao(registrosProcessados.length, quantidade, paginaAtual),
    [registrosProcessados.length, quantidade, paginaAtual]
  );

  const registrosExibidos = useMemo(
    () => registrosProcessados.slice(paginacao.intervalo.inicio, paginacao.intervalo.fim),
    [registrosProcessados, paginacao.intervalo.inicio, paginacao.intervalo.fim]
  );

  // Mapa auxiliar id -> status, usado para aplicar a regra de seleção
  // (seção 7 — não é permitido selecionar deletados e não deletados
  // simultaneamente) sem precisar varrer o array a cada verificação.
  const statusPorId = useMemo(() => new Map(registros.map((r) => [r.id, r.status])), [registros]);

  // Grupo da seleção atual (null quando nada está selecionado). Como toda
  // inclusão respeita a regra abaixo, a seleção é sempre homogênea.
  const grupoSelecaoAtual = useMemo<'deletado' | 'ativo' | null>(() => {
    if (selecionados.size === 0) return null;
    const primeiroId = selecionados.values().next().value as number;
    const status = statusPorId.get(primeiroId);
    return status ? grupoDoStatus(status) : null;
  }, [selecionados, statusPorId]);

  const todosSelecionadosDeletados = grupoSelecaoAtual === 'deletado';

  /** Usada pela tabela para desabilitar registros do "outro grupo" durante uma seleção em andamento. */
  function selecionavel(registro: EmailRecord): boolean {
    if (grupoSelecaoAtual === null) return true;
    return grupoDoStatus(registro.status) === grupoSelecaoAtual;
  }

  function alternarSelecao(id: number) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) {
        novo.delete(id);
        return novo;
      }

      // Regra de seleção (seção 7): não mistura deletados e não deletados.
      const status = statusPorId.get(id);
      if (status && atual.size > 0) {
        const primeiroId = atual.values().next().value as number;
        const statusExistente = statusPorId.get(primeiroId);
        if (statusExistente && grupoDoStatus(status) !== grupoDoStatus(statusExistente)) {
          return atual;
        }
      }

      novo.add(id);
      return novo;
    });
  }

  function alternarSelecaoTodos() {
    setSelecionados((atual) => {
      // Determina o grupo a considerar: respeita a seleção já existente ou,
      // se vazia, prioriza os registros não deletados dentre os exibidos.
      let grupoAlvo: 'deletado' | 'ativo';
      if (atual.size > 0) {
        const primeiroId = atual.values().next().value as number;
        const statusExistente = statusPorId.get(primeiroId);
        grupoAlvo = statusExistente ? grupoDoStatus(statusExistente) : 'ativo';
      } else {
        const existeNaoDeletadoVisivel = registrosExibidos.some((r) => r.status !== 'deletado');
        grupoAlvo = existeNaoDeletadoVisivel ? 'ativo' : 'deletado';
      }

      const elegiveis = registrosExibidos.filter((r) => grupoDoStatus(r.status) === grupoAlvo);
      const todosJaSelecionados = elegiveis.every((r) => atual.has(r.id));

      const novo = new Set(atual);
      if (todosJaSelecionados) {
        elegiveis.forEach((r) => novo.delete(r.id));
      } else {
        elegiveis.forEach((r) => novo.add(r.id));
      }
      return novo;
    });
  }

  /**
   * Alterna filtros de status como switches independentes (melhoria
   * solicitada): cada botão marca/desmarca seu próprio status, permitindo
   * combinações como "Válidos + Inválidos" simultaneamente. "Todos" marca
   * ou desmarca todos de uma vez, conforme o estado atual.
   */
  function alternarFiltro(filtro: TFiltro) {
    setStatusFiltrados((atual) => {
      if (filtro === 'todos') {
        const todosJaMarcados = TODOS_OS_STATUS.every((status) => atual.has(status));
        return todosJaMarcados ? new Set() : new Set(TODOS_OS_STATUS);
      }

      const novo = new Set(atual);
      if (novo.has(filtro)) {
        novo.delete(filtro);
      } else {
        novo.add(filtro);
      }
      return novo;
    });
  }

  /**
   * Abre o modal com todos os registros que compartilham o mesmo e-mail do
   * registro "duplicado" clicado na tabela (melhoria de estilização).
   */
  function handleClicarDuplicado(registro: EmailRecord) {
    const emailNormalizado = normalizeEmail(registro.email);
    const grupo = registros.filter((r) => normalizeEmail(r.email) === emailNormalizado);
    setGrupoDuplicadoAberto(grupo);
  }

  /**
   * Persiste imediatamente o array completo (seção 2.2). Em caso de falha,
   * reverte a UI para o estado anterior — não faz sentido manter um estado
   * que não foi de fato salvo em disco.
   */
  async function persistirRegistros(registrosAtualizados: EmailRecord[]) {
    const registrosAnteriores = registros;
    setRegistros(registrosAtualizados);
    setErroSalvamento(null);

    try {
      await salvarEmails(registrosAtualizados);
      setSelecionados(new Set());
    } catch {
      setRegistros(registrosAnteriores);
      setErroSalvamento('Não foi possível salvar a alteração. Tente novamente.');
    }
  }

  /**
   * Atualização em massa de status (seção 5.2 — select "Atualizar para" da
   * `SelecaoAcoesBar` e, a partir da Etapa 2, também o select aberto pelo
   * ícone de edição no cabeçalho da coluna Status). Regra importante:
   * registros selecionados com status "duplicado" nunca são modificados por
   * aqui — é calculado automaticamente pelo sistema, não um destino manual.
   * Como a seleção pode conter uma mistura de duplicados e não duplicados
   * (ambos pertencem ao mesmo grupo "ativo"), o filtro é aplicado na hora de
   * decidir quais registros de fato mudam de status.
   */
  async function handleAtualizarStatus(novoStatus: 'válido' | 'inválido' | 'enviado') {
    const agora = new Date().toISOString();
    const registrosAtualizados = registros.map((registro) =>
      selecionados.has(registro.id) && registro.status !== 'duplicado'
        ? { ...registro, status: novoStatus, status_alterado: true, last_updated: agora }
        : registro
    );
    await persistirRegistros(registrosAtualizados);
  }

  /**
   * Atualização individual de status (seção 7, revisão pós-Etapa 4):
   * disparada pelo select inline na própria célula da tabela, atualiza
   * apenas o registro clicado. "duplicado" e "deletado" nunca chegam aqui
   * — a tabela não renderiza o select para esses dois status (ver
   * `EmailTable.renderStatus`) — mas a checagem abaixo é mantida como
   * salvaguarda, caso este handler venha a ser chamado de outro lugar no
   * futuro.
   */
  async function handleAtualizarStatusIndividual(id: number, novoStatus: TStatusManual) {
    const registroAlvo = registros.find((r) => r.id === id);
    if (!registroAlvo || registroAlvo.status === 'duplicado' || registroAlvo.status === 'deletado') {
      return;
    }

    const agora = new Date().toISOString();
    const registrosAtualizados = registros.map((registro) =>
      registro.id === id
        ? { ...registro, status: novoStatus, status_alterado: true, last_updated: agora }
        : registro
    );
    await persistirRegistros(registrosAtualizados);
  }

  /** Deleta (logicamente) os registros indicados, sem passar pelo modal de conflito. */
  async function deletarRegistros(ids: number[]) {
    const idsSet = new Set(ids);
    const agora = new Date().toISOString();
    const registrosAtualizados = registros.map((registro) =>
      idsSet.has(registro.id)
        ? { ...registro, status: 'deletado' as const, status_alterado: true, last_updated: agora }
        : registro
    );
    await persistirRegistros(registrosAtualizados);
  }

  /**
   * Clique em "Deletar": registros "enviado" nunca podem ser deletados
   * (seção 7 — "Restrição para enviados"). Se a seleção contiver algum,
   * abre o modal de resolução de conflito; caso contrário, deleta direto.
   */
  function handleDeletarClick() {
    const selecionadosArr = registros.filter((r) => selecionados.has(r.id));
    const enviados = selecionadosArr.filter((r) => r.status === 'enviado');
    const aDeletar = selecionadosArr.filter((r) => r.status !== 'enviado');

    if (enviados.length > 0) {
      setConflitoExclusao({ enviados, aDeletar });
      return;
    }

    void deletarRegistros(selecionadosArr.map((r) => r.id));
  }

  function handleCancelarConflito() {
    // Fecha o modal e preserva a seleção original — nenhuma alteração é feita.
    setConflitoExclusao(null);
  }

  async function handleConfirmarConflito(idsParaDeletar: Set<number>) {
    setConflitoExclusao(null);
    await deletarRegistros([...idsParaDeletar]);
  }

  /**
   * "Restaurar": zera `status_alterado` dos selecionados e recalcula o
   * status de todo o conjunto conforme as regras de prioridade (seção 7 —
   * o registro "volta a ser processado normalmente pelo sistema").
   */
  async function handleRestaurar() {
    const agora = new Date().toISOString();
    const comStatusResetado = registros.map((registro) =>
      selecionados.has(registro.id)
        ? { ...registro, status_alterado: false, last_updated: agora }
        : registro
    );
    const registrosAtualizados = recalcularStatusAutomatico(comStatusResetado);
    await persistirRegistros(registrosAtualizados);
  }

  return (
    <div className="emails-page">
      <div className="emails-page-header">
        <h1>Sistema de E-mails</h1>
      </div>

      {erroSalvamento && <p className="erro-salvamento">{erroSalvamento}</p>}

      <EmailCounters contadores={contadores} />

      <EmailToolbar
        termoBusca={termoBusca}
        onTermoBuscaChange={setTermoBusca}
        quantidade={quantidade}
        onQuantidadeChange={(valor) => {
          setQuantidade(valor);
          setPaginaAtual(1);
        }}
        statusFiltrados={statusFiltrados}
        onAlternarFiltro={alternarFiltro}
        ordenacao={ordenacao}
        onOrdenacaoChange={setOrdenacao}
        paginacao={paginacao}
        onPaginaChange={setPaginaAtual}
      />

      <p className="contador-selecionados">{selecionados.size} selecionado(s)</p>

      <EmailTable
        registros={registrosExibidos}
        selecionados={selecionados}
        onAlternarSelecao={alternarSelecao}
        onAlternarSelecaoTodos={alternarSelecaoTodos}
        selecionavel={selecionavel}
        onClicarDuplicado={handleClicarDuplicado}
        onAtualizarStatusIndividual={(id, status) => void handleAtualizarStatusIndividual(id, status)}
        onAtualizarStatusEmMassa={(status) => void handleAtualizarStatus(status)}
        todosSelecionadosDeletados={todosSelecionadosDeletados}
        onDeletar={handleDeletarClick}
        onRestaurar={() => void handleRestaurar()}
      />

      {conflitoExclusao && (
        <ConflitoExclusaoModal
          enviados={conflitoExclusao.enviados}
          aDeletar={conflitoExclusao.aDeletar}
          onCancelar={handleCancelarConflito}
          onConfirmar={(ids) => void handleConfirmarConflito(ids)}
        />
      )}

      {grupoDuplicadoAberto && (
        <DuplicadosModal
          registros={grupoDuplicadoAberto}
          onFechar={() => setGrupoDuplicadoAberto(null)}
        />
      )}
    </div>
  );
}