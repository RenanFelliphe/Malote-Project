/**
 * Serviço client-side de portabilidade de projetos (Demanda 11 —
 * "Exportação/Importação de Projetos (Portabilidade)",
 * `ExportacaoImportacaoDeProjetos.md`) — mesmo padrão de
 * `emailsApi.ts`/`lixeiraApi.ts`/`projetosApi.ts`/`logsApi.ts` (Etapa 0
 * desta demanda / Demanda 9): um serviço dedicado por domínio,
 * centralizando as chamadas de rede que o cliente precisa fazer.
 *
 * Etapa 4: `exportarProjetos`, consumindo `GET /api/projetos/pacote`
 * (`vite.config.ts`, `handleExportarPacoteProjetos`, Etapa 2) — usado
 * tanto pelo fluxo direto de "Exportar Projetos" na página do projeto
 * (`Header.tsx`) quanto pela exportação em lote via seleção múltipla da
 * Home (`pages/home.tsx`).
 * Etapa 5: `previewImportacaoPacote`, consumindo `POST
 * /api/projetos/pacote/preview` (`vite.config.ts`,
 * `handlePreviewImportacaoPacote`, Etapa 3) — primeira fase da importação,
 * usada por `ImportarProjetosModal.tsx` para ler o `.zip` escolhido e
 * mostrar o resumo dos projetos contidos antes de qualquer gravação em
 * disco.
 * Etapa 6: `confirmarImportacaoPacote`, consumindo `POST
 * /api/projetos/pacote/confirmar` (`vite.config.ts`,
 * `handleConfirmarImportacaoPacote`, Etapa 3) — segunda e última fase da
 * importação, chamada por `ImportarProjetosModal.tsx` depois que todo
 * conflito listado no preview foi resolvido pelo
 * `ConflitoImportacaoProjetoModal.tsx`.
 */
import type { ProjetoDoManifesto } from '../types/pacoteProjetos';
import { reportarErroApi } from './logsApi';

/**
 * Lê `{ error }` do corpo de uma resposta não-`ok`, quando presente —
 * mesma cópia local já duplicada em `logsApi.ts`/`projetosApi.ts`/
 * `lixeiraApi.ts` (cada serviço mantém a sua, sem um util compartilhado
 * entre eles).
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
 * Nome de arquivo a partir do header `Content-Disposition` da resposta —
 * fallback só por segurança de tipo, já que o servidor sempre define esse
 * header em toda resposta bem-sucedida de `GET /api/projetos/pacote`
 * (mesmo padrão de `nomeArquivoDeContentDisposition` em `logsApi.ts`,
 * cópia local sem util compartilhado). O fallback aqui é genérico, sem
 * timestamp: a função equivalente do servidor (`nomeArquivoPacote`,
 * `scripts/utils/pacoteProjetos.ts`) não pode ser importada neste módulo
 * client-side — depende de `node:fs`, inexistente no bundle do navegador.
 */
function nomeArquivoDeContentDisposition(resposta: Response, fallback: string): string {
  const cabecalho = resposta.headers.get('Content-Disposition') ?? '';
  const encontrado = /filename="([^"]+)"/.exec(cabecalho);
  return encontrado ? encontrado[1] : fallback;
}

/**
 * Mesmo padrão de download via `<a>` temporário já usado por
 * `exportarPlanilha.ts`/`logsApi.ts` (`baixarBlob`) — cópia local, sem
 * util compartilhado entre os módulos.
 */
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
 * Exporta um pacote de portabilidade via `GET /api/projetos/pacote`
 * (Etapa 2) — 1 ou N projetos, mesmo endpoint para os dois casos (a
 * diferença é só quantos slugs entram na query, seção 2 do planner). Usada
 * tanto pelo fluxo direto da página do projeto (`Header.tsx`,
 * `handleClicarExportarProjetos`, 1 slug) quanto pela exportação em lote
 * da Home (`pages/home.tsx`, `concluirExportacaoProjetosLote`, N slugs via
 * seleção múltipla).
 *
 * Não chama `registrarLogCliente`: a instrumentação de `exportar_projetos`
 * (Etapa 7) acontece dentro do próprio endpoint do servidor — diferente de
 * `exportarPlanilha.ts` (que precisa de um `POST /api/logs` à parte porque
 * a exportação de planilha roda inteiramente no cliente, via `JSZip`), a
 * exportação de pacote já é uma requisição ao servidor, que pode logar a
 * mutação sem precisar de um segundo round-trip do cliente.
 */
export async function exportarProjetos(slugs: string[]): Promise<void> {
  const params = new URLSearchParams({ slugs: slugs.join(',') });
  const rota = `/api/projetos/pacote?${params.toString()}`;
  const resposta = await fetch(rota);

  if (!resposta.ok) {
    const mensagem = await extrairMensagemDeErro(resposta);
    reportarErroApi('GET', rota, resposta.status, mensagem);
    throw new Error(mensagem ?? 'Não foi possível exportar os projetos selecionados.');
  }

  const blob = await resposta.blob();
  baixarBlob(blob, nomeArquivoDeContentDisposition(resposta, 'pacote-projetos.zip'));
}

/**
 * Lê um `File` do seletor do SO como base64 puro — mesmo formato de
 * `conteudoBase64` já esperado pelo servidor em todo upload de arquivo
 * bruto (`arquivoBrutoValido`, `vite.config.ts`). `readAsDataURL` prefixa o
 * resultado com `data:<mime>;base64,`; esse prefixo é removido aqui porque
 * o servidor espera só os bytes, não a data URL inteira. Cópia local, sem
 * util compartilhado entre módulos (mesmo critério do resto deste arquivo).
 */
function lerArquivoComoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      const resultado = leitor.result;
      if (typeof resultado !== 'string') {
        reject(new Error('Não foi possível ler o arquivo selecionado.'));
        return;
      }
      const virgula = resultado.indexOf(',');
      resolve(virgula >= 0 ? resultado.slice(virgula + 1) : resultado);
    };
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
    leitor.readAsDataURL(arquivo);
  });
}

/** Resultado de `previewImportacaoPacote`: o que `ImportarProjetosModal.tsx` (Etapa 5) precisa para mostrar o resumo do pacote antes de qualquer gravação. */
export interface ResultadoPreviewPacote {
  /** Identifica o pacote já estagiado em `data/tmp/` no servidor — repassado sem alteração a `confirmarImportacaoPacote` (Etapa 6). */
  pacoteId: string;
  projetos: ProjetoDoManifesto[];
  /** Slugs do manifesto que colidem com projetos já existentes (`detectarConflitos`, `scripts/utils/pacoteProjetos.ts`) — resolvidos um a um pelo modal de conflito da Etapa 6. */
  conflitos: string[];
}

/**
 * Primeira fase da importação: envia o `.zip` escolhido para `POST
 * /api/projetos/pacote/preview` (`vite.config.ts`,
 * `handlePreviewImportacaoPacote`, Etapa 3), que valida a estrutura,
 * estagia o conteúdo em `data/tmp/<pacoteId>/` e devolve a lista de
 * projetos do manifesto + quais colidem com slugs já ativos. Não grava
 * nada em `data/active/` — só a confirmação (Etapa 6,
 * `confirmarImportacaoPacote`) faz isso.
 *
 * Não chama `registrarLogCliente`: assim como `exportarProjetos`, a
 * instrumentação de `importar_projetos` (Etapa 7) acontece no endpoint de
 * confirmação, não aqui — o preview sozinho não é uma mutação real.
 */
export async function previewImportacaoPacote(arquivo: File): Promise<ResultadoPreviewPacote> {
  const conteudoBase64 = await lerArquivoComoBase64(arquivo);
  const rota = '/api/projetos/pacote/preview';
  const resposta = await fetch(rota, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ arquivo: { nomeArquivo: arquivo.name, conteudoBase64 } }),
  });

  if (!resposta.ok) {
    const mensagem = await extrairMensagemDeErro(resposta);
    reportarErroApi('POST', rota, resposta.status, mensagem);
    throw new Error(mensagem ?? 'Não foi possível ler o pacote selecionado.');
  }

  const corpo = (await resposta.json()) as {
    pacoteId: string;
    projetos: ProjetoDoManifesto[];
    conflitos: string[];
  };
  return { pacoteId: corpo.pacoteId, projetos: corpo.projetos, conflitos: corpo.conflitos };
}

/**
 * Decisão do usuário para um projeto conflitante do pacote (seção 4 do
 * planner) — mesmo formato de `DecisaoConflito` em `vite.config.ts`
 * (`handleConfirmarImportacaoPacote`), duplicado aqui do lado do client
 * porque não há um módulo de tipos compartilhado entre servidor e
 * cliente para o corpo dos endpoints (mesmo critério já usado no resto
 * deste arquivo, ex. `ResultadoPreviewPacote` acima).
 */
export interface DecisaoConflitoPacote {
  slug: string;
  acao: 'manter' | 'substituir' | 'novoSlug';
  /** Obrigatório só quando `acao === 'novoSlug'`. */
  novoSlug?: string;
}

/** Resultado de um único projeto do manifesto após `confirmarImportacaoPacote` — espelha o item de `resultados` devolvido por `handleConfirmarImportacaoPacote`. */
export interface ResultadoItemConfirmacaoPacote {
  slug: string;
  ok: boolean;
  /** Presente quando `ok === true`. */
  resultado?: 'adicionado' | 'mantido' | 'substituido' | 'importado_como_novo';
  /** Presente quando `ok === true` e `resultado === 'importado_como_novo'`. */
  novoSlug?: string;
  /** Presente quando `ok === false`. */
  error?: string;
}

/** Resposta completa de `confirmarImportacaoPacote` — `ok` é `false` quando 1+ item de `resultados` falhou (207 do servidor), sem que isso derrube a chamada inteira. */
export interface ResultadoConfirmacaoPacote {
  ok: boolean;
  resultados: ResultadoItemConfirmacaoPacote[];
}

/**
 * Segunda e última fase da importação: envia `pacoteId` (devolvido pelo
 * preview) + as decisões dos projetos conflitantes para `POST
 * /api/projetos/pacote/confirmar` (`vite.config.ts`,
 * `handleConfirmarImportacaoPacote`, Etapa 3), que grava cada projeto em
 * `data/active/` com escrita atômica por projeto e sempre limpa o estágio
 * em `data/tmp/<pacoteId>/` ao final.
 *
 * `decisoes` só precisa cobrir os slugs que vieram em `conflitos` na
 * resposta do preview — projetos sem conflito são gravados direto pelo
 * servidor, sem exigir entrada aqui (mesmo critério documentado em
 * `handleConfirmarImportacaoPacote`).
 *
 * Importante: o servidor responde `207` (não um erro HTTP no sentido de
 * `Response.ok`, que cobre 200–299) quando 1+ projeto falha
 * individualmente — por isso esta função só lança exceção para falhas da
 * requisição inteira (400/404/500, ex. pacote expirado ou corpo
 * malformado); falhas por projeto chegam dentro de `resultados`, para o
 * chamador decidir como exibir.
 *
 * Não chama `registrarLogCliente`: assim como `previewImportacaoPacote`, a
 * instrumentação de `importar_projetos` (Etapa 7) acontece dentro deste
 * endpoint do servidor, uma linha por projeto efetivamente gravado (seção
 * 7 do planner).
 */
export async function confirmarImportacaoPacote(
  pacoteId: string,
  decisoes: DecisaoConflitoPacote[]
): Promise<ResultadoConfirmacaoPacote> {
  const rota = '/api/projetos/pacote/confirmar';
  const resposta = await fetch(rota, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pacoteId, decisoes }),
  });

  if (!resposta.ok) {
    const mensagem = await extrairMensagemDeErro(resposta);
    reportarErroApi('POST', rota, resposta.status, mensagem);
    throw new Error(mensagem ?? 'Não foi possível confirmar a importação do pacote.');
  }

  return (await resposta.json()) as ResultadoConfirmacaoPacote;
}