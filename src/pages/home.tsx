import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Header } from '../components/Header';
import { OrdenacaoPrioridade } from '../components/OrdenacaoPrioridade';
import { CheckboxCustomizado } from '../components/CheckboxCustomizado';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ExportarModal, type PlanilhaParaExportar } from '../components/ExportarModal';
import { ImportarProjetosModal } from '../components/ImportarProjetosModal';
import { LixeiraSidebar } from '../components/LixeiraSidebar';
import {
  IconeBuscarPagina,
  IconeImportar,
  IconeLixeira,
  IconePlanilha,
  IconeSetaBaixo,
  IconeSetaCima,
} from '../components/Icons';
import { ImportWizardModal } from '../components/import/ImportWizardModal';
import { deletarProjetos } from '../services/projetosApi';
import { exportarProjetos } from '../services/pacoteProjetosApi';
import { PROJETOS } from '../data/projetos';
import {
  CRITERIO_ORDENACAO_HOME_LABELS,
  ORDENACAO_HOME_PADRAO,
  ordenarProjetos,
  type TOrdenacaoHome,
} from './utils/HomeOrdenacao';
import { useSelecaoMultipla } from './utils/useSelecaoMultipla';

/**
 * Ícone "i" de informação usado pelo dropdown "Importar" (Etapa 5 de
 * `ExportacaoImportacaoDeProjetos.md`, Demanda 11, seção 2) — definido
 * localmente em vez de em `components/Icons.tsx` porque esse arquivo não
 * veio no ZIP desta sessão (não está listado como Fonte da Etapa 5);
 * seguindo a convenção já usada no resto do projeto (um ícone por
 * componente em `Icons.tsx`), o ideal é mover este SVG para lá quando o
 * arquivo completo estiver disponível — pendência anotada nas notas de
 * execução.
 */
function IconeInformacao() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <line x1="8" y1="7" x2="8" y2="11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="4.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

/**
 * Botão "[i]" com resumo em `title` (tooltip nativo no hover) + texto
 * revelado no clique (para quem usa teclado/toque, sem depender só de
 * `title`) — usado por cada opção do dropdown "Importar" (seção 2 do
 * plano: "no hover ou clique resume o que cada importação faz").
 */
function InfoTooltip({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [aberto, setAberto] = useState(false);

  return (
    <span className="importar-dropdown-item-info">
      <button
        type="button"
        className="importar-dropdown-info-botao"
        title={texto}
        aria-label={rotulo}
        aria-expanded={aberto}
        onClick={(evento) => {
          evento.stopPropagation();
          setAberto((atual) => !atual);
        }}
      >
        <IconeInformacao />
      </button>
      {aberto && <span className="importar-dropdown-info-texto">{texto}</span>}
    </span>
  );
}

export function Home() {
  const inputArquivoRef = useRef<HTMLInputElement | null>(null);
  // Arquivo selecionado no explorador do SO — sua presença é o que
  // controla a exibição do assistente de importação (ImportWizardModal).
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  // "Importar Projetos" (Etapa 5 de ExportacaoImportacaoDeProjetos.md,
  // Demanda 11) — mesmo papel de `inputArquivoRef`/`arquivoSelecionado`
  // acima, mas para o seletor de pacote `.zip`; sua presença controla a
  // exibição do `ImportarProjetosModal` (preview do pacote).
  const inputArquivoProjetosRef = useRef<HTMLInputElement | null>(null);
  const [arquivoProjetosSelecionado, setArquivoProjetosSelecionado] = useState<File | null>(null);
  // Dropdown "Importar" da Home (Etapa 5 de ExportacaoImportacaoDeProjetos.md)
  // — botão "Importar planilha" virou um dropdown com as 2 opções
  // ("Importar Planilha" e o novo "Importar Projetos"), mesmo padrão de
  // abrir/fechar por clique fora e Esc já usado pelo dropdown de
  // configurações do Header.tsx, replicado aqui de forma independente (sem
  // reaproveitar nada do Header — dropdowns de páginas diferentes).
  const [dropdownImportarAberto, setDropdownImportarAberto] = useState(false);
  const dropdownImportarRef = useRef<HTMLDivElement | null>(null);
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
  const [acaoPendente, setAcaoPendente] = useState<'deletar' | 'exportar' | 'exportar-projetos' | null>(null);
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
  // Exportação de pacote de projetos em lote (Etapa 4 de
  // ExportacaoImportacaoDeProjetos.md, Demanda 11) — ao contrário da
  // exportação de planilha (que abre `ExportarModal`), o pacote `.zip` é
  // baixado direto pelo serviço (`exportarProjetos`), sem modal
  // intermediário; erro de rede fica aqui, mesmo padrão de `erroDelecaoLote`.
  const [erroExportacaoProjetosLote, setErroExportacaoProjetosLote] = useState<string | null>(null);
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

  /** Abre o seletor de arquivo do pacote `.zip` — item "Importar Projetos" do dropdown. */
  function abrirSeletorDeArquivoProjetos() {
    inputArquivoProjetosRef.current?.click();
  }

  function handleArquivoProjetosEscolhido(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0] ?? null;
    setArquivoProjetosSelecionado(arquivo);
    // Mesmo motivo de `handleArquivoEscolhido` acima: permite escolher o
    // mesmo arquivo de novo em seguida.
    evento.target.value = '';
  }

  function fecharImportarProjetos() {
    setArquivoProjetosSelecionado(null);
  }

  /**
   * Fecha o dropdown "Importar" — usado em todo ponto de saída (clique
   * fora, Esc, escolha de uma das 2 opções), mesmo critério de `fecharMenu`
   * em `Header.tsx`.
   */
  function fecharDropdownImportar() {
    setDropdownImportarAberto(false);
  }

  useEffect(() => {
    if (!dropdownImportarAberto) return;

    function aoClicarFora(evento: MouseEvent) {
      if (dropdownImportarRef.current && !dropdownImportarRef.current.contains(evento.target as Node)) {
        fecharDropdownImportar();
      }
    }

    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [dropdownImportarAberto]);

  useEffect(() => {
    if (!dropdownImportarAberto) return;

    function aoPressionarTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') fecharDropdownImportar();
    }

    document.addEventListener('keydown', aoPressionarTecla);
    return () => document.removeEventListener('keydown', aoPressionarTecla);
  }, [dropdownImportarAberto]);

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
    setErroExportacaoProjetosLote(null);
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

  /**
   * Entra no modo de seleção para exportar um pacote de projetos em lote
   * (Etapa 4 de ExportacaoImportacaoDeProjetos.md, Demanda 11), passada ao
   * Header via `onAtivarSelecaoExportacaoProjetos` — mesmo padrão de
   * `ativarSelecaoExportacao`, só com a nova variante de `acaoPendente`.
   */
  function ativarSelecaoExportacaoProjetos() {
    setAcaoPendente('exportar-projetos');
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
   * Dispara `exportarProjetos` (`pacoteProjetosApi.ts`, Etapa 2) com todos
   * os slugs selecionados, disparada por "Concluir" quando `acaoPendente
   * === 'exportar-projetos'` (Etapa 4 de ExportacaoImportacaoDeProjetos.md,
   * Demanda 11). Ao contrário de `abrirExportacaoLote` (que abre
   * `ExportarModal`), o download do pacote `.zip` é direto — sem modal
   * intermediário — então em sucesso sai do modo de seleção na hora
   * (`cancelarModoSelecao`), mesmo padrão de `fecharModalExportarLote`. Em
   * falha, mantém a seleção aberta e mostra o erro na barra
   * (`erroExportacaoProjetosLote`), mesmo critério de
   * `handleConfirmarDelecaoLote`.
   */
  async function concluirExportacaoProjetosLote() {
    setErroExportacaoProjetosLote(null);

    try {
      await exportarProjetos([...selecao.selecionados]);
      cancelarModoSelecao();
    } catch (erro) {
      setErroExportacaoProjetosLote(
        erro instanceof Error ? erro.message : 'Não foi possível exportar os projetos selecionados.'
      );
    }
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
    } else if (acaoPendente === 'exportar-projetos') {
      void concluirExportacaoProjetosLote();
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
      <Header
        onAtivarSelecaoDelecao={ativarSelecaoDelecao}
        onAtivarSelecaoExportacao={ativarSelecaoExportacao}
        onAtivarSelecaoExportacaoProjetos={ativarSelecaoExportacaoProjetos}
      />

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
          <div className="importar-planilha importar-dropdown" ref={dropdownImportarRef}>
            <input ref={inputArquivoRef} type="file" accept=".csv,.xlsx" className="input-arquivo-escondido" onChange={handleArquivoEscolhido} />
            <input
              ref={inputArquivoProjetosRef}
              type="file"
              accept=".zip"
              className="input-arquivo-escondido"
              onChange={handleArquivoProjetosEscolhido}
            />
            <button
              type="button"
              className="botao-importar-planilha"
              aria-haspopup="menu"
              aria-expanded={dropdownImportarAberto}
              onClick={() => setDropdownImportarAberto((atual) => !atual)}
            >
              <IconeImportar />
              Importar
              <span className="app-header-config-item-chevron">
                {dropdownImportarAberto ? <IconeSetaCima /> : <IconeSetaBaixo />}
              </span>
            </button>

            {dropdownImportarAberto && (
              <div className="importar-dropdown-menu" role="menu">
                <div className="importar-dropdown-item">
                  <button
                    type="button"
                    role="menuitem"
                    className="importar-dropdown-botao"
                    onClick={() => {
                      fecharDropdownImportar();
                      abrirSeletorDeArquivo();
                    }}
                  >
                    <IconeImportar />
                    Importar Planilha
                  <InfoTooltip
                    rotulo="O que é Importar Planilha"
                    texto="Importa uma única planilha (CSV/XLSX) e cria um projeto novo."
                  />
                  </button>
                </div>

                <div className="importar-dropdown-item">
                  <button
                    type="button"
                    role="menuitem"
                    className="importar-dropdown-botao"
                    onClick={() => {
                      fecharDropdownImportar();
                      abrirSeletorDeArquivoProjetos();
                    }}
                  >
                    <IconeImportar />
                    Importar Projetos
                  <InfoTooltip
                    rotulo="O que é Importar Projetos"
                    texto="Importa um pacote com um ou mais projetos completos, exportados anteriormente. Não afeta os projetos que já existem."
                  />
                  </button>
                </div>
              </div>
            )}
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

        {arquivoProjetosSelecionado && (
          <ImportarProjetosModal arquivo={arquivoProjetosSelecionado} onFechar={fecharImportarProjetos} />
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
      {erroExportacaoProjetosLote && (
        <p className="erro-salvamento erro-selecao-lote">{erroExportacaoProjetosLote}</p>
      )}

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