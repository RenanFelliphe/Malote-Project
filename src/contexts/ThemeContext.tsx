import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type TTheme = 'light' | 'dark';

/** Chave usada para persistir a preferência de tema no localStorage. */
const CHAVE_ARMAZENAMENTO = 'tema-preferido';

interface ThemeContextValue {
  tema: TTheme;
  alternarTema: () => void;
  definirTema: (tema: TTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Lê a preferência de tema salva no localStorage; se não houver nenhuma
 * ainda, cai para a preferência do sistema operacional/navegador
 * (`prefers-color-scheme`), e por fim para 'light' como último recurso
 * (ex.: renderização sem `window`, embora este app seja 100% client-side).
 */
function lerTemaPreferido(): TTheme {
  if (typeof window === 'undefined') return 'light';

  const salvo = window.localStorage.getItem(CHAVE_ARMAZENAMENTO);
  if (salvo === 'light' || salvo === 'dark') return salvo;

  const prefereEscuro = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return prefereEscuro ? 'dark' : 'light';
}

/**
 * Provider de tema (claro/escuro), compartilhado por toda a aplicação.
 *
 * Além de guardar o estado em memória, sincroniza duas coisas a cada
 * mudança: o atributo `data-theme` em `<html>` (usado pelo CSS para trocar
 * as variáveis de cor, ver `index.css`) e o `localStorage` (para a escolha
 * sobreviver a um recarregamento de página).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<TTheme>(lerTemaPreferido);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
    window.localStorage.setItem(CHAVE_ARMAZENAMENTO, tema);
  }, [tema]);

  function definirTema(novoTema: TTheme) {
    setTema(novoTema);
  }

  function alternarTema() {
    setTema((atual) => (atual === 'light' ? 'dark' : 'light'));
  }

  return (
    <ThemeContext.Provider value={{ tema, alternarTema, definirTema }}>
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
