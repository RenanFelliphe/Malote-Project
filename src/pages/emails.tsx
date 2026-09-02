import { useEffect, useMemo, useRef, useState } from 'react';

import type { EmailConteudo, EmailRecord, EmailsData, TFiltro, TStatus, TStatusManual } from '../types/email';
import { calcularPaginacao } from '../components/utils/paginacao';
import { calcularContadores, processarRegistros, buscar, CONTADOR_LABELS, ORDENACAO_PADRAO, TODOS_OS_STATUS, type TOrdenacao } from '../components/utils/emailData';
import { recalcularStatusAutomatico, normalizeEmail } from '../components/EmailStatus';
import { EmailCounters } from '../components/EmailCounters';
import { EmailToolbar } from '../components/EmailToolbar';
import { EmailTable, type TCampoEditavel } from '../components/EmailTable';
import { restaurarCampos, type TCampoRestauravel } from '../components/utils/restaurarCampos';
import { RestaurarCamposModal } from '../components/RestaurarCamposModal';
import { Paginacao } from '../components/Paginacao';
import { ConflitoExclusaoModal } from '../components/ConflitoExclusaoModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DuplicadosConflitoModal } from '../components/DuplicadosConflitoModal';
import { Header } from '../components/Header';
import { IconeFechar } from '../components/Icons';
import { salvarEmails } from '../services/emailsApi';

/**
 * Props recebidas da rota (`App.tsx`), no mesmo papel que `App.tsx` +
 * `CourseLesson` cumprem no Multiverso (ver refatoracaoMultiPaginas-v2.md,
 * seção 3.3 / Etapa 5): o componente deixa de importar dado fixo e passa a
 * ser um template genérico, que recebe o projeto já resolvido (slug + dados)
 * em vez de descobri-lo sozinho.
 *
 */
interface EmailsProps {
  slug: string;
  dados: EmailsData;
}

/** Grupo de seleção de um registro: "deletado" ou "ativo" (todos os demais status). */
function grupoDoStatus(status: EmailRecord['status']): 'deletado' | 'ativo' {
  return status === 'deletado' ? 'deletado' : 'ativo';
}

export function Emails({ slug, dados }: EmailsProps) {
  const [registros, setRegistros] = useState<EmailRecord[]>(dados.registros);
  const [termoBusca, setTermoBusca] = useState('');
  const [statusFiltrados, setStatusFiltrados] = useState<Set<TStatus>>(new Set(TODOS_OS_STATUS));
  const [ordenacao, setOrdenacao] = useState<TOrdenacao>(ORDENACAO_PADRAO);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  // Quantidade de registros renderizados por página, usada como tamanho da
  // seção exibida na tabela.
  const [quantidade, setQuantidade] = useState<number>(() => Math.max(1, Math.min(100, dados.registros.length)));
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [grupoDuplicadoAberto, setGrupoDuplicadoAberto] = useState<EmailRecord[] | null>(null);
  const [confirmacaoLimparSelecao, setConfirmacaoLimparSelecao] = useState(false);
  const [conflitoExclusao, setConflitoExclusao] = useState<{
    enviados: EmailRecord[];
    aDeletar: EmailRecord[];
  } | null>(null);
  /**
   * Registro(s) pendentes de escolha no modal de restauração de campos.
   * Sempre um array — `[registro]` (length 1) no fluxo individual, aberto
   * via `onAbrirConflitoRestaurarCampos` (`EmailTable.tsx`, Etapa 6) quando
   * um registro clicado tem 2+ campos em `backup_dados`; vários registros
   * (length 2+) no fluxo em massa, aberto via
   * `onAbrirConflitoRestaurarCamposEmMassa` a partir da seleção múltipla
   * (dropdown de ações do cabeçalho, variante da seção 5 do planner).
   * `camposDisponiveis` é a lista repassada pela tabela — as chaves de
   * `backup_dados` do registro único, ou a união entre os selecionados —
   * exibida no modal como as opções de checkbox.
   */
  const [conflitoRestaurarCampos, setConflitoRestaurarCampos] = useState<{
    registros: EmailRecord[];
    camposDisponiveis: TCampoRestauravel[];
  } | null>(null);
  const [confirmacaoRestauracao, setConfirmacaoRestauracao] = useState<{
    registros: EmailRecord[];
    campos: TCampoRestauravel[];
  } | null>(null);
  const [erroSalvamento, setErroSalvamento] = useState<string | null>(null);
  const [statusSalvamento, setStatusSalvamento] = useState<'salvando' | 'salvo' | 'erro' | null>(null);
  const [idsRestaurados, setIdsRestaurados] = useState<Set<number>>(new Set());
  const feedbackRestauracaoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Título/corpo do e-mail (REFATORACAO-EMAIL-TITULO-CONTEUDO.md). Editado
  // via o modal aberto pelo dropdown do Header (Etapa 3); os botões de
  // copiar (Etapa 2) já leem este mesmo estado.
  const [email, setEmail] = useState<EmailConteudo>(dados.email);

  useEffect(() => {
    return () => {
      if (feedbackRestauracaoRef.current) clearTimeout(feedbackRestauracaoRef.current);
    };
  }, []);

  const contadores = useMemo(() => calcularContadores(registros), [registros]);
  const tituloPagina = dados.projeto?.trim() || slug;

  // Pipeline completo (seção 7): filtro por status -> busca -> ordenação ->
  // corte pela quantidade definida no input ao lado da searchbar. A
  // quantidade é sempre aplicada por último, sobre o resultado já
  // filtrado/buscado/ordenado — é o que a tabela renderiza e também a base
  // usada pelos botões de copiar (seção 7, itens 3-5).
  const registrosProcessados = useMemo(
    () => processarRegistros(registros, { statusFiltrados, termoBusca, ordenacao }),
    [registros, statusFiltrados, termoBusca, ordenacao]
  );

  /**
   * Resultado da busca isolada do filtro de status — usado apenas para
   * diagnosticar o estado "sem resultados" (abaixo): se a busca por termo,
   * ignorando o filtro de status ativo, encontra algo, o registro existe na
   * planilha e está apenas sendo ocultado pelo filtro. Nesse caso a
   * mensagem/CTA exibidos devem apontar para o filtro, não para a busca —
   * evita que o usuário conclua que o registro não existe quando ele só
   * está fora do recorte de status selecionado no momento.
   */
  const correspondentesSemFiltroDeStatus = useMemo(
    () => buscar(registros, termoBusca),
    [registros, termoBusca]
  );

  /** Rótulos dos status atualmente selecionados no filtro (para a mensagem de "sem resultados"). */
  const rotulosStatusFiltrados = useMemo(
    () =>
      CONTADOR_LABELS.filter((item) => item.key !== 'total' && statusFiltrados.has(item.key as TStatus)).map(
        (item) => item.label
      ),
    [statusFiltrados]
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
   * Persiste o `email` editado pelo modal "Editar e-mail" (Etapa 3),
   * chamado via `onSalvarEmail` do `Header`. Mesmo padrão de
   * `persistirRegistros`: grava imediatamente e reverte a UI se a gravação
   * falhar — mas aqui quem lança o erro é o próprio `EmailConteudoModal`
   * (que exibe a mensagem inline e mantém o modal aberto), então a reversão
   * de estado acontece aqui e o erro é relançado para o modal tratar.
   */
  async function persistirEmailConteudo(novoEmail: EmailConteudo) {
    const emailAnterior = email;
    setEmail(novoEmail);

    try {
      await salvarEmails(slug, { email: novoEmail, registros });
    } catch (erro) {
      setEmail(emailAnterior);
      throw erro;
    }
  }

  /**
   * Persiste imediatamente o array completo (seção 2.2). Em caso de falha,
   * reverte a UI para o estado anterior — não faz sentido manter um estado
   * que não foi de fato salvo em disco.
   */
  async function persistirRegistros(
    registrosAtualizados: EmailRecord[],
    options?: { preservarSelecao?: boolean }
  ): Promise<boolean> {
    const registrosAnteriores = registros;
    setRegistros(registrosAtualizados);
    setErroSalvamento(null);
    setStatusSalvamento('salvando');

    try {
      await salvarEmails(slug, { email, registros: registrosAtualizados });
      setStatusSalvamento('salvo');
      if (!options?.preservarSelecao) {
        setSelecionados(new Set());
      }
      return true;
    } catch {
      setRegistros(registrosAnteriores);
      setErroSalvamento('Não foi possível salvar a alteração. Tente novamente.');
      setStatusSalvamento('erro');
      return false;
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
        ? {
            ...registro,
            status: novoStatus,
            backup_dados: { ...registro.backup_dados, status: true },
            last_updated: agora,
          }
        : registro
    );
    await persistirRegistros(registrosAtualizados, { preservarSelecao: true });
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
        ? {
            ...registro,
            status: novoStatus,
            backup_dados: { ...registro.backup_dados, status: true },
            last_updated: agora,
          }
        : registro
    );
    await persistirRegistros(registrosAtualizados);
  }

  /**
   * Confirma a edição inline de `nome`/`email` de um registro (Etapa 4),
   * disparada por `onEditarCampo` (`EmailTable.tsx`). O registro recebido já
   * chega com `backup_dados` atualizado pela regra "primeira vez vence"
   * (`capturarEdicaoCampo`, Etapa 3) e com o novo valor validado (a
   * revalidação de e-mail com `isValidEmail` já aconteceu dentro da
   * própria tabela, antes desta chamada) — resta apenas persistir.
   *
   * Só a edição de `email` pode afetar o status (uma correção pode formar
   * ou desfazer um grupo de duplicados, inclusive de *outros* registros com
   * o mesmo e-mail — por isso o recálculo roda sobre o conjunto inteiro, não
   * só sobre o registro editado); edição de `nome` nunca aciona o
   * recálculo. `recalcularStatusAutomatico` já preserva sozinho os
   * registros com `backup_dados?.status` presente (seção 3), então não é
   * necessário nenhum condicional adicional aqui além do `campo === 'email'`.
   */
  async function handleEditarCampo(registroAtualizado: EmailRecord, campo: TCampoEditavel) {
    let registrosAtualizados = registros.map((registro) =>
      registro.id === registroAtualizado.id ? registroAtualizado : registro
    );

    if (campo === 'email') {
      registrosAtualizados = recalcularStatusAutomatico(registrosAtualizados);
    }

    await persistirRegistros(registrosAtualizados);
  }

  /**
   * Núcleo comum de persistência para qualquer restauração de campos — 1
   * registro (caminho direto da Etapa 6, ou modal individual) ou vários
   * (modal em massa). Substitui, no array completo, cada registro já
   * atualizado por `restaurarCampos` (Etapa 5) e recalcula o status
   * automático do conjunto inteiro quando `status` estiver entre os campos
  * restaurados (`status` ou `email`) — `restaurarCampos` opera sobre um único registro isolado,
   * sem acesso aos demais para recontar duplicados, então esse recálculo só
   * pode acontecer aqui, sobre o conjunto inteiro (mesmo motivo de
   * `handleEditarCampo`/`handleRestaurar`) — `recalcularStatusAutomatico`
   * já preserva sozinho qualquer outro registro com `backup_dados?.status`
   * ainda presente, inclusive os que não fizeram parte desta restauração.
   */
  async function aplicarRestauracaoDeCampos(
    registrosAtualizados: EmailRecord[],
    camposRestaurados: TCampoRestauravel[]
  ) {
    const mapaAtualizados = new Map(registrosAtualizados.map((registro) => [registro.id, registro]));
    let novosRegistros = registros.map((registro) => mapaAtualizados.get(registro.id) ?? registro);

    if (camposRestaurados.includes('status') || camposRestaurados.includes('email')) {
      novosRegistros = recalcularStatusAutomatico(novosRegistros);
    }

    return persistirRegistros(novosRegistros);
  }

  /**
   * Confirma a restauração direta (1 campo, sem modal) de um registro
   * (Etapa 6), disparada por `onRestaurarCampos` (`EmailTable.tsx`). O
   * registro recebido já chega pronto de `restaurarCampos` (Etapa 5): valor
   * de nome/email já reescrito literalmente e/ou `backup_dados.status` já
   * removido — só falta encaminhar para o núcleo comum de persistência.
   */
  async function handleRestaurarCampos(
    registroAtualizado: EmailRecord,
    camposRestaurados: TCampoRestauravel[]
  ) {
    setConfirmacaoRestauracao({ registros: [registroAtualizado], campos: camposRestaurados });
  }

  /**
   * Abre o modal de conflito de restauração no modo individual, disparado
   * por `onAbrirConflitoRestaurarCampos` (`EmailTable.tsx`, Etapa 6) quando
   * o registro clicado tem 2+ campos em `backup_dados`. Guarda o registro
   * (sempre como array de 1 item — mesmo formato do modo em massa, abaixo)
   * e a lista de campos disponíveis; a restauração de fato só acontece na
   * confirmação (`handleConfirmarConflitoRestaurarCampos`, abaixo).
   */
  function handleAbrirConflitoRestaurarCampos(
    registro: EmailRecord,
    camposDisponiveis: TCampoRestauravel[]
  ) {
    setConflitoRestaurarCampos({ registros: [registro], camposDisponiveis });
  }

  /**
   * Abre o modal de conflito de restauração no modo em massa (seção 5 do
   * planner), disparado por `onAbrirConflitoRestaurarCamposEmMassa`
   * (`EmailTable.tsx`) a partir do item "Restaurar campos" do dropdown de
   * ações do cabeçalho. `registrosSelecionados` já vem filtrado pela
   * tabela — só os que de fato têm algo em `backup_dados` — e
   * `camposDisponiveis` já é a união entre eles; este handler só guarda o
   * que recebeu.
   */
  function handleAbrirConflitoRestaurarCamposEmMassa(
    registrosSelecionados: EmailRecord[],
    camposDisponiveis: TCampoRestauravel[]
  ) {
    setConflitoRestaurarCampos({ registros: registrosSelecionados, camposDisponiveis });
  }

  /** Fecha o modal de restauração de campos sem alterar nada — mesmo padrão dos demais modais de conflito. */
  function handleCancelarConflitoRestaurarCampos() {
    setConflitoRestaurarCampos(null);
  }

  /**
   * Confirmação do `RestaurarCamposModal`, comum aos dois modos (individual
   * e em massa — a diferença já foi resolvida antes, em quantos registros
   * `conflitoRestaurarCampos.registros` guarda). Aplica `restaurarCampos`
   * (Etapa 5) a cada registro pendente com só os campos que o usuário
   * marcou — campos disponíveis mas deixados desmarcados permanecem
   * intocados em `backup_dados`, ainda protegidos, e o no-op por
   * registro/campo que não se aplica (tabela de exemplo da seção 5) já
   * acontece sozinho dentro de `restaurarCampos`, registro a registro — e
   * encaminha o lote já resolvido para o mesmo núcleo comum de persistência
   * do caminho direto.
   */
  async function handleConfirmarConflitoRestaurarCampos(camposEscolhidos: TCampoRestauravel[]) {
    if (!conflitoRestaurarCampos) return;
    const { registros: registrosPendentes } = conflitoRestaurarCampos;
    setConflitoRestaurarCampos(null);

    const registrosAtualizados = registrosPendentes.map((registro) =>
      restaurarCampos(registro, camposEscolhidos)
    );
    setConfirmacaoRestauracao({ registros: registrosAtualizados, campos: camposEscolhidos });
  }

  async function confirmarRestauracao() {
    if (!confirmacaoRestauracao) return;
    const { registros: registrosAtualizados } = confirmacaoRestauracao;
    setConfirmacaoRestauracao(null);
    const salvou = await aplicarRestauracaoDeCampos(registrosAtualizados, confirmacaoRestauracao.campos);
    if (!salvou) return;

    const ids = registrosAtualizados.map((registro) => registro.id);
    setIdsRestaurados(new Set(ids));
    if (feedbackRestauracaoRef.current) clearTimeout(feedbackRestauracaoRef.current);
    feedbackRestauracaoRef.current = setTimeout(() => setIdsRestaurados(new Set()), 1800);
  }

  /**
   * Deleta (logicamente) os registros indicados, sem passar pelo modal de
   * conflito. Depois de marcar os registros como "deletado", recalcula o
   * status automático de todo o conjunto (mesma lógica do `handleRestaurar`)
   * — necessário porque `groupSizeByEmail` (`EmailStatus.ts`) passa a
   * ignorar registros deletados na contagem de duplicados: se a exclusão
   * fez um grupo de duplicados sobrar com apenas 1 registro ativo, esse
   * registro deixa de ser "duplicado" e volta a ser "válido"/"inválido"
   * automaticamente, sem exigir nenhuma ação adicional de quem chamou esta
   * função.
   */
  async function deletarRegistros(ids: number[]) {
    const idsSet = new Set(ids);
    const agora = new Date().toISOString();
    const comStatusDeletado = registros.map((registro) =>
      idsSet.has(registro.id)
        ? {
            ...registro,
            status: 'deletado' as const,
            backup_dados: { ...registro.backup_dados, status: true },
            last_updated: agora,
          }
        : registro
    );
    const registrosAtualizados = recalcularStatusAutomatico(comStatusDeletado);
    await persistirRegistros(registrosAtualizados);
  }

  /**
   * Clique em "Confirmar envio" (Etapa 4): aplica o status "enviado" a
   * todos os registros selecionados. Reaproveita a mesma
   * `handleAtualizarStatus` já usada pelo select em massa do cabeçalho da
   * coluna Status — que já ignora registros "duplicado" dentre os
   * selecionados e já sabia lidar com "enviado" com segurança, mesmo antes
   * de "enviado" deixar de ser uma opção dos selects (Etapa 3). Não há
   * nenhuma restrição adicional aqui: ao contrário da exclusão, marcar como
   * "enviado" não exige modal de conflito.
   */
  function handleConfirmarEnvioClick() {
    void handleAtualizarStatus('enviado');
  }

  function handleLimparSelecaoClick() {
    setConfirmacaoLimparSelecao(true);
  }

  function handleConfirmarLimpezaSelecao() {
    setSelecionados(new Set());
    setConfirmacaoLimparSelecao(false);
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

  function handleCancelarDuplicados() {
    // Fecha o modal sem alterar nada — mesmo padrão do cancelar de conflito.
    setGrupoDuplicadoAberto(null);
  }

  /**
   * Confirmação do `DuplicadosConflitoModal`: deleta os ids marcados pelo
   * usuário e fecha o modal. A regra "nunca deixar o grupo chegar a 0" já
   * foi garantida pelo próprio modal (`confirmDisabled`); aqui só resta
   * disparar a exclusão — `deletarRegistros` cuida de recalcular o status
   * automático do grupo (ver comentário da função).
   */
  async function handleConfirmarDuplicados(idsParaDeletar: Set<number>) {
    setGrupoDuplicadoAberto(null);
    await deletarRegistros([...idsParaDeletar]);
  }

  return (
    <>
      <Header slug={slug} nome={tituloPagina} registros={registros} email={email} onSalvarEmail={persistirEmailConteudo} />

      <div className="emails-page">
        <div className="emails-page-header">
          <div className="emails-page-header-titulo">
            <h1>{tituloPagina}</h1>
          </div>
        </div>

        {statusSalvamento === 'salvando' && (
          <p className="status-salvamento" role="status" aria-live="polite">Salvando...</p>
        )}
        {statusSalvamento === 'salvo' && !erroSalvamento && (
          <p className="status-salvamento status-salvamento-sucesso" role="status" aria-live="polite">Salvo</p>
        )}
        {erroSalvamento && <p className="erro-salvamento" role="alert">{erroSalvamento}</p>}

        <EmailCounters
          contadores={contadores}
          statusFiltrados={statusFiltrados}
          onAlternarFiltro={alternarFiltro}
        />

        <EmailToolbar
          termoBusca={termoBusca}
          onTermoBuscaChange={setTermoBusca}
          quantidade={quantidade}
          onQuantidadeChange={(valor) => {
            setQuantidade(valor);
            setPaginaAtual(1);
          }}
          quantidadeMax={registrosProcessados.length}
          ordenacao={ordenacao}
          onOrdenacaoChange={setOrdenacao}
        />

        {registrosProcessados.length === 0 ? (
          correspondentesSemFiltroDeStatus.length > 0 ? (
            <div className="sem-resultados sem-resultados-filtrado">
              <p>
                Nenhum registro encontrado{termoBusca ? ` para "${termoBusca}"` : ''} com os status selecionados
                {rotulosStatusFiltrados.length > 0 ? `: ${rotulosStatusFiltrados.join(', ')}` : ''}.
              </p>
              <button type="button" className="botao-remover-filtros" onClick={() => alternarFiltro('todos')}>
                Remover filtros
              </button>
            </div>
          ) : (
            <p className="sem-resultados">
              Nenhum registro encontrado{termoBusca ? ` para "${termoBusca}"` : ''}.
            </p>
          )
        ) : (
          <>
            <div className="linha-selecao-paginacao">
              <div className="contador-selecao">
                <p className="contador-selecionados">{selecionados.size} selecionado(s)</p>
                {selecionados.size > 0 && (
                  <button
                    type="button"
                    className="botao-limpar-selecao"
                    aria-label="Desmarcar todos os registros selecionados"
                    title="Desmarcar todos os registros selecionados"
                    onClick={handleLimparSelecaoClick}
                  >
                    <IconeFechar />
                  </button>
                )}
              </div>
              <Paginacao paginacao={paginacao} onPaginaChange={setPaginaAtual} />
            </div>

            <EmailTable
              registros={registrosExibidos}
              selecionados={selecionados}
              onAlternarSelecao={alternarSelecao}
              onAlternarSelecaoTodos={alternarSelecaoTodos}
              selecionavel={selecionavel}
              onClicarDuplicado={handleClicarDuplicado}
              onAtualizarStatusIndividual={(id, status) => void handleAtualizarStatusIndividual(id, status)}
              onEditarCampo={(registro, campo) => void handleEditarCampo(registro, campo)}
              onRestaurarCampos={(registro, campos) => void handleRestaurarCampos(registro, campos)}
              idsRestaurados={idsRestaurados}
              onAbrirConflitoRestaurarCampos={handleAbrirConflitoRestaurarCampos}
              onAbrirConflitoRestaurarCamposEmMassa={handleAbrirConflitoRestaurarCamposEmMassa}
              onAtualizarStatusEmMassa={(status) => void handleAtualizarStatus(status)}
              todosSelecionadosDeletados={todosSelecionadosDeletados}
              onDeletar={handleDeletarClick}
              onConfirmarEnvio={handleConfirmarEnvioClick}
            />
          </>
        )}

        {conflitoExclusao && (
          <ConflitoExclusaoModal
            enviados={conflitoExclusao.enviados}
            aDeletar={conflitoExclusao.aDeletar}
            onCancelar={handleCancelarConflito}
            onConfirmar={(ids) => void handleConfirmarConflito(ids)}
          />
        )}

        {grupoDuplicadoAberto && (
          <DuplicadosConflitoModal
            registros={grupoDuplicadoAberto}
            onCancelar={handleCancelarDuplicados}
            onConfirmar={(ids) => void handleConfirmarDuplicados(ids)}
          />
        )}

        {conflitoRestaurarCampos && (
          <RestaurarCamposModal
            campos={conflitoRestaurarCampos.camposDisponiveis}
            quantidadeRegistros={conflitoRestaurarCampos.registros.length}
            onCancelar={handleCancelarConflitoRestaurarCampos}
            onConfirmar={(camposEscolhidos) => void handleConfirmarConflitoRestaurarCampos(camposEscolhidos)}
          />
        )}

        {confirmacaoRestauracao && (
          <ConfirmDialog
            ariaLabel="Confirmar restauração"
            titulo="Restaurar valores originais?"
            descricao={`${confirmacaoRestauracao.registros.length} registro(s) terão ${confirmacaoRestauracao.campos.length} campo(s) restaurado(s). Essa ação desfaz a correção manual.`}
            rotuloCancelar="Cancelar"
            rotuloConfirmar="Restaurar"
            onCancelar={() => setConfirmacaoRestauracao(null)}
            onConfirmar={() => void confirmarRestauracao()}
          />
        )}

        {confirmacaoLimparSelecao && (
          <ConfirmDialog
            ariaLabel="Confirmar limpeza da seleção"
            titulo="Desmarcar registros selecionados?"
            descricao={`${selecionados.size} registro(s) selecionado(s) serão desmarcados.`}
            rotuloCancelar="Cancelar"
            rotuloConfirmar="Desmarcar"
            onCancelar={() => setConfirmacaoLimparSelecao(false)}
            onConfirmar={handleConfirmarLimpezaSelecao}
          />
        )}
      </div>
    </>
  );
}