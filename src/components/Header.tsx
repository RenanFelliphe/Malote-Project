import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import type { EmailConteudo, EmailRecord } from '../types/email';
import { ThemeToggle } from './ThemeToggle';
import { ExportarModal, type PlanilhaParaExportar } from './ExportarModal';
import { EmailConteudoModal } from './EmailConteudoModal';
import { ConfirmDialog } from './ConfirmDialog';
import { AtualizarRegistrosModal } from './atualizar/AtualizarRegistrosModal';
import { AtualizarDadosModal } from './atualizar/AtualizarDadosModal';
import { copiarHtml, copiarTexto } from './utils/clipboard';
import { deletarProjetos } from '../services/projetosApi';
import {
  IconeAtualizarPlanilha,
  IconeConfiguracoes,
  IconeCopiar,
  IconeEditarEmail,
  IconeEditarStatus,
  IconeExportar,
  IconeImportar,
  IconeLixeira,
  IconePlanilha,
  IconeSetaBaixo,
  IconeSetaCima,
} from './Icons';

/** Duração do feedback visual "copiado" nos botões do Header (mesmo valor usado em `EmailTable`). */
const DURACAO_FEEDBACK_COPIA_MS = 1500;

interface Props {
  /**
   * Slug do projeto atualmente aberto (Etapa 9 — ajustes finos, pós
   * refatoração multi-página). Passado apenas pela tela de e-mails; usado
   * como prefixo do nome do arquivo exportado (`ExportarModal`), para não
   * gerar sempre `emails-<data>.<ext>` independente de qual projeto está
   * aberto.
   */
  slug?: string;
  /**
   * Nome de exibição do projeto atualmente aberto (Etapa 3 de
   * implementacaoExportacaoHome.md), usado como `nome` da única planilha
   * passada ao `ExportarModal`. Passado apenas pela tela de e-mails; sem
   * ele, cai para `slug` (e, na ausência de ambos, um rótulo genérico) —
   * mesma tolerância já aplicada ao prefixo do nome do arquivo exportado.
   */
  nome?: string;
  /**
   * Registros da planilha atualmente aberta na tela, usados pela
   * exportação. Passado pela tela de e-mails (estado já editado da
   * sessão). Quando omitido — caso da Home, que lista vários projetos e
   * não tem um único "aberto" — as ações que dependem de uma planilha
   * específica (copiar título/corpo, editar e-mail, exportar) ficam
   * desabilitadas, em vez de recair sobre um projeto arbitrário.
   */
  registros?: EmailRecord[];
  /**
   * Título/corpo do e-mail (REFATORACAO-EMAIL-TITULO-CONTEUDO.md), usado
   * pelos botões "Copiar título"/"Copiar corpo". Mesma regra de
   * disponibilidade de `registros`: sem projeto aberto, não há e-mail para
   * copiar.
   */
  email?: EmailConteudo;
  /**
   * Persiste o novo `email` (chamado pelo modal "Editar e-mail", Etapa 3).
   * Passado pela tela de e-mails, que é quem detém o estado de `registros`
   * necessário para gravar o objeto `EmailsData` completo sem perdê-los.
   * Sem projeto aberto (Home), o item "Editar e-mail" fica desabilitado —
   * não há em qual projeto gravar a edição.
   */
  onSalvarEmail?: (novoEmail: EmailConteudo) => Promise<void>;
  /**
   * Ativa o modo de seleção múltipla da Home (Etapa 4 de
   * implementacaoDelecao.md). Passado apenas por `pages/home.tsx`; quando
   * presente, "Deletar planilha" chama este callback em vez de abrir a
   * confirmação direta usada na página do projeto (Etapa 3) — a Home lista
   * vários projetos ao mesmo tempo, então a exclusão precisa passar por
   * seleção antes de qualquer confirmação.
   */
  onAtivarSelecaoDelecao?: () => void;
  /**
   * Ativa o modo de seleção múltipla da Home para exportação em lote
   * (Etapa 1 de implementacaoExportacaoHome.md). Passado apenas por
   * `pages/home.tsx`, espelhando `onAtivarSelecaoDelecao`; quando presente,
   * "Exportar planilha" chama este callback em vez de abrir o
   * `ExportarModal` direto — a Home lista vários projetos ao mesmo tempo,
   * então a exportação precisa passar por seleção antes de abrir o modal
   * (que passa a receber a lista de planilhas selecionadas a partir da
   * Etapa 2/3).
   */
  onAtivarSelecaoExportacao?: () => void;
}

/**
 * Cabeçalho global da aplicação (Logo/nome do projeto — Home — botão de
 * configurações). Renderizado no topo de cada página (`pages/home.tsx` e
 * `pages/emails.tsx`, antes do container com padding da própria página,
 * para ocupar a largura toda como uma barra fixa) — não em `App.tsx`,
 * porque a exportação depende do estado de registros local de cada tela,
 * que só a própria página tem em mãos. O cabeçalho específico de cada
 * página (título + subtítulo) continua separado, dentro do container
 * com padding.
 *
 * O botão de configurações abre um dropdown com cinco itens: "Trocar tema",
 * "Editar e-mail", "Atualizar planilha", "Exportar planilha" e, a partir da
 * Etapa 3 de implementacaoDelecao.md, "Deletar planilha" (habilitado apenas
 * com um projeto aberto, já que a exclusão em lote pela Home é a Etapa 4).
 *
 * "Atualizar planilha" (Etapa 2 de AtualizacaoDaPlanilhaViaUI.md) não abre
 * uma ação direta — alterna um submenu inline com as duas opções da
 * Demanda 3: "Atualizar Registros" (abre o seletor de arquivo do SO, mesmo
 * padrão de `abrirSeletorDeArquivo` em `pages/home.tsx`, e abre
 * `AtualizarRegistrosModal` com o arquivo escolhido) e "Atualizar Dados"
 * (abre `AtualizarDadosModal` direto, sem seletor — reprocessa a planilha
 * já persistida no projeto). Igual às demais ações que dependem de um
 * projeto específico aberto (Editar e-mail, Exportar, Deletar), o item
 * fica desabilitado na Home.
 */
export function Header({
  slug,
  nome,
  registros,
  email,
  onSalvarEmail,
  onAtivarSelecaoDelecao,
  onAtivarSelecaoExportacao,
}: Props) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [modalExportarAberto, setModalExportarAberto] = useState(false);
  const [modalEmailAberto, setModalEmailAberto] = useState(false);
  const [confirmarDeletarAberto, setConfirmarDeletarAberto] = useState(false);
  const [erroDelecao, setErroDelecao] = useState<string | null>(null);
  const [campoCopiado, setCampoCopiado] = useState<'titulo' | 'conteudo' | null>(null);
  // Submenu de "Atualizar planilha" (Etapa 2 de AtualizacaoDaPlanilhaViaUI.md)
  // — estado próprio, não reaproveita `menuAberto`, porque o dropdown
  // principal e o submenu podem estar em combinações diferentes (menu
  // aberto com submenu fechado é o estado inicial de toda abertura).
  const [submenuAtualizarAberto, setSubmenuAtualizarAberto] = useState(false);
  // Arquivo escolhido no seletor do SO para "Atualizar Registros" — mesmo
  // papel de `arquivoSelecionado` em `pages/home.tsx` (ImportWizardModal).
  // O assistente que deveria abrir a partir deste arquivo
  // (`AtualizarRegistrosModal`) só existe a partir da Etapa 5; até lá, o
  // nome do arquivo escolhido é só exibido como confirmação temporária
  // (ver JSX), para a seleção continuar sendo testável nesta etapa.
  const [arquivoSelecionadoAtualizarRegistros, setArquivoSelecionadoAtualizarRegistros] = useState<File | null>(null);
  // Estado do modal "Atualizar Dados" (Etapa 7 de AtualizacaoDaPlanilhaViaUI.md).
  const [modalAtualizarDadosAberto, setModalAtualizarDadosAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const inputArquivoAtualizarRegistrosRef = useRef<HTMLInputElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const location = useLocation();
  const navigate = useNavigate();

  // Sem `registros`, não há um projeto específico aberto (caso da Home,
  // que lista vários projetos ao mesmo tempo) — usado para desabilitar as
  // ações que antes recaíam silenciosamente sobre o primeiro projeto do
  // glob (`PROJETOS[0]`), o que ficou incorreto desde que passou a existir
  // mais de um projeto real em disco (Etapa 9).
  const projetoAberto = registros !== undefined;
  const registrosParaExportar = registros ?? [];
  /**
   * Lista de 1 item para o `ExportarModal` (Etapa 3 de
   * implementacaoExportacaoHome.md) — o modal passou a receber sempre uma
   * lista de planilhas, mesmo aqui, onde só existe a planilha atualmente
   * aberta. Vazia sem projeto aberto (Home, onde o item do menu já fica
   * desabilitado — este array nunca chega a ser usado nesse caso).
   */
  const planilhaParaExportar: PlanilhaParaExportar[] = projetoAberto
    ? [{ slug: slug ?? 'emails', nome: nome ?? slug ?? 'Planilha', registros: registrosParaExportar }]
    : [];

  // Cópia local do `email`, usada apenas como fallback quando a prop não é
  // fornecida (Home) — nesse caso, é atualizada logo após um salvamento bem
  // sucedido pelo modal, para os botões de copiar refletirem o novo
  // conteúdo sem depender de um re-render vindo de fora. Quando a prop
  // `email` existe (pages/emails.tsx), ela sempre tem prioridade abaixo,
  // então este estado nem chega a ser consultado.
  const [emailSalvoLocalmente, setEmailSalvoLocalmente] = useState<EmailConteudo | null>(null);
  const emailAtual = email ?? emailSalvoLocalmente ?? {
    titulo: '',
    conteudo: '',
    atualizado_em: '',
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  /**
   * Copia "Copiar título"/"Copiar corpo" (Etapa 2). Um clique cada, sem
   * etapas intermediárias — os botões ficam sempre visíveis no Header,
   * fora do dropdown de configurações (premissa confirmada no plano).
   *
   * "Copiar título" reaproveita `copiarTexto` (mesmo util usado pelos
   * cabeçalhos de coluna "Nome"/"E-mail" da tabela) — `titulo` sempre foi e
   * continua sendo texto puro. "Copiar corpo" passou a usar `copiarHtml`
   * (refatoracaoEmailFormatado.md — Etapa 13): `conteudo` agora é HTML
   * (Etapa 1), e `copiarHtml` escreve tanto `text/html` (formatado,
   * email-safe) quanto `text/plain` (fallback) na área de transferência,
   * para que colar no Gmail/Outlook preserve negrito/cor/link/botão/
   * listas/alinhamento.
   */
  async function copiarCampo(campo: 'titulo' | 'conteudo') {
    if (campo === 'conteudo') {
      await copiarHtml(emailAtual.conteudo);
    } else {
      await copiarTexto([emailAtual.titulo]);
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setCampoCopiado(campo);
    timeoutRef.current = setTimeout(() => setCampoCopiado(null), DURACAO_FEEDBACK_COPIA_MS);
  }

  /**
   * Persiste o `email` editado no modal (Etapa 3). Sempre delega a
   * `onSalvarEmail` (só passado por `pages/emails.tsx`, que é quem detém
   * `registros` para gravar o `EmailsData` completo sem perdê-los) — o
   * item "Editar e-mail" do menu fica desabilitado quando não há projeto
   * aberto (Home), então esta função só é chamada quando `onSalvarEmail`
   * existe.
   */
  async function handleSalvarEmail(novoEmail: EmailConteudo) {
    if (!onSalvarEmail) return;
    await onSalvarEmail(novoEmail);
    setEmailSalvoLocalmente(novoEmail);
  }

  /**
   * Fecha o dropdown principal e, junto, o submenu de "Atualizar planilha"
   * (Etapa 2) — os dois vivem na mesma estrutura, então nenhum caminho de
   * fechamento (clique fora, Esc, ou qualquer item do menu sendo escolhido)
   * deve deixar o submenu aberto para a próxima vez que o menu abrir. Usado
   * no lugar de `setMenuAberto(false)` direto em todos os pontos de saída,
   * para não precisar de um efeito derivando um estado do outro (o que o
   * lint do projeto já sinalizou como cascading render ao ser tentado).
   */
  function fecharMenu() {
    setMenuAberto(false);
    setSubmenuAtualizarAberto(false);
  }

  useEffect(() => {
    if (!menuAberto) return;

    function aoClicarFora(evento: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(evento.target as Node)) {
        fecharMenu();
      }
    }

    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [menuAberto]);

  useEffect(() => {
    if (!menuAberto) return;

    function aoPressionarTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        fecharMenu();
        botaoRef.current?.focus();
      }
    }

    document.addEventListener('keydown', aoPressionarTecla);
    return () => document.removeEventListener('keydown', aoPressionarTecla);
  }, [menuAberto]);

  function abrirExportacao() {
    fecharMenu();
    setModalExportarAberto(true);
  }

  /**
   * Clique em "Exportar planilha" (Etapa 1): na Home,
   * `onAtivarSelecaoExportacao` está presente e assume o clique inteiro —
   * entra no modo de seleção múltipla em vez de abrir o modal direto,
   * mesmo padrão de `handleClicarDeletarPlanilha`. Na página do projeto, a
   * prop não é passada, então cai no fluxo atual (abre o modal direto para
   * a planilha aberta).
   */
  function handleClicarExportarPlanilha() {
    if (onAtivarSelecaoExportacao) {
      fecharMenu();
      onAtivarSelecaoExportacao();
      return;
    }
    abrirExportacao();
  }

  function abrirEdicaoEmail() {
    fecharMenu();
    setModalEmailAberto(true);
  }

  /**
   * Clique em "Atualizar planilha" (Etapa 2): alterna o submenu inline com
   * as duas opções da Demanda 3, sem fechar o dropdown principal — mesmo
   * espírito de um item de menu com `aria-haspopup="menu"` que expande em
   * vez de disparar uma ação direta.
   */
  function handleClicarAtualizarPlanilha() {
    setSubmenuAtualizarAberto((atual) => !atual);
  }

  /**
   * "Atualizar Registros" (seção 4 do planner): abre o seletor de arquivo
   * do SO, mesmo padrão de `abrirSeletorDeArquivo` em `pages/home.tsx`. A
   * seleção grava o arquivo em `arquivoSelecionadoAtualizarRegistros`, que
   * passa a abrir `AtualizarRegistrosModal` (Etapa 5) — só é possível
   * chegar aqui com `projetoAberto` (item desabilitado sem projeto),
   * então `slug`/`registros`/`email` sempre existem quando o modal
   * precisa deles (ver checagem no JSX).
   */
  function handleClicarAtualizarRegistros() {
    fecharMenu();
    inputArquivoAtualizarRegistrosRef.current?.click();
  }

  function handleArquivoAtualizarRegistrosEscolhido(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0] ?? null;
    setArquivoSelecionadoAtualizarRegistros(arquivo);
    // Mesmo motivo do equivalente em `pages/home.tsx`: permite escolher o
    // mesmo arquivo de novo em seguida, já que "change" só dispara outra
    // vez se o valor do input for resetado.
    evento.target.value = '';
  }

  /**
   * "Atualizar Dados" (seção 4 do planner, Etapa 7): abre `AtualizarDadosModal`
   * direto, sem seletor de arquivo — o assistente busca a planilha já
   * persistida no servidor. Mesmo padrão de `modalExportarAberto`/
   * `modalEmailAberto` já usados neste componente.
   */
  function handleClicarAtualizarDados() {
    fecharMenu();
    setModalAtualizarDadosAberto(true);
  }

  /**
   * Abre a confirmação de exclusão da planilha atual (Etapa 3 de
   * implementacaoDelecao.md). Só é chamada com `slug` presente — o item do
   * menu fica desabilitado sem um projeto aberto.
   */
  function abrirConfirmarDelecao() {
    fecharMenu();
    setErroDelecao(null);
    setConfirmarDeletarAberto(true);
  }

  /**
   * Clique em "Deletar planilha" (Etapa 4): na Home, `onAtivarSelecaoDelecao`
   * está presente e assume o clique inteiro — entra no modo de seleção
   * múltipla em vez de confirmar direto, já que a Home não tem um único
   * projeto "aberto" para deletar sozinha. Na página do projeto (Etapa 3),
   * a prop não é passada, então cai no fluxo de confirmação direta.
   */
  function handleClicarDeletarPlanilha() {
    if (onAtivarSelecaoDelecao) {
      fecharMenu();
      onAtivarSelecaoDelecao();
      return;
    }
    abrirConfirmarDelecao();
  }

  /**
   * Confirma a exclusão: chama `deletarProjetos` com um lote de um único
   * slug (endpoint sempre em lote, ver seção 2 do plano) e navega para a
   * Home em sucesso. Em falha — either de rede ou o próprio item do lote
   * reportado como não-ok — mantém o dialog fechado e exibe a mensagem de
   * erro no cabeçalho, sem tentar adivinhar uma ação de recuperação.
   */
  async function handleConfirmarDelecao() {
    if (!slug) return;
    setConfirmarDeletarAberto(false);

    try {
      const [resultado] = await deletarProjetos([slug]);
      if (!resultado?.ok) {
        throw new Error(resultado?.error ?? 'Não foi possível deletar a planilha.');
      }
      navigate('/');
    } catch (erro) {
      setErroDelecao(erro instanceof Error ? erro.message : 'Não foi possível deletar a planilha.');
    }
  }

  return (
    <>
      <header className="app-header">
        <Link to="/" className="app-header-logo">
          <IconePlanilha />
          <span>Malote</span>
        </Link>

        <nav className="app-header-nav" />

        {
          location.pathname != '/' && (
            <div className="app-header-copiar">
              <button
                type="button"
                className={`app-header-copiar-botao ${campoCopiado === 'titulo' ? 'copiado' : ''}`}
                onClick={() => void copiarCampo('titulo')}
                disabled={!emailAtual.titulo}
                title="Copiar título do e-mail"
                aria-label="Copiar título do e-mail"
              >
                <IconeCopiar />
                <span>{campoCopiado === 'titulo' ? 'Copiado!' : 'Copiar título'}</span>
              </button>

              <button
                type="button"
                className={`app-header-copiar-botao ${campoCopiado === 'conteudo' ? 'copiado' : ''}`}
                onClick={() => void copiarCampo('conteudo')}
                disabled={!emailAtual.conteudo}
                title="Copiar corpo do e-mail"
                aria-label="Copiar corpo do e-mail"
              >
                <IconeCopiar />
                <span>{campoCopiado === 'conteudo' ? 'Copiado!' : 'Copiar corpo'}</span>
              </button>
            </div>
          )
        }
        <div className="app-header-config" ref={containerRef}>
          <button
            type="button"
            ref={botaoRef}
            className="app-header-config-botao"
            onClick={() => {
              setMenuAberto((atual) => !atual);
              setSubmenuAtualizarAberto(false);
            }}
            aria-haspopup="menu"
            aria-expanded={menuAberto}
            aria-label="Configurações"
            title="Configurações"
          >
            <IconeConfiguracoes />
          </button>

          {menuAberto && (
            <div className="app-header-config-dropdown" role="menu">
              <div className="app-header-config-item app-header-config-item-tema" role="menuitem">
                <span>Trocar tema</span>
                <ThemeToggle />
              </div>

              {
                location.pathname != '/' && (
                  <button
                    type="button"
                    role="menuitem"
                    className="app-header-config-item app-header-config-item-botao"
                    onClick={abrirEdicaoEmail}
                    disabled={!projetoAberto}
                    title={projetoAberto ? undefined : 'Abra um projeto para editar o e-mail'}
                  >
                    <IconeEditarEmail />
                    Editar e-mail
                  </button>
                )
              }
              
              <div className="app-header-config-item-grupo">
                <button
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={submenuAtualizarAberto}
                  className="app-header-config-item app-header-config-item-botao"
                  onClick={handleClicarAtualizarPlanilha}
                  disabled={!projetoAberto}
                  title={projetoAberto ? undefined : 'Abra um projeto para atualizar a planilha'}
                >
                  <IconeAtualizarPlanilha />
                  Atualizar planilha
                  <span className="app-header-config-item-chevron">
                    {submenuAtualizarAberto ? <IconeSetaCima /> : <IconeSetaBaixo />}
                  </span>
                </button>

                {submenuAtualizarAberto && (
                  <div className="app-header-config-submenu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      className="app-header-config-item app-header-config-item-botao app-header-config-item-submenu"
                      onClick={handleClicarAtualizarRegistros}
                    >
                      <IconeImportar />
                      Atualizar registros
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      className="app-header-config-item app-header-config-item-botao app-header-config-item-submenu"
                      onClick={handleClicarAtualizarDados}
                    >
                      <IconeEditarStatus />
                      Atualizar dados
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                role="menuitem"
                className="app-header-config-item app-header-config-item-botao"
                onClick={handleClicarExportarPlanilha}
                disabled={!onAtivarSelecaoExportacao && !projetoAberto}
                title={onAtivarSelecaoExportacao || projetoAberto ? undefined : 'Abra um projeto para exportar'}
              >
                <IconeExportar />
                Exportar planilha
              </button>

              <button
                type="button"
                role="menuitem"
                className="app-header-config-item app-header-config-item-botao app-header-config-item-perigo"
                onClick={handleClicarDeletarPlanilha}
                disabled={!onAtivarSelecaoDelecao && (!slug || !projetoAberto)}
                title={onAtivarSelecaoDelecao || (slug && projetoAberto) ? undefined : 'Abra um projeto para deletar a planilha'}
              >
                <IconeLixeira />
                Deletar planilha
              </button>
            </div>
          )}
        </div>
        {erroDelecao && <p className="erro-salvamento erro-salvamento-header">{erroDelecao}</p>}

        <input
          ref={inputArquivoAtualizarRegistrosRef}
          type="file"
          accept=".csv,.xlsx"
          className="input-arquivo-escondido"
          onChange={handleArquivoAtualizarRegistrosEscolhido}
        />
      </header>

      {modalExportarAberto && (
        <ExportarModal planilhas={planilhaParaExportar} onFechar={() => setModalExportarAberto(false)} />
      )}

      {modalEmailAberto && (
        <EmailConteudoModal
          email={emailAtual}
          onFechar={() => setModalEmailAberto(false)}
          onSalvar={handleSalvarEmail}
        />
      )}

      {confirmarDeletarAberto && (
        <ConfirmDialog
          ariaLabel="Confirmar exclusão da planilha"
          titulo="Deletar planilha"
          descricao="Tem certeza que deseja deletar a planilha atual? Essa ação não pode ser desfeita!"
          rotuloCancelar="Cancelar"
          rotuloConfirmar="Deletar"
          onCancelar={() => setConfirmarDeletarAberto(false)}
          onConfirmar={() => void handleConfirmarDelecao()}
        />
      )}

      {/*
       * Etapa 5 de AtualizacaoDaPlanilhaViaUI.md: assistente do fluxo
       * "Atualizar Registros", aberto com o arquivo escolhido no seletor
       * do SO. `slug`/`registros` só faltam quando não há projeto aberto,
       * mas nesse caso o item do menu que leva a
       * `arquivoSelecionadoAtualizarRegistros` já fica desabilitado — a
       * checagem aqui é só para satisfazer o tipo (`slug?`/`registros?`).
       */}
      {arquivoSelecionadoAtualizarRegistros && slug && registros && (
        <AtualizarRegistrosModal
          slug={slug}
          arquivo={arquivoSelecionadoAtualizarRegistros}
          registrosAtuais={registros}
          emailAtual={emailAtual}
          onFechar={() => setArquivoSelecionadoAtualizarRegistros(null)}
        />
      )}

      {/*
       * Etapa 7 de AtualizacaoDaPlanilhaViaUI.md: assistente do fluxo
       * "Atualizar Dados". `slug`/`registros` só faltam quando não há
       * projeto aberto, mas nesse caso o item do menu que leva a
       * `modalAtualizarDadosAberto` já fica desabilitado — a checagem
       * aqui é só para satisfazer o tipo (`slug?`/`registros?`), mesmo
       * padrão do modal de "Atualizar Registros" acima. `nome` cai para
       * `slug` na ausência de um nome de exibição definido, mesma
       * tolerância já aplicada ao restante deste componente (ver
       * `planilhaParaExportar`).
       */}
      {modalAtualizarDadosAberto && slug && registros && (
        <AtualizarDadosModal
          slug={slug}
          nomeAtual={nome ?? slug}
          registrosAtuais={registros}
          emailAtual={emailAtual}
          onFechar={() => setModalAtualizarDadosAberto(false)}
        />
      )}
    </>
  );
}