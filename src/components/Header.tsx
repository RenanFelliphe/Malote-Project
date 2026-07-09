import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import type { EmailRecord } from '../types/email';
import { ThemeToggle } from './ThemeToggle';
import { ExportarModal } from './ExportarModal';
import {
  IconeAtualizarPlanilha,
  IconeConfiguracoes,
  IconeExportar,
  IconeLixeira,
  IconePlanilha,
} from './Icons';

import emailsJson from '../../data/emails.json';

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
 * O botão de configurações abre um dropdown com quatro itens. Hoje só dois
 * têm funcionalidade real ("Trocar tema" e "Exportar planilha"); os outros
 * dois ("Atualizar planilha" e "Deletar planilha") existem apenas como
 * espaço reservado para quando o fluxo de múltiplas planilhas for
 * implementado — ficam desabilitados de propósito, para não sugerir uma
 * ação que a aplicação ainda não sabe executar.
 */
export function Header({ registros }: Props) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [modalExportarAberto, setModalExportarAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);

  const registrosParaExportar = registros ?? (emailsJson as EmailRecord[]);

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
    </>
  );
}
