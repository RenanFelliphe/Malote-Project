import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Header } from '../components/Header';
import { OrdenacaoPrioridade } from '../components/OrdenacaoPrioridade';
import { CheckboxCustomizado } from '../components/CheckboxCustomizado';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ExportarModal, type PlanilhaParaExportar } from '../components/ExportarModal';
import { LixeiraSidebar } from '../components/LixeiraSidebar';
import { IconeBuscarPagina, IconeImportar, IconeLixeira, IconePlanilha } from '../components/Icons';
import { ImportWizardModal } from '../components/import/ImportWizardModal';
import { deletarProjetos } from '../services/projetosApi';
import { PROJETOS } from '../data/projetos';
import {
  CRITERIO_ORDENACAO_HOME_LABELS,
  ORDENACAO_HOME_PADRAO,
  ordenarProjetos,
  type TOrdenacaoHome,
} from './utils/HomeOrdenacao';
import { useSelecaoMultipla } from './utils/useSelecaoMultipla';

export function Home() {
  const inputArquivoRef = useRef<HTMLInputElement | null>(null);
  // Arquivo selecionado no explorador do SO — sua presença é o que
  // controla a exibição do assistente de importação (ImportWizardModal).
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  // Hierarquia de ordenação dos cards de projeto (Etapa 7, seção 3.5) —
  // padrão: alfabética primeiro, conforme ORDENACAO_HOME_PADRAO.
  const [ordenacao, setOrdenacao] = useState<TOrdenacaoHome>(ORDENACAO_HOME_PADRAO);
  const [termoBuscaProjeto, setTermoBuscaProjeto] = useState('');
  // Modo de seleção múltipla, ativado pelo Header via `onAtivarSelecaoDelecao`
  // (e, a partir da Etapa 2 de implementacaoExportacaoHome.md, também por
  // `onAtivarSelecaoExportacao`) — só passado aqui, nunca pela página de um
  // projeto específico (Etapa 3 de implementacaoDelecao.md). A lógica em si
  // (quais ids estão marcados) vive em `useSelecaoMultipla` (Etapa 0 de
  // implementacaoExportacaoHome.md), reaproveitável por qualquer ação em
  // lote sobre os cards da Home.
  const selecao = useSelecaoMultipla();
  // Ação que o modo de seleção vai concluir quando o usuário clicar em
  // "Concluir" na barra genérica (Etapa 2 de implementacaoExportacaoHome.md)
  // — definida no momento em que a seleção é ativada (`ativarSelecaoDelecao`
  // / `ativarSelecaoExportacao`, chamadas pelo Header) e usada só para
  // decidir o que `handleConcluirSelecao` dispara; a barra em si não muda
  // de rótulo conforme a ação.
  const [acaoPendente, setAcaoPendente] = useState<'deletar' | 'exportar' | null>(null);
  // Confirmação da exclusão em lote (Etapa 5 de implementacaoDelecao.md).
  const [confirmarLoteAberto, setConfirmarLoteAberto] = useState(false);
  const [erroDelecaoLote, setErroDelecaoLote] = useState<string | null>(null);
  // Exportação em lote (Etapa 2 de implementacaoExportacaoHome.md). A lista
  // de planilhas selecionadas é montada em `abrirExportacaoLote` a partir de
  // `PROJETOS` (slug + nome de exibição + registros) e passada inteira ao
  // `ExportarModal`, que desde a Etapa 3 aceita múltiplas planilhas de uma
  // vez (prop `planilhas`).
  const [planilhasParaExportar, setPlanilhasParaExportar] = useState<PlanilhaParaExportar[]>([]);
  const [modalExportarAberto, setModalExportarAberto] = useState(false);
  // Sidebar da Lixeira (Etapa 7 de implementacaoDelecao.md) — só a
  // abertura/fechamento e a contagem para o badge vivem aqui; a lista em si
  // é buscada e mantida dentro do próprio `LixeiraSidebar`.
  const [sidebarLixeiraAberta, setSidebarLixeiraAberta] = useState(false);
  const [contagemLixeira, setContagemLixeira] = useState(0);

  const projetosOrdenados = ordenarProjetos(PROJETOS, ordenacao);
  const projetosVisiveis = projetosOrdenados.filter((projeto) => {
    const termo = termoBuscaProjeto.trim().toLowerCase();
    if (!termo) return true;

    const nome = projeto.dados.projeto.toLowerCase();
    const slug = projeto.slug.toLowerCase();
    return nome.includes(termo) || slug.includes(termo);
  });

  function abrirSeletorDeArquivo() {
    inputArquivoRef.current?.click();
  }

  function handleArquivoEscolhido(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0] ?? null;
    setArquivoSelecionado(arquivo);
    // Permite selecionar o mesmo arquivo novamente em seguida (ex.: depois
    // de cancelar uma importação), já que o evento "change" só dispara de
    // novo se o valor do input for resetado.
    evento.target.value = '';
  }

  function fecharAssistenteImportacao() {
    setArquivoSelecionado(null);
  }

  /**
   * "Cancelar" da barra de ação — sai do modo de seleção sem concluir a
   * ação pendente (deletar ou exportar), qualquer que ela seja.
   */
  function cancelarModoSelecao() {
    selecao.cancelar();
    setAcaoPendente(null);
    setConfirmarLoteAberto(false);
    setErroDelecaoLote(null);
    setModalExportarAberto(false);
    setPlanilhasParaExportar([]);
  }

  /**
   * Entra no modo de seleção para deletar em lote (Etapa 4 de
   * implementacaoDelecao.md), passada ao Header via `onAtivarSelecaoDelecao`.
   */
  function ativarSelecaoDelecao() {
    setAcaoPendente('deletar');
    selecao.ativar();
  }

  /**
   * Entra no modo de seleção para exportar em lote (Etapa 1 de
   * implementacaoExportacaoHome.md), passada ao Header via
   * `onAtivarSelecaoExportacao`.
   */
  function ativarSelecaoExportacao() {
    setAcaoPendente('exportar');
    selecao.ativar();
  }

  /** Abre a confirmação de exclusão em lote (Etapa 5), disparada por "Concluir" quando `acaoPendente === 'deletar'`. */
  function abrirConfirmarLote() {
    setErroDelecaoLote(null);
    setConfirmarLoteAberto(true);
  }

  /**
   * Monta a lista de planilhas selecionadas (slug + nome de exibição +
   * registros, todos já disponíveis em `PROJETOS`) e abre o `ExportarModal`,
   * disparada por "Concluir" quando `acaoPendente === 'exportar'`.
   */
  function abrirExportacaoLote() {
    const planilhas = PROJETOS.filter((projeto) => selecao.selecionados.has(projeto.slug)).map(
      (projeto) => ({
        slug: projeto.slug,
        nome: projeto.dados.projeto,
        registros: projeto.dados.registros,
      })
    );
    setPlanilhasParaExportar(planilhas);
    setModalExportarAberto(true);
  }

  /**
   * "Concluir" da barra de ação genérica — dispara a ação que ativou o
   * modo de seleção, decidida por `acaoPendente`. O rótulo do botão nunca
   * muda entre ações (seção 2 do plano).
   */
  function handleConcluirSelecao() {
    if (acaoPendente === 'deletar') {
      abrirConfirmarLote();
    } else if (acaoPendente === 'exportar') {
      abrirExportacaoLote();
    }
  }

  /**
   * Fecha o `ExportarModal` aberto a partir da seleção em lote. Sai do modo
   * de seleção junto — ao contrário da exclusão (que recarrega a página em
   * sucesso e reseta tudo de qualquer forma), a exportação não navega nem
   * recarrega, então precisa encerrar a seleção explicitamente aqui.
   */
  function fecharModalExportarLote() {
    cancelarModoSelecao();
  }

  /**
   * Confirma a exclusão em lote: reaproveita `deletarProjetos` (mesmo
   * serviço da Etapa 3), agora com todos os slugs selecionados de uma vez
   * — o endpoint já é feito para lote desde a Etapa 2. Em sucesso, recarrega
   * a página inteira (não só um re-render): `PROJETOS`
   * (`src/data/projetos.ts`) vem de um `import.meta.glob` resolvido uma
   * única vez no carregamento do módulo, então só um reload reflete a
   * lista de projetos sem os que acabaram de ir para a lixeira.
   */
  async function handleConfirmarDelecaoLote() {
    setConfirmarLoteAberto(false);

    try {
      const resultados = await deletarProjetos([...selecao.selecionados]);
      const primeiraFalha = resultados.find((resultado) => !resultado.ok);
      if (primeiraFalha) {
        throw new Error(primeiraFalha.error ?? 'Não foi possível deletar uma ou mais planilhas selecionadas.');
      }
      window.location.reload();
    } catch (erro) {
      setErroDelecaoLote(
        erro instanceof Error ? erro.message : 'Não foi possível deletar as planilhas selecionadas.'
      );
    }
  }

  return (
    <>
      <Header onAtivarSelecaoDelecao={ativarSelecaoDelecao} onAtivarSelecaoExportacao={ativarSelecaoExportacao} />

      <div className="home-page">
        <div className="home-page-header">
          <div className="home-page-header-titulo">
            <h1>Minhas planilhas</h1>
            <p className="home-page-header-subtitulo">
              Importe e acesse suas planilhas processadas.
            </p>
          </div>
        </div>

        <div className="home-page-acoes">
          <div className="importar-planilha">
            <input ref={inputArquivoRef} type="file" accept=".csv,.xlsx" className="input-arquivo-escondido" onChange={handleArquivoEscolhido} />
            <button type="button" className="botao-importar-planilha" onClick={abrirSeletorDeArquivo}>
              <IconeImportar />
              Importar planilha
            </button>
          </div>

          <div className="search-input-wrapper">
            <label htmlFor="buscar-projeto" className="sr-only">
              Pesquisar projeto
            </label>
            <IconeBuscarPagina className="search-input-icone" />
            <input
              id="buscar-projeto"
              type="text"
              className="search-input"
              placeholder="Pesquisar projeto"
              value={termoBuscaProjeto}
              onChange={(evento) => setTermoBuscaProjeto(evento.target.value)}
            />
            {termoBuscaProjeto && (
              <button
                type="button"
                className="search-input-limpar"
                aria-label="Limpar pesquisa"
                onClick={() => setTermoBuscaProjeto('')}
              >
                ×
              </button>
            )}
          </div>

          {projetosOrdenados.length > 0 && (
            <div className="ordenacao">
              <span className="ordenacao-rotulo">Ordenar por:</span>
              <OrdenacaoPrioridade
                ordenacao={ordenacao}
                labels={CRITERIO_ORDENACAO_HOME_LABELS}
                onOrdenacaoChange={setOrdenacao}
              />
            </div>
          )}
        </div>

        <div className="grid-cards-paginas">
          {projetosVisiveis.length === 0 ? (
            <p className="sem-resultados">Nenhum projeto encontrado para a busca informada.</p>
          ) : (
            projetosVisiveis.map((projeto) => {
              if (!selecao.ativo) {
                return (
                  <Link key={projeto.slug} to={`/${projeto.slug}`} className="card-pagina">
                    <span className="card-pagina-icone">
                      <IconePlanilha />
                    </span>
                    <span className="card-pagina-titulo">{projeto.dados.projeto}</span>
                  </Link>
                );
              }

              const selecionado = selecao.selecionados.has(projeto.slug);
              return (
                <div
                  key={projeto.slug}
                  className={`card-pagina card-pagina-selecionavel ${selecionado ? 'selecionado' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selecionado}
                  onClick={() => selecao.alternar(projeto.slug)}
                  onKeyDown={(evento) => {
                    if (evento.key === 'Enter' || evento.key === ' ') {
                      evento.preventDefault();
                      selecao.alternar(projeto.slug);
                    }
                  }}
                >
                  <span className="card-pagina-checkbox" onClick={(evento) => evento.stopPropagation()}>
                    <CheckboxCustomizado
                      checked={selecionado}
                      onChange={() => selecao.alternar(projeto.slug)}
                    >
                      <span className="sr-only">Selecionar planilha {projeto.dados.projeto}</span>
                    </CheckboxCustomizado>
                  </span>
                  <span className="card-pagina-icone">
                    <IconePlanilha />
                  </span>
                  <span className="card-pagina-titulo">{projeto.dados.projeto}</span>
                </div>
              );
            })
          )}
        </div>

        {arquivoSelecionado && (
          <ImportWizardModal arquivo={arquivoSelecionado} onFechar={fecharAssistenteImportacao} />
        )}
      </div>

      {selecao.ativo && (
        <div className="barra-selecao-lote" role="toolbar" aria-label="Ações em lote sobre planilhas selecionadas">
          <p className="barra-selecao-lote-contagem">{selecao.selecionados.size} selecionada(s)</p>
          <div className="barra-selecao-lote-acoes">
            <button type="button" className="dialog-botao-cancelar" onClick={cancelarModoSelecao}>
              Cancelar
            </button>
            <button
              type="button"
              className="dialog-botao-primario"
              onClick={handleConcluirSelecao}
              disabled={selecao.selecionados.size === 0}
            >
              Concluir
            </button>
          </div>
        </div>
      )}

      {erroDelecaoLote && <p className="erro-salvamento erro-selecao-lote">{erroDelecaoLote}</p>}

      {confirmarLoteAberto && (
        <ConfirmDialog
          ariaLabel="Confirmar exclusão das planilhas selecionadas"
          titulo="Deletar planilhas selecionadas"
          descricao={
            selecao.selecionados.size === 1
              ? 'Tem certeza que deseja deletar a planilha selecionada? Essa ação não pode ser desfeita!'
              : `Tem certeza que deseja deletar todas as ${selecao.selecionados.size} planilhas selecionadas? Essa ação não pode ser desfeita!`
          }
          rotuloCancelar="Cancelar"
          rotuloConfirmar="Deletar"
          onCancelar={() => setConfirmarLoteAberto(false)}
          onConfirmar={() => void handleConfirmarDelecaoLote()}
        />
      )}

      {modalExportarAberto && (
        <ExportarModal planilhas={planilhasParaExportar} onFechar={fecharModalExportarLote} />
      )}

      {/*
        Botão flutuante da Lixeira (Etapa 7 de implementacaoDelecao.md),
        canto inferior esquerdo — espelha `EmojiPickerFlutuante` (que fica
        no inferior direito, ancorado ao modal de e-mail), mas aqui como
        `position: fixed` em relação à viewport, já que não há um
        container "pai" com position: relative fazendo esse papel na Home.
      */}
      <div className="lixeira-flutuante">
        <button
          type="button"
          className="lixeira-flutuante-gatilho"
          onClick={() => setSidebarLixeiraAberta((atual) => !atual)}
          title="Lixeira"
          aria-label={`Abrir lixeira${contagemLixeira > 0 ? ` (${contagemLixeira} planilha(s))` : ''}`}
        >
          <IconeLixeira />
          {contagemLixeira > 0 && (
            <span className="lixeira-flutuante-badge" aria-hidden="true">
              {contagemLixeira > 99 ? '99+' : contagemLixeira}
            </span>
          )}
        </button>
      </div>

      <LixeiraSidebar
        aberto={sidebarLixeiraAberta}
        onFechar={() => setSidebarLixeiraAberta(false)}
        onContagemAtualizada={setContagemLixeira}
      />
    </>
  );
}