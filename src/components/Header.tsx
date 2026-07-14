import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import type { EmailConteudo, EmailRecord, EmailsData } from '../types/email';
import { ThemeToggle } from './ThemeToggle';
import { ExportarModal } from './ExportarModal';
import { EmailConteudoModal } from './EmailConteudoModal';
import { copiarTexto } from './utils/clipboard';
import { salvarEmails } from '../services/emailsApi';
import {
  IconeAtualizarPlanilha,
  IconeConfiguracoes,
  IconeCopiar,
  IconeEditarEmail,
  IconeExportar,
  IconeLixeira,
  IconePlanilha,
} from './Icons';

import emailsJson from '../../data/emails.json';

/** Duração do feedback visual "copiado" nos botões do Header (mesmo valor usado em `EmailTable`). */
const DURACAO_FEEDBACK_COPIA_MS = 1500;

interface Props {
  /**
   * Registros da planilha atualmente aberta na tela, usados pela
   * exportação. Passado pela tela de e-mails (estado já editado da
   * sessão); quando omitido — ex.: na Home, que ainda não gerencia uma
   * planilha real (seção "Dívidas Técnicas" do PROMPTME.md) — cai para a
   * base padrão em `data/emails.json`, já que hoje só existe uma
   * planilha no sistema.
   */
  registros?: EmailRecord[];
  /**
   * Título/corpo do e-mail (REFATORACAO-EMAIL-TITULO-CONTEUDO.md), usado
   * pelos botões "Copiar título"/"Copiar corpo". Mesma regra de fallback
   * dos registros: quando omitido, cai para o `email` padrão de
   * `data/emails.json`.
   */
  email?: EmailConteudo;
  /**
   * Persiste o novo `email` (chamado pelo modal "Editar e-mail", Etapa 3).
   * Passado pela tela de e-mails, que é quem detém o estado de `registros`
   * necessário para gravar o objeto `EmailsData` completo sem perdê-los.
   * Quando omitido (ex.: na Home, que ainda não gerencia uma planilha real),
   * o próprio `Header` persiste diretamente via `emailsApi`, usando o
   * fallback de `registros` já usado pela exportação.
   */
  onSalvarEmail?: (novoEmail: EmailConteudo) => Promise<void>;
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
 * O botão de configurações abre um dropdown com cinco itens. Hoje três
 * têm funcionalidade real ("Trocar tema", "Editar e-mail" e "Exportar
 * planilha"); os outros dois ("Atualizar planilha" e "Deletar planilha")
 * existem apenas como espaço reservado para quando o fluxo de múltiplas
 * planilhas for implementado — ficam desabilitados de propósito, para não
 * sugerir uma ação que a aplicação ainda não sabe executar.
 */
export function Header({ registros, email, onSalvarEmail }: Props) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [modalExportarAberto, setModalExportarAberto] = useState(false);
  const [modalEmailAberto, setModalEmailAberto] = useState(false);
  const [campoCopiado, setCampoCopiado] = useState<'titulo' | 'conteudo' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A partir da migração descrita em REFATORACAO-EMAIL-TITULO-CONTEUDO.md,
  // data/emails.json passou a ser `{ email, registros }` (EmailsData), não
  // mais um array puro — o fallback precisa ler o campo `registros`.
  const registrosParaExportar = registros ?? (emailsJson as EmailsData).registros;

  // Cópia local do `email`, usada apenas como fallback quando a prop não é
  // fornecida (Home) — nesse caso, é atualizada logo após um salvamento bem
  // sucedido pelo modal, para os botões de copiar refletirem o novo
  // conteúdo sem depender de um re-render vindo de fora. Quando a prop
  // `email` existe (pages/emails.tsx), ela sempre tem prioridade abaixo,
  // então este estado nem chega a ser consultado.
  const [emailSalvoLocalmente, setEmailSalvoLocalmente] = useState<EmailConteudo | null>(null);
  const emailAtual = email ?? emailSalvoLocalmente ?? (emailsJson as EmailsData).email;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  /**
   * Copia "Copiar título"/"Copiar corpo" (Etapa 2). Um clique cada, sem
   * etapas intermediárias — os botões ficam sempre visíveis no Header,
   * fora do dropdown de configurações (premissa confirmada no plano).
   * Reaproveita `copiarTexto` (mesmo util usado pelos cabeçalhos de coluna
   * "Nome"/"E-mail" da tabela).
   */
  async function copiarCampo(campo: 'titulo' | 'conteudo') {
    await copiarTexto([emailAtual[campo]]);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setCampoCopiado(campo);
    timeoutRef.current = setTimeout(() => setCampoCopiado(null), DURACAO_FEEDBACK_COPIA_MS);
  }

  /**
   * Persiste o `email` editado no modal (Etapa 3). Quando a tela que
   * renderiza o `Header` gerencia o estado real (`onSalvarEmail`, hoje só
   * `pages/emails.tsx`), delega a ela — é quem detém `registros` para
   * gravar o `EmailsData` completo sem perdê-los. Sem esse callback (Home),
   * persiste diretamente aqui, reaproveitando o mesmo fallback de
   * `registros` já usado pela exportação.
   */
  async function handleSalvarEmail(novoEmail: EmailConteudo) {
    if (onSalvarEmail) {
      await onSalvarEmail(novoEmail);
    } else {
      await salvarEmails({ email: novoEmail, registros: registrosParaExportar });
    }
    setEmailSalvoLocalmente(novoEmail);
  }

  useEffect(() => {
    if (!menuAberto) return;

    function aoClicarFora(evento: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(evento.target as Node)) {
        setMenuAberto(false);
      }
    }

    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [menuAberto]);

  useEffect(() => {
    if (!menuAberto) return;

    function aoPressionarTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        setMenuAberto(false);
        botaoRef.current?.focus();
      }
    }

    document.addEventListener('keydown', aoPressionarTecla);
    return () => document.removeEventListener('keydown', aoPressionarTecla);
  }, [menuAberto]);

  function abrirExportacao() {
    setMenuAberto(false);
    setModalExportarAberto(true);
  }

  function abrirEdicaoEmail() {
    setMenuAberto(false);
    setModalEmailAberto(true);
  }

  return (
    <>
      <header className="app-header">
        <Link to="/" className="app-header-logo">
          <IconePlanilha />
          <span>Sistema de E-mails</span>
        </Link>

        <nav className="app-header-nav">
          <Link to="/" className="app-header-link">
            Home
          </Link>
        </nav>

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

        <div className="app-header-config" ref={containerRef}>
          <button
            type="button"
            ref={botaoRef}
            className="app-header-config-botao"
            onClick={() => setMenuAberto((atual) => !atual)}
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

              <button
                type="button"
                role="menuitem"
                className="app-header-config-item app-header-config-item-botao"
                disabled
                title="Em breve"
              >
                <IconeAtualizarPlanilha />
                Atualizar planilha
              </button>

              <button
                type="button"
                role="menuitem"
                className="app-header-config-item app-header-config-item-botao"
                onClick={abrirEdicaoEmail}
              >
                <IconeEditarEmail />
                Editar e-mail
              </button>

              <button
                type="button"
                role="menuitem"
                className="app-header-config-item app-header-config-item-botao"
                onClick={abrirExportacao}
              >
                <IconeExportar />
                Exportar planilha
              </button>

              <button
                type="button"
                role="menuitem"
                className="app-header-config-item app-header-config-item-botao app-header-config-item-perigo"
                disabled
                title="Em breve"
              >
                <IconeLixeira />
                Deletar planilha
              </button>
            </div>
          )}
        </div>
      </header>

      {modalExportarAberto && (
        <ExportarModal registros={registrosParaExportar} onFechar={() => setModalExportarAberto(false)} />
      )}

      {modalEmailAberto && (
        <EmailConteudoModal
          email={emailAtual}
          onFechar={() => setModalEmailAberto(false)}
          onSalvar={handleSalvarEmail}
        />
      )}
    </>
  );
}
