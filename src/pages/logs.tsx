import { useEffect, useMemo, useRef, useState } from 'react';

import { Header } from '../components/Header';
import { Dialog } from '../components/Dialog';
import { ExportarLogsModal } from '../components/ExportarLogsModal';
import { IconeBuscarPagina, IconeExportar, IconeLogs, IconePaginaAnterior, IconePaginaProxima } from '../components/Icons';
import { listarLogs, type FiltrosLogs } from '../services/logsApi';
import { ehTipoAcaoErro, type LinhaLog, type TipoAcao } from '../types/log';

/**
 * Rótulos de exibição de cada `TipoAcao` (taxonomia fechada da seção 4 do
 * planner) — só uma questão de apresentação da coluna "Ação"/modal de
 * detalhe desta tela; não substitui nem duplica a `mensagem` já montada
 * por `registrarLog` (Etapa 1), que continua sendo a única fonte da
 * coluna "Mensagem".
 */
const ROTULOS_ACAO: Record<TipoAcao, string> = {
  importar_planilha: 'Importar planilha',
  alterar_planilha: 'Alterar planilha',
  reimportar_planilha: 'Reimportar planilha',
  deletar_projeto: 'Deletar projeto',
  restaurar_projeto: 'Restaurar projeto',
  deletar_projeto_permanente: 'Deletar projeto (permanente)',
  exportar_planilha: 'Exportar planilha',
  alterar_registro: 'Alterar registro',
  restaurar_registro: 'Restaurar registro',
  editar_email: 'Editar e-mail',
  erro_servidor: 'Erro no servidor',
  erro_cliente: 'Erro no cliente',
};

/** Atraso do debounce da busca — evita um `GET /api/logs` a cada tecla digitada. */
const DEBOUNCE_BUSCA_MS = 350;

/** Formata `linha.data` (sempre UTC, seção 4) no fuso horário local de quem está vendo (seção 6). */
function formatarData(dataIso: string): string {
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return dataIso;
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Início do dia (00:00:00.000) de `dataLocal` ("AAAA-MM-DD", fuso local de quem está vendo), convertido para ISO/UTC. */
function inicioDoDiaLocalParaIso(dataLocal: string): string {
  return new Date(`${dataLocal}T00:00:00`).toISOString();
}

/** Fim do dia (23:59:59.999) de `dataLocal`, convertido para ISO/UTC. */
function fimDoDiaLocalParaIso(dataLocal: string): string {
  return new Date(`${dataLocal}T23:59:59.999`).toISOString();
}

/** `JSON.stringify` legível de `original`/`atual` para o modal de detalhe — `null` vira `null` (sem bloco a renderizar). */
function formatarJson(valor: Record<string, unknown> | null): string | null {
  if (!valor) return null;
  return JSON.stringify(valor, null, 2);
}

/**
 * Tela `/logs` (Demanda 9 — `LogsDeAlteracoes.md`, Etapa 6): ponto de
 * entrega visível de toda a demanda — sem ela, o log existe (Etapas 1-4)
 * mas ninguém consegue ver. Lista, com busca/filtro/paginação, os logs
 * gravados por `registrarLog` (Etapa 1) e lidos por `GET /api/logs`
 * (`vite.config.ts`, `handleListarLogs`, Etapa 5). Somente leitura — sem
 * nenhuma forma de editar, deletar ou desativar logs pela interface
 * (planner, seção 2, "Não cobre nesta fase").
 *
 * Acessada pelo botão "Visualizar Logs" no dropdown de configurações do
 * `Header` (já implementado) e pela rota fixa registrada em `App.tsx` (já
 * implementada) — nenhuma das duas depende de projeto aberto, por isso
 * `<Header />` é renderizado aqui sem nenhuma prop, igual à Home.
 *
 * Etapa 7: botão "Exportar Logs", sempre visível no cabeçalho da página
 * (seção 6 — "nunca por resultado de busca/filtro, nunca um log
 * específico"), abre `ExportarLogsModal` (mês/intervalo + formato), que
 * consome `GET /api/logs/export` (`services/logsApi.ts`, `exportarLogs`).
 */
export function Logs() {
  // Abas "Ações"/"Erros" (seção 6) — trocar de aba preserva busca, data e
  // página aplicadas (ver efeito de busca de dados abaixo, que depende de
  // `aba` mas não reseta `pagina` sozinho ao mudar).
  const [aba, setAba] = useState<'acoes' | 'erros'>('acoes');
  const [pagina, setPagina] = useState(1);

  // `buscaInput` é o valor digitado a cada tecla; `buscaAplicada` só troca
  // depois do debounce abaixo — é o que efetivamente vai para `GET
  // /api/logs` (via `filtros`).
  const [buscaInput, setBuscaInput] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [dataInicioLocal, setDataInicioLocal] = useState('');
  const [dataFimLocal, setDataFimLocal] = useState('');

  const [itens, setItens] = useState<LinhaLog[]>([]);
  const [temProximaPagina, setTemProximaPagina] = useState(false);
  const [logsAtivos, setLogsAtivos] = useState(true);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [logSelecionado, setLogSelecionado] = useState<LinhaLog | null>(null);
  const [exportarAberto, setExportarAberto] = useState(false);

  // Debounce da busca — só aplica (e assim dispara a requisição, via
  // `filtros` abaixo) 350ms depois da última tecla digitada. Qualquer
  // busca nova também volta para a página 1: resultado diferente, a
  // página em que o usuário estava pode nem existir mais no novo filtro.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setBuscaAplicada(buscaInput.trim());
      setPagina(1);
    }, DEBOUNCE_BUSCA_MS);
    return () => clearTimeout(timeout);
  }, [buscaInput]);

  const filtros = useMemo<FiltrosLogs>(() => {
    const filtro: FiltrosLogs = { aba, pagina };
    if (buscaAplicada) filtro.busca = buscaAplicada;
    if (dataInicioLocal) filtro.dataInicio = inicioDoDiaLocalParaIso(dataInicioLocal);
    // "Até" ausente com "De" presente = filtro de dia único (seção 6): usa
    // o fim do próprio dia de "De" como limite superior, sem exigir que o
    // usuário preencha os dois campos para consultar um único dia.
    if (dataFimLocal) {
      filtro.dataFim = fimDoDiaLocalParaIso(dataFimLocal);
    } else if (dataInicioLocal) {
      filtro.dataFim = fimDoDiaLocalParaIso(dataInicioLocal);
    }
    return filtro;
  }, [aba, pagina, buscaAplicada, dataInicioLocal, dataFimLocal]);

  // Descarta respostas de requisições que não são mais a mais recente
  // (ex.: usuário troca de aba/filtro antes da requisição anterior
  // voltar) — sem isso, uma resposta atrasada poderia sobrescrever um
  // estado mais novo já carregado.
  const requisicaoAtualRef = useRef(0);

  useEffect(() => {
    const idRequisicao = ++requisicaoAtualRef.current;
    setCarregando(true);
    setErro(null);

    listarLogs(filtros)
      .then((resposta) => {
        if (idRequisicao !== requisicaoAtualRef.current) return;
        setItens(resposta.itens);
        setTemProximaPagina(resposta.temProximaPagina);
        setLogsAtivos(resposta.logsAtivos);
      })
      .catch((erroRequisicao: unknown) => {
        if (idRequisicao !== requisicaoAtualRef.current) return;
        setItens([]);
        setErro(erroRequisicao instanceof Error ? erroRequisicao.message : 'Erro ao carregar logs.');
      })
      .finally(() => {
        if (idRequisicao === requisicaoAtualRef.current) setCarregando(false);
      });
  }, [filtros]);

  function alterarDataInicio(valor: string) {
    setDataInicioLocal(valor);
    setPagina(1);
  }

  function alterarDataFim(valor: string) {
    setDataFimLocal(valor);
    setPagina(1);
  }

  function limparFiltros() {
    setBuscaInput('');
    setBuscaAplicada('');
    setDataInicioLocal('');
    setDataFimLocal('');
    setPagina(1);
  }

  const temFiltroAtivo = Boolean(buscaAplicada || dataInicioLocal || dataFimLocal);

  // Narrowing explícito (comparação direta com o literal, não uma chamada
  // de type guard sobre `logSelecionado.acao`) — só assim o TypeScript
  // estreita `logSelecionado` de `LinhaLog` para `LinhaLogErro`, liberando
  // acesso a `origem`/`detalhe` (que só existem nesse ramo da união).
  const detalheDeErro =
    logSelecionado && (logSelecionado.acao === 'erro_servidor' || logSelecionado.acao === 'erro_cliente')
      ? logSelecionado
      : null;

  return (
    <>
      <Header />
      <div className="logs-page">
        <div className="logs-page-header">
          <div className="logs-page-header-titulo">
            <h1>
              <IconeLogs /> Logs de alterações
            </h1>
            <p className="logs-page-header-subtitulo">
              Rastro somente leitura de tudo que aconteceu no sistema — sem edição, exclusão ou desativação pela interface.
            </p>
          </div>
          <button type="button" className="logs-exportar-btn" onClick={() => setExportarAberto(true)}>
            <IconeExportar /> Exportar Logs
          </button>
        </div>

        {!logsAtivos && (
          <p className="logs-banner-desativado" role="status">
            Registro de logs desativado neste ambiente (<code>LOGS_ATIVOS=false</code>) — nenhuma linha nova está sendo gravada.
          </p>
        )}

        <div className="logs-abas" role="tablist" aria-label="Tipo de log">
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'acoes'}
            className={`logs-aba-btn${aba === 'acoes' ? ' ativo' : ''}`}
            onClick={() => setAba('acoes')}
          >
            Ações
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'erros'}
            className={`logs-aba-btn${aba === 'erros' ? ' ativo' : ''}`}
            onClick={() => setAba('erros')}
          >
            Erros
          </button>
        </div>

        <div className="logs-filtros">
          <div className="search-input-wrapper">
            <IconeBuscarPagina className="search-input-icone" />
            <input
              type="text"
              className="search-input"
              placeholder="Buscar por nome, tipo, projeto, registro ou id da alteração…"
              value={buscaInput}
              onChange={(e) => setBuscaInput(e.target.value)}
              aria-label="Buscar logs"
            />
            {buscaInput && (
              <button
                type="button"
                className="search-input-limpar"
                onClick={() => setBuscaInput('')}
                aria-label="Limpar busca"
              >
                ×
              </button>
            )}
          </div>

          <div className="logs-filtro-datas">
            <label className="logs-filtro-data-campo">
              <span>De</span>
              <input
                type="date"
                value={dataInicioLocal}
                onChange={(e) => alterarDataInicio(e.target.value)}
                max={dataFimLocal || undefined}
              />
            </label>
            <label className="logs-filtro-data-campo">
              <span>Até</span>
              <input
                type="date"
                value={dataFimLocal}
                onChange={(e) => alterarDataFim(e.target.value)}
                min={dataInicioLocal || undefined}
              />
            </label>

            {temFiltroAtivo && (
              <button type="button" className="botao-remover-filtros" onClick={limparFiltros}>
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {erro ? (
          <p className="tabela-vazia logs-tabela-erro">Erro ao carregar logs.</p>
        ) : !carregando && itens.length === 0 ? (
          <p className="tabela-vazia">Nenhum log encontrado.</p>
        ) : (
          <table className="email-table logs-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Ação</th>
                <th>Projeto</th>
                <th>Mensagem</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((linha) => (
                <tr
                  key={linha.id}
                  className="logs-table-linha"
                  onClick={() => setLogSelecionado(linha)}
                  tabIndex={0}
                  role="button"
                  aria-label="Ver detalhe do log"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setLogSelecionado(linha);
                  }}
                >
                  <td className="logs-table-data">{formatarData(linha.data)}</td>
                  <td>
                    <span className={`logs-acao-badge${ehTipoAcaoErro(linha.acao) ? ' logs-acao-badge-erro' : ''}`}>
                      {ROTULOS_ACAO[linha.acao]}
                    </span>
                  </td>
                  <td>{linha.projeto ?? '—'}</td>
                  <td className="logs-table-mensagem">{linha.mensagem}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/*
         * Paginação própria, não o componente `Paginacao` reaproveitado no
         * resto do sistema: `Paginacao` precisa de `totalPaginas` conhecido
         * (botão de última página, input "ir para"), mas `GET /api/logs`
         * (Etapa 5) deliberadamente não conta o total de linhas — só
         * informa `temProximaPagina` via early-exit da leitura sequencial,
         * para não precisar ler `data/logs/` inteiro a cada request (seção
         * 6 do planner). Anterior/próxima com base só nesse booleano é a
         * navegação possível sem esse total.
         */}
        <div className="logs-paginacao">
          <button
            type="button"
            className="paginacao-btn"
            onClick={() => setPagina((atual) => Math.max(1, atual - 1))}
            disabled={pagina <= 1 || carregando}
            aria-label="Página anterior"
          >
            <IconePaginaAnterior />
          </button>
          <span className="logs-paginacao-atual">Página {pagina}</span>
          <button
            type="button"
            className="paginacao-btn"
            onClick={() => setPagina((atual) => atual + 1)}
            disabled={!temProximaPagina || carregando}
            aria-label="Próxima página"
          >
            <IconePaginaProxima />
          </button>
        </div>
      </div>

      <Dialog
        isOpen={logSelecionado !== null}
        onClose={() => setLogSelecionado(null)}
        title="Detalhe do log"
        className="modal-detalhe-log dialog-rolavel"
      >
        {logSelecionado && (
          <dl className="logs-detalhe-lista">
            <div className="logs-detalhe-item">
              <dt>ID</dt>
              <dd>{logSelecionado.id}</dd>
            </div>
            <div className="logs-detalhe-item">
              <dt>Data</dt>
              <dd>{formatarData(logSelecionado.data)}</dd>
            </div>
            <div className="logs-detalhe-item">
              <dt>Ação</dt>
              <dd>{ROTULOS_ACAO[logSelecionado.acao]}</dd>
            </div>
            <div className="logs-detalhe-item">
              <dt>Projeto</dt>
              <dd>{logSelecionado.projeto ?? '—'}</dd>
            </div>
            <div className="logs-detalhe-item">
              <dt>Registro</dt>
              <dd>{logSelecionado.registroId ?? '—'}</dd>
            </div>
            <div className="logs-detalhe-item">
              <dt>Quantidade</dt>
              <dd>{logSelecionado.quantidade ?? '—'}</dd>
            </div>
            <div className="logs-detalhe-item">
              <dt>Mensagem</dt>
              <dd>{logSelecionado.mensagem}</dd>
            </div>

            {formatarJson(logSelecionado.original) && (
              <div className="logs-detalhe-item logs-detalhe-item-bloco">
                <dt>Original</dt>
                <dd>
                  <pre className="logs-detalhe-pre">{formatarJson(logSelecionado.original)}</pre>
                </dd>
              </div>
            )}

            {formatarJson(logSelecionado.atual) && (
              <div className="logs-detalhe-item logs-detalhe-item-bloco">
                <dt>Atual</dt>
                <dd>
                  <pre className="logs-detalhe-pre">{formatarJson(logSelecionado.atual)}</pre>
                </dd>
              </div>
            )}

            {detalheDeErro && (
              <div className="logs-detalhe-item">
                <dt>Origem</dt>
                <dd>{detalheDeErro.origem}</dd>
              </div>
            )}

            {detalheDeErro?.detalhe && (
              <div className="logs-detalhe-item logs-detalhe-item-bloco">
                <dt>Detalhe</dt>
                <dd>
                  <pre className="logs-detalhe-pre">{detalheDeErro.detalhe}</pre>
                </dd>
              </div>
            )}
          </dl>
        )}
      </Dialog>

      {exportarAberto && <ExportarLogsModal onFechar={() => setExportarAberto(false)} />}
    </>
  );
}
