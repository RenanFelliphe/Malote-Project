import { useTheme } from '../contexts/ThemeContext';

interface Props {
  /** Classe extra opcional, para ajustar posicionamento onde o componente for usado. */
  className?: string;
}

/**
 * Switch de alternância entre modo claro e escuro.
 *
 * Componente autocontido: lê e altera o tema via `useTheme()` (contexto
 * global definido em `contexts/ThemeContext.tsx`, que já cuida de persistir
 * a escolha no localStorage). Pode ser reaproveitado em qualquer tela da
 * aplicação — basta garantir que ela esteja dentro do `<ThemeProvider>`
 * (montado uma única vez em `main.tsx`).
 */
export function ThemeToggle({ className }: Props) {
  const { tema, alternarTema } = useTheme();
  const escuro = tema === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={escuro}
      aria-label={escuro ? 'Ativar modo claro' : 'Ativar modo escuro'}
      title={escuro ? 'Modo claro' : 'Modo escuro'}
      className={`theme-toggle ${className ?? ''}`}
      onClick={alternarTema}
    >
      <span className="theme-toggle-track">
        <span className="theme-toggle-icon theme-toggle-icon-sol" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="8" cy="8" r="3.2" />
            <path d="M8 1.2v1.4M8 13.4v1.4M2.6 8H1.2M14.8 8h-1.4M4 4l-1-1M13 13l-1-1M4 12l-1 1M13 3l-1 1" />
          </svg>
        </span>
        <span className="theme-toggle-icon theme-toggle-icon-lua" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" stroke="none">
            <path d="M13.8 10.2A6 6 0 0 1 5.8 2.2a6.2 6.2 0 1 0 8 8Z" />
          </svg>
        </span>
        <span className="theme-toggle-thumb" />
      </span>
    </button>
  );
}
