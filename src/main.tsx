import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './contexts/ThemeContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { registrarLogCliente } from './services/logsApi'

// Etapa 4 (LogsDeAlteracoes.md): captura de erro não tratado no cliente,
// fora do ciclo de render do React (event handlers, timers, promises) —
// erro de render/lifecycle da árvore de componentes é coberto à parte pelo
// ErrorBoundary (ver import acima), que embrulha <App /> abaixo. Ambos os
// caminhos reportam via registrarLogCliente('erro_cliente', ...), mesmo
// endpoint (POST /api/logs) usado por reportarErroApi
// (emailsApi.ts/lixeiraApi.ts/projetosApi.ts) para respostas 4xx/5xx.
window.addEventListener('error', (evento) => {
  const erro = evento.error
  void registrarLogCliente('erro_cliente', {
    origem: 'cliente',
    mensagem: erro instanceof Error ? erro.message : (evento.message || 'Erro não tratado no cliente.'),
    detalhe: erro instanceof Error ? erro.stack : String(erro ?? evento.message),
  })
})

window.addEventListener('unhandledrejection', (evento) => {
  const razao = evento.reason
  void registrarLogCliente('erro_cliente', {
    origem: 'cliente',
    mensagem: razao instanceof Error ? razao.message : String(razao ?? 'Promise rejeitada sem tratamento.'),
    detalhe: razao instanceof Error ? razao.stack : undefined,
  })
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
