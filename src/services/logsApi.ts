/**
 * Serviço client-side de logs (Demanda 9, `LogsDeAlteracoes.md`) — mesmo
 * padrão de `emailsApi.ts`/`lixeiraApi.ts`/`projetosApi.ts` (Etapa 0 desta
 * demanda): um serviço dedicado por domínio, centralizando as chamadas de
 * rede que o cliente precisa fazer.
 *
 * Etapa 3: `POST /api/logs` (`registrarLogCliente`), usado por
 * `exportarPlanilha.ts` para confirmar uma exportação (`vite.config.ts`,
 * `logsApiPlugin`/`ACOES_ACEITAS_POST_LOGS`).
 * Etapa 4: `reportarErroApi`, usado por `emailsApi.ts`/`lixeiraApi.ts`/
 * `projetosApi.ts` para relatar respostas 4xx/5xx como `erro_cliente`, e
 * `main.tsx` (`window.onerror`/rejection + error boundary), que chama
 * `registrarLogCliente('erro_cliente', ...)` diretamente.
 * Etapa 5: `listarLogs`, consumindo `GET /api/logs` (`vite.config.ts`,
 * `handleListarLogs`) — busca/filtro/paginação, usado pela tela `/logs`
 * (Etapa 6).
 * Etapa 7: `exportarLogs`, consumindo `GET /api/logs/export`
 * (`vite.config.ts`, `handleExportarLogs`) — exportação dos próprios logs
 * por mês/intervalo, usada pelo `ExportarLogsModal` (botão "Exportar Logs"
 * da tela `/logs`).
 */
import type { DadosLog, LinhaLog } from '../types/log';

/**
 * Subconjunto de `TipoAcao` aceito por `POST /api/logs` — os únicos dois
 * eventos que nascem no cliente sem um handler de mutação de servidor ao
 * qual se anexar (planner, seção 3, tabela de endpoints). Espelha
 * `ACOES_ACEITAS_POST_LOGS` em `vite.config.ts` — mantenha os dois
 * sincronizados se a whitelist mudar. `erro_cliente` passa a ser emitido de
 * fato a partir desta etapa (captura de erro não tratado / respostas
 * 4xx-5xx, ver `reportarErroApi` abaixo e `main.tsx`).
 */
export type AcaoLogCliente = 'exportar_planilha' | 'erro_cliente';

/**
 * Envia um evento de log originado no cliente para `POST /api/logs`.
 * Nunca lança (nem em falha de rede, nem em resposta não-OK): registrar um
 * log é sempre incidental à ação real do usuário (a planilha já foi
 * exportada; um erro relatado já está sendo tratado em outro lugar) — uma
 * falha aqui não deve se propagar e interromper esse fluxo. Mesmo
 * princípio do guard anti-loop de `registrarLog.ts` no servidor: se
 * falhar, só `console.error`, sem retry.
 */
export async function registrarLogCliente(acao: AcaoLogCliente, dados: DadosLog = {}): Promise<void> {
  try {
    const resposta = await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao, dados }),
    });
    if (!resposta.ok) {
      console.error(`registrarLogCliente: POST /api/logs respondeu ${resposta.status} para "${acao}".`);
    }
  } catch (err) {
    console.error(`registrarLogCliente: falha ao registrar "${acao}":`, err);
  }
}

/**
 * Etapa 4 (LogsDeAlteracoes.md): reporta como `erro_cliente` uma resposta
 * 4xx/5xx recebida de qualquer chamada às APIs do projeto
 * (`emailsApi.ts`/`lixeiraApi.ts`/`projetosApi.ts`) — "interceptação de
 * respostas 4xx/5xx nas chamadas de API existentes" (planner, Etapa 4).
 * Chamado no ponto em que cada serviço já detecta a resposta não-ok, logo
 * antes de lançar o `Error` que o chamador (componente/modal) trata — não
 * substitui esse tratamento nem o atrasa (não é `await`ado pelos
 * chamadores), só relata o evento em paralelo via `POST /api/logs`.
 * Nunca lança (mesmo princípio de `registrarLogCliente` acima).
 */
export function reportarErroApi(metodo: string, rota: string, status: number, mensagem?: string): void {
  void registrarLogCliente('erro_cliente', {
    origem: 'cliente',
    mensagem: `${metodo} ${rota} respondeu ${status}${mensagem ? `: ${mensagem}` : '.'}`,
  });
}

/**
 * Lê `{ error }` do corpo de uma resposta não-`ok`, quando presente — mesmo
 * padrão duplicado em `projetosApi.ts`/`lixeiraApi.ts` (cada serviço mantém
 * sua própria cópia, sem um util compartilhado).
 */
async function extrairMensagemDeErro(resposta: Response): Promise<string | undefined> {
  try {
    const corpo = await resposta.json();
    return typeof corpo?.error === 'string' ? corpo.error : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Filtros aceitos por `listarLogs` (Etapa 5) — espelham, um a um, os query
 * params de `GET /api/logs` (`vite.config.ts`, `handleListarLogs`). Todos
 * opcionais: omitir um filtro deixa o servidor aplicar seu próprio padrão
 * (`aba` "acoes", `pagina` 1, sem restrição de busca/data) — este serviço
 * não duplica nenhum desses padrões, só repassa o que foi informado.
 */
export interface FiltrosLogs {
  aba?: 'acoes' | 'erros';
  pagina?: number;
  busca?: string;
  dataInicio?: string;
  dataFim?: string;
}

/**
 * Resposta de `GET /api/logs` (Etapa 5) — espelha `RespostaListagemLogs` de
 * `vite.config.ts`; mantenha os dois sincronizados se o formato mudar.
 * `logsAtivos` foi acrescentado na Etapa 6, para o banner somente-leitura
 * da tela `/logs` (seção 6) saber se `LOGS_ATIVOS=false` no servidor.
 */
export interface RespostaListagemLogs {
  itens: LinhaLog[];
  pagina: number;
  temProximaPagina: boolean;
  logsAtivos: boolean;
}

/**
 * Lista logs via `GET /api/logs` (Etapa 5) — busca/filtro/paginação (seção
 * 6 do planner). Consumido pela tela `/logs` (Etapa 6, ainda não
 * implementada); nenhum outro ponto do sistema chama esta função hoje.
 * Query params omitidos quando ausentes/vazios (`busca` também descarta
 * string só de espaços), em vez de mandar valores vazios que o servidor
 * teria que tratar como "sem filtro" de qualquer forma.
 */
export async function listarLogs(filtros: FiltrosLogs = {}): Promise<RespostaListagemLogs> {
  const params = new URLSearchParams();
  if (filtros.aba) params.set('aba', filtros.aba);
  if (filtros.pagina !== undefined) params.set('pagina', String(filtros.pagina));
  if (filtros.busca?.trim()) params.set('busca', filtros.busca.trim());
  if (filtros.dataInicio) params.set('dataInicio', filtros.dataInicio);
  if (filtros.dataFim) params.set('dataFim', filtros.dataFim);

  const query = params.toString();
  const rota = `/api/logs${query ? `?${query}` : ''}`;
  const resposta = await fetch(rota);

  if (!resposta.ok) {
    const mensagem = await extrairMensagemDeErro(resposta);
    reportarErroApi('GET', rota, resposta.status, mensagem);
    throw new Error(mensagem ?? 'Não foi possível carregar os logs.');
  }

  return (await resposta.json()) as RespostaListagemLogs;
}

/**
 * Filtros aceitos por `exportarLogs` (Etapa 7) — espelham, um a um, os
 * query params de `GET /api/logs/export` (`vite.config.ts`,
 * `handleExportarLogs`). `mesFim` omitido equivale a mês único (mesmo
 * critério do servidor).
 */
export interface FiltrosExportacaoLogs {
  mesInicio: string;
  mesFim?: string;
  formato: 'csv' | 'json';
}

/**
 * Nome de arquivo a partir do header `Content-Disposition` da resposta —
 * fallback só por segurança de tipo; o servidor sempre define esse header
 * em toda resposta bem-sucedida de `GET /api/logs/export`.
 */
function nomeArquivoDeContentDisposition(resposta: Response, fallback: string): string {
  const cabecalho = resposta.headers.get('Content-Disposition') ?? '';
  const encontrado = /filename="([^"]+)"/.exec(cabecalho);
  return encontrado ? encontrado[1] : fallback;
}

/** Mesmo padrão de download via `<a>` temporário já usado por `exportarPlanilha.ts` (`baixarBlob`) — cópia local, sem util compartilhado entre os dois módulos. */
function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exporta os próprios logs via `GET /api/logs/export` (Etapa 7) — mês ou
 * intervalo de meses, em CSV ou JSON. O servidor decide arquivo direto (1
 * mês) ou `.zip` (2+ meses, seção 6); este serviço só baixa o que a
 * resposta trouxer, sem duplicar essa decisão. Nunca chama
 * `registrarLogCliente` — a exportação de logs é leitura sobre o próprio
 * log e não gera log (seção 6), diferente de `exportarPlanilha.ts`
 * (exportação de planilha, que gera `exportar_planilha`).
 */
export async function exportarLogs(filtros: FiltrosExportacaoLogs): Promise<void> {
  const params = new URLSearchParams({ mesInicio: filtros.mesInicio, formato: filtros.formato });
  if (filtros.mesFim) params.set('mesFim', filtros.mesFim);

  const rota = `/api/logs/export?${params.toString()}`;
  const resposta = await fetch(rota);

  if (!resposta.ok) {
    const mensagem = await extrairMensagemDeErro(resposta);
    reportarErroApi('GET', rota, resposta.status, mensagem);
    throw new Error(mensagem ?? 'Não foi possível exportar os logs.');
  }

  const blob = await resposta.blob();
  baixarBlob(blob, nomeArquivoDeContentDisposition(resposta, `logs-${filtros.mesInicio}.${filtros.formato}`));
}