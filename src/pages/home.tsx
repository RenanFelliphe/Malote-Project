import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Header } from '../components/Header';
import { OrdenacaoPrioridade } from '../components/OrdenacaoPrioridade';
import { CheckboxCustomizado } from '../components/CheckboxCustomizado';
import { ConfirmDialog } from '../components/ConfirmDialog';
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

export function Home() {
  const inputArquivoRef = useRef<HTMLInputElement | null>(null);
  // Arquivo selecionado no explorador do SO — sua presença é o que
  // controla a exibição do assistente de importação (ImportWizardModal).
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  // Hierarquia de ordenação dos cards de projeto (Etapa 7, seção 3.5) —
  // padrão: alfabética primeiro, conforme ORDENACAO_HOME_PADRAO.
  const [ordenacao, setOrdenacao] = useState<TOrdenacaoHome>(ORDENACAO_HOME_PADRAO);
  const [termoBuscaProjeto, setTermoBuscaProjeto] = useState('');
  // Modo de seleção múltipla para exclusão em lote (Etapa 4 de
  // implementacaoDelecao.md), ativado pelo item "Deletar planilha" do
  // Header via `onAtivarSelecaoDelecao` — só passado aqui, nunca pela
  // página de um projeto específico (Etapa 3).
  const [modoSelecaoAtivo, setModoSelecaoAtivo] = useState(false);
  const [slugsSelecionados, setSlugsSelecionados] = useState<Set<string>>(new Set());
  // Confirmação da exclusão em lote (Etapa 5 de implementacaoDelecao.md).
  const [confirmarLoteAberto, setConfirmarLoteAberto] = useState(false);
  const [erroDelecaoLote, setErroDelecaoLote] = useState<string | null>(null);
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

  /** Chamado pelo Header (Etapa 4) — entra no modo de seleção, sempre com seleção vazia. */
  function ativarModoSelecao() {
    setModoSelecaoAtivo(true);
    setSlugsSelecionados(new Set());
  }

  /** "Cancelar" da barra de ação — sai do modo de seleção sem deletar nada. */
  function cancelarModoSelecao() {
    setModoSelecaoAtivo(false);
    setSlugsSelecionados(new Set());
    setConfirmarLoteAberto(false);
    setErroDelecaoLote(null);
  }

  function alternarSelecaoProjeto(slug: string) {
    setSlugsSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(slug)) {
        novo.delete(slug);
      } else {
        novo.add(slug);
      }
      return novo;
    });
  }

  /** Abre a confirmação de exclusão em lote (Etapa 5), disparada pelo botão "Deletar" da barra de ação. */
  function abrirConfirmarLote() {
    setErroDelecaoLote(null);
    setConfirmarLoteAberto(true);
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
      const resultados = await deletarProjetos([...slugsSelecionados]);
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
      <Header onAtivarSelecaoDelecao={ativarModoSelecao} />

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
              if (!modoSelecaoAtivo) {
                return (
                  <Link key={projeto.slug} to={`/${projeto.slug}`} className="card-pagina">
                    <span className="card-pagina-icone">
                      <IconePlanilha />
                    </span>
                    <span className="card-pagina-titulo">{projeto.dados.projeto}</span>
                  </Link>
                );
              }

              const selecionado = slugsSelecionados.has(projeto.slug);
              return (
                <div
                  key={projeto.slug}
                  className={`card-pagina card-pagina-selecionavel ${selecionado ? 'selecionado' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selecionado}
                  onClick={() => alternarSelecaoProjeto(projeto.slug)}
                  onKeyDown={(evento) => {
                    if (evento.key === 'Enter' || evento.key === ' ') {
                      evento.preventDefault();
                      alternarSelecaoProjeto(projeto.slug);
                    }
                  }}
                >
                  <span className="card-pagina-checkbox" onClick={(evento) => evento.stopPropagation()}>
                    <CheckboxCustomizado
                      checked={selecionado}
                      onChange={() => alternarSelecaoProjeto(projeto.slug)}
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

      {modoSelecaoAtivo && (
        <div className="barra-selecao-delecao" role="toolbar" aria-label="Ações de exclusão de planilhas">
          <p className="barra-selecao-delecao-contagem">{slugsSelecionados.size} selecionada(s)</p>
          <div className="barra-selecao-delecao-acoes">
            <button type="button" className="dialog-botao-cancelar" onClick={cancelarModoSelecao}>
              Cancelar
            </button>
            <button
              type="button"
              className="dialog-botao-deletar"
              onClick={abrirConfirmarLote}
              disabled={slugsSelecionados.size === 0}
            >
              Deletar
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
            slugsSelecionados.size === 1
              ? 'Tem certeza que deseja deletar a planilha selecionada? Essa ação não pode ser desfeita!'
              : `Tem certeza que deseja deletar todas as ${slugsSelecionados.size} planilhas selecionadas? Essa ação não pode ser desfeita!`
          }
          rotuloCancelar="Cancelar"
          rotuloConfirmar="Deletar"
          onCancelar={() => setConfirmarLoteAberto(false)}
          onConfirmar={() => void handleConfirmarDelecaoLote()}
        />
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