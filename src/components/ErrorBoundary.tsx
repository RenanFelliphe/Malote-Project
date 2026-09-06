import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

import { registrarLogCliente } from '../services/logsApi';
import { IconeAlerta } from './Icons';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  temErro: boolean;
}

/**
 * Error boundary do React (Etapa 4, LogsDeAlteracoes.md) — captura erros de
 * render/lifecycle na árvore de componentes abaixo dela e reporta como
 * `erro_cliente` via `registrarLogCliente` (`services/logsApi.ts`), mesmo
 * caminho de `POST /api/logs` já usado por `reportarErroApi`
 * (`emailsApi.ts`/`lixeiraApi.ts`/`projetosApi.ts`) e pelos handlers globais
 * de `main.tsx` (`window.onerror`/`unhandledrejection`).
 *
 * Ajuste de rota: arquivo novo, não mapeado na Etapa 0 desta demanda — um
 * error boundary não existia no projeto antes desta etapa, e não há como
 * capturar erro de render em React sem um componente de classe dedicado
 * (`componentDidCatch`/`getDerivedStateFromError`, únicas APIs do React
 * para isso; não têm equivalente em hooks). Passa a fazer parte da lista
 * cumulativa de Criados a partir de agora.
 *
 * Cobre só a árvore React (erros de render/lifecycle/construtor de
 * componentes filhos) — não substitui `window.onerror`/`unhandledrejection`
 * (`main.tsx`), que cobrem código fora do ciclo de render do React (event
 * handlers, timers, promises). Envolve toda a árvore em `main.tsx`, acima
 * do `BrowserRouter`, para nenhuma rota ficar descoberta.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { temErro: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { temErro: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    void registrarLogCliente('erro_cliente', {
      origem: 'cliente',
      mensagem: error.message || 'Erro não tratado na árvore de componentes React.',
      detalhe: `${error.stack ?? String(error)}\n\nComponent stack:${info.componentStack ?? ''}`,
    });
  }

  render() {
    if (this.state.temErro) {
      return (
        <div className="error-boundary-fallback" role="alert">
          <IconeAlerta />
          <p>Ocorreu um erro inesperado. Recarregue a página para continuar.</p>
        </div>
      );
    }

    return this.props.children;
  }
}
