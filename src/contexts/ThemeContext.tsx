import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_THEME, themeById, type ThemeId } from '../components/utils/temas';

export type TTheme = ThemeId;

/** Chave usada para persistir a preferência de tema no localStorage. */
const CHAVE_ARMAZENAMENTO = 'tema-preferido';

interface ThemeContextValue {
  tema: TTheme;
  aplicarTema: (tema: TTheme) => void;
  definirTema: (tema: TTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Lê a preferência de tema salva no localStorage; se não houver nenhuma
 * ainda, usa Claro como padrão. IDs antigos ou removidos também caem no
 * padrão para que uma preferência inválida nunca quebre a aplicação.
 */
function lerTemaPreferido(): TTheme {
  if (typeof window === 'undefined') return DEFAULT_THEME;

  const salvo = window.localStorage.getItem(CHAVE_ARMAZENAMENTO);
  if (salvo && themeById.has(salvo as ThemeId)) return salvo as ThemeId;

  window.localStorage.setItem(CHAVE_ARMAZENAMENTO, DEFAULT_THEME);
  return DEFAULT_THEME;
}

/**
 * Provider de tema, compartilhado por toda a aplicação.
 *
 * Além de guardar o estado em memória, sincroniza duas coisas a cada
 * mudança: o atributo `data-theme` em `<html>`, usado pelo CSS para ativar o
 * bloco de variáveis correspondente. A persistência é feita somente por
 * `definirTema`, permitindo preview sem gravar a cada clique.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<TTheme>(lerTemaPreferido);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
  }, [tema]);

  function aplicarTema(novoTema: TTheme) {
    if (themeById.has(novoTema)) setTema(novoTema);
  }

  function definirTema(novoTema: TTheme) {
    if (!themeById.has(novoTema)) return;
    setTema(novoTema);
    window.localStorage.setItem(CHAVE_ARMAZENAMENTO, novoTema);
  }

  return (
    <ThemeContext.Provider value={{ tema, aplicarTema, definirTema }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Hook de acesso ao tema atual — deve ser usado dentro de um `<ThemeProvider>`. */
export function useTheme(): ThemeContextValue {
  const contexto = useContext(ThemeContext);
  if (!contexto) {
    throw new Error('useTheme precisa ser usado dentro de um <ThemeProvider>.');
  }
  return contexto;
}
