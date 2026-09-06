import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { EmailsData } from './src/types/email'
// Etapa 2 (LogsDeAlteracoes.md, Demanda 9): utilitário central de log —
// todo handler de mutação abaixo passa a chamá-lo diretamente, nenhum
// escreve em data/logs/ por conta própria (seção 5 do planner). Extensão
// `.js` intencional (arquivo fonte é `.ts`), mesma convenção já usada por
// `registrarLog.ts` ao importar `types/log.js`.
import { registrarLog } from './src/scripts/utils/registrarLog.js'
// Etapa 5: `ehTipoAcaoErro` é usado em runtime (filtro de aba "Ações"/"Erros"
// de `GET /api/logs`, `handleListarLogs` abaixo) — import sem `type`, mesma
// extensão `.js` do import de `registrarLog` acima.
import { ehTipoAcaoErro } from './src/types/log.js'
// Etapa 3: tipos usados só para validar o corpo de `POST /api/logs`
// (`logsApiPlugin` abaixo) — import de tipo, sem extensão `.js`, mesma
// convenção já usada acima para `EmailsData`. `LinhaLog`, Etapa 5: shape de
// cada linha lida de `data/logs/<AAAA-MM>.jsonl` por `GET /api/logs`.
import type { TipoAcao, DadosLog, LinhaLog } from './src/types/log'
// Etapa 7: `JSZip` empacota a exportação de logs em intervalo (2+ meses)
// num único `.zip` — mesma dependência já usada por `exportarPlanilha.ts`
// (client-side, import dinâmico para code-splitting). Aqui, import
// estático: o processo do dev server não precisa de code-splitting.
import JSZip from 'jszip'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// A partir da migração descrita em implementacaoImportacao.md (Etapa 1),
// os projetos ativos vivem em data/active/, irmã de data/trash/ (Lixeira).
const activeDirectory = path.resolve(__dirname, 'data', 'active')
// Ver implementacaoDelecao.md, seção 2 e Etapa 1: pastas deletadas (soft
// delete) são movidas para cá, nomeadas <slug>--<timestamp>.
const trashDirectory = path.resolve(__dirname, 'data', 'trash')

/**
 * Erro de API com status HTTP explícito — usado pelos handlers abaixo para
 * distinguir respostas de validação/conflito (400/409) de falhas inesperadas
 * (500), em vez de sempre responder 500 como antes da Etapa 5 de
 * implementacaoImportacao.md.
 */
class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * Registra `erro_servidor` para uma exceção genuinamente não tratada por
 * um handler deste arquivo — nunca para `ApiError` (validação/conflito com
 * status HTTP explícito, classe acima), que já é uma resposta esperada, não
 * uma falha real do servidor. Chamado em todo catch deste arquivo que
 * devolveria (ou, nos laços em lote, contabilizaria por item) um 500 —
 * Etapa 4 de LogsDeAlteracoes.md ("captura de exceptions não tratadas nos
 * handlers"). `contexto` identifica a rota/handler de origem, só para a
 * mensagem — não é validado contra nenhuma whitelist adicional além da já
 * feita por `registrarLog` (`acao` continua sendo sempre `erro_servidor`).
 */
function registrarErroServidor(err: unknown, contexto: string): void {
  if (err instanceof ApiError) return
  registrarLog('erro_servidor', {
    origem: 'servidor',
    mensagem: `Erro não tratado em ${contexto}: ${err instanceof Error ? err.message : String(err)}`,
    detalhe: err instanceof Error ? err.stack : String(err),
  })
}

/**
 * Checagem de slug seguro contra path traversal, compartilhada por todos os
 * handlers que resolvem `slug` para um caminho em `activeDirectory`.
 */
function slugEhSeguro(slug: unknown): slug is string {
  return (
    typeof slug === 'string' &&
    slug.length > 0 &&
    !slug.includes('/') &&
    !slug.includes('\\') &&
    slug !== '.' &&
    slug !== '..'
  )
}

/**
 * Nome físico da planilha bruta persistida ao lado de `emails.json` é
 * sempre `sheet.<ext>` (Etapa 1 de AtualizacaoDaPlanilhaViaUI.md, seção
 * 3) — a extensão acompanha o formato do arquivo mais recentemente
 * importado/reimportado (csv ou xlsx), por isso não é fixa.
 */
function extensaoDoArquivo(nomeOuCaminho: string): string {
  const ext = path.extname(nomeOuCaminho).slice(1).toLowerCase()
  return ext.length > 0 ? ext : 'xlsx'
}

/**
 * Localiza o `sheet.<ext>` já persistido num diretório de projeto,
 * independentemente da extensão atual — necessário porque uma
 * reimportação pode trocar o formato (csv ↔ xlsx) em relação à planilha
 * anterior, e o arquivo antigo precisa ser removido antes de gravar o
 * novo (ver `persistirSheetBruto`).
 */
function encontrarArquivoSheetExistente(diretorioProjeto: string): string | null {
  const entradas = fs.readdirSync(diretorioProjeto, { withFileTypes: true })
  const encontrado = entradas.find(
    (entrada) => entrada.isFile() && /^sheet\.[^.]+$/.test(entrada.name),
  )
  return encontrado ? path.resolve(diretorioProjeto, encontrado.name) : null
}

/**
 * Grava `sheet.<ext>` a partir do conteúdo em base64 recebido do
 * navegador — mesmo formato usado tanto na criação (`POST /api/projetos`)
 * quanto na reimportação (`POST /api/emails/:slug/sheet`, novo nesta
 * Etapa 1). Remove qualquer `sheet.<ext>` anterior antes de gravar, para
 * não deixar duas cópias com extensões diferentes caso o formato do
 * arquivo tenha mudado entre uma importação e outra.
 */
function persistirSheetBruto(diretorioProjeto: string, nomeArquivo: string, conteudoBase64: string): void {
  const existente = encontrarArquivoSheetExistente(diretorioProjeto)
  if (existente) {
    fs.rmSync(existente)
  }
  const ext = extensaoDoArquivo(nomeArquivo)
  fs.writeFileSync(path.resolve(diretorioProjeto, `sheet.${ext}`), Buffer.from(conteudoBase64, 'base64'))
}

/**
 * Valida o formato `{ nomeArquivo, conteudoBase64 }` usado tanto pelo
 * campo `arquivo` de `POST /api/projetos` quanto pelo corpo inteiro de
 * `POST /api/emails/:slug/sheet`.
 */
function arquivoBrutoValido(valor: unknown): valor is { nomeArquivo: string; conteudoBase64: string } {
  return (
    valor !== null &&
    typeof valor === 'object' &&
    !Array.isArray(valor) &&
    typeof (valor as { nomeArquivo?: unknown }).nomeArquivo === 'string' &&
    (valor as { nomeArquivo: string }).nomeArquivo.length > 0 &&
    typeof (valor as { conteudoBase64?: unknown }).conteudoBase64 === 'string'
  )
}

/**
 * Resolve e valida o diretório de um projeto ativo a partir do slug —
 * mesma checagem repetida em vários handlers deste arquivo, extraída
 * aqui para os dois novos handlers de `/api/emails/:slug/sheet` (Etapa
 * 1), que precisam dela duas vezes (GET e POST) sem duplicar a validação
 * de path traversal.
 */
function resolverDiretorioProjetoAtivo(slug: string): string {
  if (!slugEhSeguro(slug)) {
    throw new ApiError(400, 'Slug de projeto inválido.')
  }
  const diretorioProjeto = path.resolve(activeDirectory, slug)
  const caminhoRelativo = path.relative(activeDirectory, diretorioProjeto)
  const emailsJsonPath = path.resolve(diretorioProjeto, 'emails.json')
  if (
    caminhoRelativo.startsWith('..') ||
    path.isAbsolute(caminhoRelativo) ||
    !fs.statSync(diretorioProjeto, { throwIfNoEntry: false })?.isDirectory() ||
    !fs.statSync(emailsJsonPath, { throwIfNoEntry: false })?.isFile()
  ) {
    throw new ApiError(404, 'Projeto não encontrado.')
  }
  return diretorioProjeto
}

function contentTypeParaExtensaoSheet(ext: string): string {
  if (ext === 'csv') return 'text/csv; charset=utf-8'
  if (ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  return 'application/octet-stream'
}

/**
 * Handler de `GET /api/emails/:slug/sheet` (novo, Etapa 1) — devolve os
 * bytes brutos de `sheet.<ext>` já persistido, para o fluxo "Atualizar
 * Dados > Colunas" (Etapa 7) reparsear no navegador sem exigir novo
 * upload.
 */
function handleObterSheet(res: import('node:http').ServerResponse, slug: string) {
  try {
    const diretorioProjeto = resolverDiretorioProjetoAtivo(slug)
    const caminhoSheet = encontrarArquivoSheetExistente(diretorioProjeto)
    if (!caminhoSheet) {
      throw new ApiError(404, 'Planilha bruta não encontrada para este projeto.')
    }
    const ext = extensaoDoArquivo(caminhoSheet)
    res.statusCode = 200
    res.setHeader('Content-Type', contentTypeParaExtensaoSheet(ext))
    res.setHeader('Content-Disposition', `attachment; filename="sheet.${ext}"`)
    res.end(fs.readFileSync(caminhoSheet))
  } catch (err) {
    registrarErroServidor(err, 'GET /api/emails/:slug/sheet')
    const status = err instanceof ApiError ? err.status : 500
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }))
  }
}

/**
 * Handler de `POST /api/emails/:slug/sheet` (novo, Etapa 1) — recebe
 * `{ nomeArquivo, conteudoBase64 }` e sobrescreve `sheet.<ext>`. Usado
 * pelo fluxo "Atualizar Registros" (Etapa 5), ao confirmar o wizard —
 * ordem exata em relação ao `PUT /api/emails/:slug` final fica decidida
 * na Etapa 8, para não sobrescrever o arquivo bruto se o usuário cancelar
 * o wizard no meio do caminho.
 */
function handleSalvarSheet(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  slug: string,
) {
  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', () => {
    try {
      const diretorioProjeto = resolverDiretorioProjetoAtivo(slug)
      const dados = JSON.parse(body || '{}')
      if (!arquivoBrutoValido(dados)) {
        throw new ApiError(400, 'Corpo inválido: esperado objeto { nomeArquivo, conteudoBase64 }.')
      }
      persistirSheetBruto(diretorioProjeto, dados.nomeArquivo, dados.conteudoBase64)

      // Etapa 2: `reimportar_planilha` — planner, "Etapa 2 — Instrumentar
      // os handlers existentes". Ajuste de rota / limitação conhecida: este
      // endpoint recebe só `{ nomeArquivo, conteudoBase64 }` (bytes brutos),
      // sem a contagem de registros reimportados — `quantidade` fica
      // omitido (o template de `montarMensagem` já lida com isso, seção 4
      // de `LogsDeAlteracoes.md`). Como o tipo não está em
      // `ACOES_SEMPRE_REAIS` (`registrarLog.ts`) nem `houveMudancaReal`
      // recebe `original`/`atual` aqui, a linha é sempre gravada mesmo
      // assim (nenhuma das duas checagens de no-op se aplica sem
      // `quantidade`/`original`/`atual`). Fechar esse gap com uma contagem
      // exata depende de `AtualizarRegistrosModal.tsx`/`calcularMerge.ts`
      // passarem a enviar a contagem no corpo — fora do escopo mapeado na
      // Etapa 0 desta demanda.
      registrarLog('reimportar_planilha', { projeto: slug })

      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: true }))
    } catch (err) {
      registrarErroServidor(err, 'POST /api/emails/:slug/sheet')
      const status = err instanceof ApiError ? err.status : 500
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }))
    }
  })
}

/**
 * Middleware de dev server que persiste `data/<slug>/emails.json`.
 *
 * A partir da migração descrita em REFATORACAO-EMAIL-TITULO-CONTEUDO.md, o
 * arquivo passou a ser o objeto completo `{ email, registros }` (EmailsData) —
 * não mais um array puro de registros. `salvarEmails` (services/emailsApi.ts)
 * envia apenas `{ email, registros }`; os metadados do projeto são preservados
 * pelo merge feito aqui, no servidor.
 *
 * Etapa 3 de AtualizacaoDaPlanilhaViaUI.md: o corpo passa a aceitar também
 * um campo `projeto` opcional (nome de exibição) — quando presente,
 * atualiza `EmailsData.projeto` junto com `email`/`registros` no mesmo
 * merge; quando ausente (todo chamador anterior a esta etapa), o
 * comportamento não muda: `dadosAtuais.projeto` continua preservado como
 * antes. Usado pela seção "Projeto" do fluxo "Atualizar Dados" (Etapa 7)
 * quando só o nome de exibição muda (sem precisar do `PATCH
 * /api/projetos/:slug`, que só entra em jogo quando o nome do
 * arquivo/rota muda).
 */
/**
 * Registro genérico o bastante para o diff de `registros` abaixo sem
 * depender do shape completo de `EmailRecord` (fora do escopo desta
 * demanda — ver "Ajuste de rota" no planner). `id` é o único campo cuja
 * presença é garantida pelo restante do projeto (`exportarPlanilha.ts`
 * usa `registro.id` diretamente).
 */
type RegistroLog = Record<string, unknown> & { id: unknown }

/**
 * Compara o `email` (EmailConteudo) atual com o recebido no corpo de `PUT
 * /api/emails/:slug` e registra uma linha `editar_email` por campo que de
 * fato mudou de valor — formato dedicado `{ campo, de }`/`{ campo, para }`
 * da seção 4 do planner (`descreverDiferencas`, `registrarLog.ts`), uma
 * linha por campo tocado, ao contrário do diff genérico de
 * `alterar_registro` abaixo, que agrupa todos os campos de um mesmo
 * registro numa única linha. Cobre `assunto`/`corpo`/`anexos` e qualquer
 * atributo futuro sem exigir mudança de código (planner, seção 4: "sem
 * exigir novo tipo a cada novo atributo").
 */
function registrarEdicoesDeEmail(
  slug: string,
  emailAtual: Record<string, unknown> | null | undefined,
  emailNovo: Record<string, unknown> | null | undefined,
): void {
  const atual = emailAtual ?? {}
  const novo = emailNovo ?? {}
  const chaves = new Set([...Object.keys(atual), ...Object.keys(novo)])
  for (const campo of chaves) {
    const de = atual[campo]
    const para = novo[campo]
    if (JSON.stringify(de) === JSON.stringify(para)) continue
    registrarLog('editar_email', {
      projeto: slug,
      original: { campo, de },
      atual: { campo, para },
    })
  }
}

/**
 * Compara `registros` atuais (lidos do disco) com os recebidos no corpo de
 * `PUT /api/emails/:slug`, casados por `id`. Para cada registro que mudou:
 *
 * 1. Se alguma chave de `backup_dados` foi removida em relação ao registro
 *    atual, emite `restaurar_registro` para essas chaves — mesmo critério
 *    de `restaurarCampos.ts` (a restauração só remove chaves, nunca
 *    adiciona; `status` não tem valor literal restaurado, só a remoção da
 *    chave, por isso `original`/`atual` podem trazer o mesmo valor de
 *    `status` — ver o ajuste em `houveMudancaReal`, `registrarLog.ts`).
 * 2. Qualquer outra alteração de campo (excluindo `backup_dados` e
 *    `last_updated`, metadados internos, e as chaves já cobertas pelo
 *    item 1) emite `alterar_registro`, com diff genérico agrupando todos
 *    os campos que mudaram nesse registro numa única linha.
 *
 * Limitação conhecida — ver "Ajuste de rota" no planner: sem
 * `calcularMerge.ts`/`AtualizarRegistrosModal.tsx`/`AtualizarDadosModal.tsx`
 * (fora do escopo mapeado na Etapa 0), esta função não distingue uma
 * edição manual de um único registro de um remapeamento de colunas em
 * massa — ambos chegam da mesma forma (array `registros` completo) e são
 * tratados registro a registro, podendo gerar uma linha `alterar_registro`
 * por registro afetado num remapeamento grande, em vez de uma única linha
 * agregada. Criação de registro (id novo, sem correspondente em
 * `registrosAtuais`) não é coberta por esta demanda — só acontece via
 * `importar_planilha`/`reimportar_planilha`, instrumentados à parte.
 */
function registrarMutacoesDeRegistros(
  slug: string,
  registrosAtuais: RegistroLog[] | null | undefined,
  registrosNovos: RegistroLog[] | null | undefined,
): void {
  const porId = new Map<string, RegistroLog>()
  for (const registro of registrosAtuais ?? []) {
    porId.set(String(registro.id), registro)
  }

  for (const registroNovo of registrosNovos ?? []) {
    const registroId = String(registroNovo.id)
    const registroAtual = porId.get(registroId)
    if (!registroAtual) continue

    const backupAtual = (registroAtual.backup_dados ?? null) as Record<string, unknown> | null
    const backupNovo = (registroNovo.backup_dados ?? null) as Record<string, unknown> | null
    const chavesRestauradas = Object.keys(backupAtual ?? {}).filter(
      (chave) => !backupNovo || !(chave in backupNovo),
    )

    if (chavesRestauradas.length > 0) {
      const original: Record<string, unknown> = {}
      const atual: Record<string, unknown> = {}
      for (const chave of chavesRestauradas) {
        original[chave] = registroAtual[chave]
        atual[chave] = registroNovo[chave]
      }
      registrarLog('restaurar_registro', { projeto: slug, registroId, original, atual })
    }

    const chavesIgnoradas = new Set(['backup_dados', 'last_updated', ...chavesRestauradas])
    const chaves = new Set([...Object.keys(registroAtual), ...Object.keys(registroNovo)])
    const original: Record<string, unknown> = {}
    const atual: Record<string, unknown> = {}
    for (const chave of chaves) {
      if (chavesIgnoradas.has(chave)) continue
      const de = registroAtual[chave]
      const para = registroNovo[chave]
      if (JSON.stringify(de) !== JSON.stringify(para)) {
        original[chave] = de
        atual[chave] = para
      }
    }
    if (Object.keys(original).length > 0) {
      registrarLog('alterar_registro', { projeto: slug, registroId, original, atual })
    }
  }
}

/**
 * Ponto único de instrumentação do handler `PUT /api/emails/:slug`
 * (Etapa 2) — chamado depois que `fs.writeFileSync` já persistiu
 * `dadosMesclados`, comparando o estado lido do disco antes do merge
 * (`dadosAtuais`) com o que foi recebido/persistido, seguindo a regra de
 * "uma linha por mutação de fato ocorrida" (planner, seção 2):
 * renomeio de exibição e remapeamento de coluna de ID viram `alterar_planilha`
 * (mesma tag do `PATCH /api/projetos/:slug`, linha própria por não serem a
 * mesma mutação de registros/e-mail); o conteúdo do e-mail e os registros
 * são diffados à parte, cada um com sua própria função acima.
 */
function registrarMutacoesDoPutEmails(
  slug: string,
  dadosAtuais: Record<string, unknown>,
  dadosRecebidos: Record<string, unknown>,
  dadosMesclados: Record<string, unknown>,
): void {
  if (
    typeof dadosRecebidos.projeto === 'string' &&
    dadosRecebidos.projeto !== dadosAtuais.projeto
  ) {
    registrarLog('alterar_planilha', {
      projeto: slug,
      original: { projeto: dadosAtuais.projeto ?? null },
      atual: { projeto: dadosRecebidos.projeto },
    })
  }

  const colunaIdAntiga = (dadosAtuais as { colunaId?: string }).colunaId ?? null
  const colunaIdNova = (dadosMesclados as { colunaId?: string }).colunaId ?? null
  if (colunaIdAntiga !== colunaIdNova) {
    registrarLog('alterar_planilha', {
      projeto: slug,
      original: { colunaId: colunaIdAntiga },
      atual: { colunaId: colunaIdNova },
    })
  }

  registrarEdicoesDeEmail(
    slug,
    dadosAtuais.email as Record<string, unknown> | undefined,
    dadosRecebidos.email as Record<string, unknown> | undefined,
  )

  registrarMutacoesDeRegistros(
    slug,
    dadosAtuais.registros as RegistroLog[] | undefined,
    dadosRecebidos.registros as RegistroLog[] | undefined,
  )
}

function emailsApiPlugin() {
  return {
    name: 'emails-api',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/api/emails', (req, res) => {
        // Novo, Etapa 1 de AtualizacaoDaPlanilhaViaUI.md: GET/POST
        // /api/emails/:slug/sheet — planilha bruta persistida ao lado de
        // emails.json. Checado antes da rota abaixo, que segue tratando o
        // path inteiro (sem sub-rota) como PUT de { email, registros }.
        const caminhoSemQuery = (req.url ?? '/').split('?')[0]
        const segmentos = caminhoSemQuery.split('/').filter(Boolean)
        if (segmentos.length === 2 && segmentos[1] === 'sheet') {
          const slug = decodeURIComponent(segmentos[0])
          if (req.method === 'GET') {
            handleObterSheet(res, slug)
            return
          }
          if (req.method === 'POST') {
            handleSalvarSheet(req, res, slug)
            return
          }
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        if (req.method !== 'PUT') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', () => {
          try {
            const slug = decodeURIComponent((req.url ?? '').replace(/^\/+|\/+$/g, ''))
            if (!slugEhSeguro(slug)) {
              throw new Error('Slug de projeto inválido.')
            }

            const diretorioProjeto = path.resolve(activeDirectory, slug)
            const caminhoProjetoRelativo = path.relative(activeDirectory, diretorioProjeto)
            const emailsJsonPath = path.resolve(diretorioProjeto, 'emails.json')
            if (
              caminhoProjetoRelativo.startsWith('..') ||
              path.isAbsolute(caminhoProjetoRelativo) ||
              !fs.statSync(diretorioProjeto, { throwIfNoEntry: false })?.isDirectory() ||
              !fs.statSync(emailsJsonPath, { throwIfNoEntry: false })?.isFile()
            ) {
              throw new Error('Projeto não encontrado.')
            }

            const dados = JSON.parse(body)

            const formatoValido =
              dados &&
              typeof dados === 'object' &&
              !Array.isArray(dados) &&
              dados.email &&
              typeof dados.email === 'object' &&
              Array.isArray(dados.registros) &&
              (dados.projeto === undefined || typeof dados.projeto === 'string') &&
              // Demanda 7 (Mapeamento de ID Personalizado, Etapa 8): campo
              // opcional — ausente/`undefined` (chamadores que ainda não
              // enviam o campo, ex. `AtualizarRegistrosModal` até a Etapa
              // 9) preserva `colunaId` já persistido; `null`/string
              // sobrescreve.
              (dados.colunaId === undefined || dados.colunaId === null || typeof dados.colunaId === 'string')

            if (!formatoValido) {
              throw new Error(
                'Corpo inválido: esperado objeto { email, registros, projeto? }.'
              )
            }

            const dadosAtuais = JSON.parse(fs.readFileSync(emailsJsonPath, 'utf-8'))
            const dadosMesclados: Record<string, unknown> = {
              ...dadosAtuais,
              atualizado_em: new Date().toISOString(),
              projeto: dados.projeto ?? dadosAtuais.projeto,
              email: dados.email,
              registros: dados.registros,
            }
            // Demanda 7 (Mapeamento de ID Personalizado, Etapa 8): só mexe
            // em `colunaId` quando o chamador manda o campo de verdade
            // (mesmo ausente que os outros pontos desta demanda) — chamadores
            // antigos que não enviam `colunaId` continuam preservando o
            // valor já persistido via `...dadosAtuais` acima, sem regressão.
            if (dados.colunaId !== undefined) {
              if (typeof dados.colunaId === 'string' && dados.colunaId !== '') {
                dadosMesclados.colunaId = dados.colunaId
              } else {
                delete dadosMesclados.colunaId
              }
            }

            fs.writeFileSync(emailsJsonPath, JSON.stringify(dadosMesclados, null, 2) + '\n', 'utf-8')

            // Etapa 2 (LogsDeAlteracoes.md): diff entre o que estava no
            // disco (dadosAtuais) e o que foi recebido/persistido — nunca
            // trava a resposta real, mesmo em caso de falha de escrita do
            // log (guard anti-loop de `registrarLog`, seção 5, item 6).
            registrarMutacoesDoPutEmails(slug, dadosAtuais, dados, dadosMesclados)

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch (err) {
            registrarErroServidor(err, 'PUT /api/emails/:slug')
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: String(err) }))
          }
        })
      })
    },
  }
}

/**
 * Handler de `DELETE /api/projetos` — soft delete em lote (Etapa 2 de
 * implementacaoDelecao.md). Corpo `{ slugs: string[] }`. Cada slug é
 * tratado de forma independente: uma falha isolada (slug inválido,
 * projeto inexistente) não impede o processamento dos demais. Para cada
 * slug bem-sucedido: injeta `slug` e `deletado_em` no `emails.json` antes
 * de mover a pasta inteira para `data/trash/<slug>--<timestamp>`
 * (`fs.renameSync`) — ver esquema de nomeação documentado em
 * `src/types/email.ts` junto de `EmailsData`.
 */
function handleDeletarProjetos(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) {
  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', () => {
    try {
      const dados = JSON.parse(body || '{}')

      const formatoValido =
        dados &&
        typeof dados === 'object' &&
        !Array.isArray(dados) &&
        Array.isArray(dados.slugs) &&
        dados.slugs.every((s: unknown) => typeof s === 'string')

      if (!formatoValido) {
        throw new ApiError(400, 'Corpo inválido: esperado objeto { slugs: string[] }.')
      }

      const { slugs } = dados as { slugs: string[] }

      const resultados = slugs.map((slug) => {
        try {
          if (!slugEhSeguro(slug)) {
            throw new ApiError(400, 'Slug de projeto inválido.')
          }

          const diretorioProjeto = path.resolve(activeDirectory, slug)
          const caminhoProjetoRelativo = path.relative(activeDirectory, diretorioProjeto)
          const emailsJsonPath = path.resolve(diretorioProjeto, 'emails.json')
          if (
            caminhoProjetoRelativo.startsWith('..') ||
            path.isAbsolute(caminhoProjetoRelativo) ||
            !fs.statSync(diretorioProjeto, { throwIfNoEntry: false })?.isDirectory() ||
            !fs.statSync(emailsJsonPath, { throwIfNoEntry: false })?.isFile()
          ) {
            throw new ApiError(404, 'Projeto não encontrado.')
          }

          const agora = new Date().toISOString()
          // Timestamp usado tanto no campo persistido quanto no nome físico
          // da pasta de destino — não precisam ser idênticos em formato,
          // mas nascer do mesmo instante evita qualquer ambiguidade.
          const timestampPasta = agora.replace(/[:.]/g, '-')

          const dadosAtuais: EmailsData = JSON.parse(fs.readFileSync(emailsJsonPath, 'utf-8'))
          const dadosAtualizados: EmailsData = {
            ...dadosAtuais,
            slug,
            deletado_em: agora,
          }
          fs.writeFileSync(emailsJsonPath, JSON.stringify(dadosAtualizados, null, 2) + '\n', 'utf-8')

          const diretorioLixeira = path.resolve(trashDirectory, `${slug}--${timestampPasta}`)
          fs.mkdirSync(trashDirectory, { recursive: true })
          fs.renameSync(diretorioProjeto, diretorioLixeira)

          registrarLog('deletar_projeto', { projeto: slug })

          return { slug, ok: true as const }
        } catch (err) {
          registrarErroServidor(err, 'DELETE /api/projetos (item)')
          return {
            slug,
            ok: false as const,
            error: err instanceof Error ? err.message : String(err),
          }
        }
      })

      const algumaFalha = resultados.some((r) => !r.ok)
      res.statusCode = algumaFalha ? 207 : 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: !algumaFalha, resultados }))
    } catch (err) {
      registrarErroServidor(err, 'DELETE /api/projetos')
      const status = err instanceof ApiError ? err.status : 500
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }))
    }
  })
}

/**
 * Handler de `PATCH /api/projetos/:slug` — renomeia um dos dois lados de um
 * conflito de restauração (Etapa 9 de implementacaoDelecao.md). `slugAtual`
 * (extraído da URL) é o slug conflitante, o mesmo hoje nos dois lados;
 * corpo `{ novoSlug, origem }` diz qual lado está sendo renomeado
 * (`'ativo'` ou `'lixeira'`) e para qual valor.
 *
 * - `origem: 'ativo'`: `fs.renameSync` de `data/active/<slugAtual>` para
 *   `data/active/<novoSlug>`. Se o `emails.json` já carregar um campo
 *   `slug` persistido (projeto que já passou pela lixeira antes — ver
 *   `EmailsData` em `src/types/email.ts`), esse campo é atualizado junto,
 *   para não ficar desalinhado com o nome físico da pasta numa exclusão
 *   futura; projetos que nunca passaram pela lixeira não ganham o campo só
 *   por causa deste renomeio.
 * - `origem: 'lixeira'`: localiza a pasta em `data/trash/` pelo campo
 *   `slug` interno do JSON — mesma busca de `handleRestaurarProjetos`
 *   (Etapa 8), nunca pelo nome físico da pasta. O campo `slug` é
 *   atualizado para `novoSlug`; o nome físico da pasta também acompanha
 *   (`<novoSlug>--<timestamp>`, preservando o timestamp original) para
 *   manter o esquema de nomeação da seção 2 do plano consistente.
 *
 * Em ambos os casos, valida contra o disco que `novoSlug` não colide com
 * nenhum projeto ativo nem com nenhum outro item da lixeira antes de
 * escrever ou mover qualquer coisa — a validação em tempo real do client
 * (Etapa 9, `ConflitoRestauracaoModal`) é só conveniência de UX, mesmo
 * padrão de `projetosApiPlugin` para criação (Etapa 5 de
 * implementacaoImportacao.md).
 */
function handleRenomearProjeto(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  slugAtual: string,
) {
  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', () => {
    try {
      const dados = JSON.parse(body || '{}')

      const formatoValido =
        dados &&
        typeof dados === 'object' &&
        !Array.isArray(dados) &&
        typeof dados.novoSlug === 'string' &&
        (dados.origem === 'ativo' || dados.origem === 'lixeira')

      if (!formatoValido) {
        throw new ApiError(400, 'Corpo inválido: esperado objeto { novoSlug, origem }.')
      }

      const { novoSlug, origem } = dados as { novoSlug: string; origem: 'ativo' | 'lixeira' }

      if (!slugEhSeguro(slugAtual) || !slugEhSeguro(novoSlug)) {
        throw new ApiError(400, 'Slug de projeto inválido.')
      }

      if (novoSlug === slugAtual) {
        throw new ApiError(400, 'O novo nome de arquivo deve ser diferente do atual.')
      }

      const diretorioNovoAtivo = path.resolve(activeDirectory, novoSlug)
      if (fs.statSync(diretorioNovoAtivo, { throwIfNoEntry: false })) {
        throw new ApiError(409, 'Já existe um projeto ativo com esse nome de arquivo.')
      }

      // Varredura da lixeira serve a dois propósitos ao mesmo tempo: checar
      // colisão de `novoSlug` contra qualquer outro item lá (inclusive
      // quando origem é 'ativo', já que o novo nome não pode colidir com
      // nenhum dos dois lados), e localizar a pasta física de origem
      // quando origem é 'lixeira' (mesma busca por `slug` interno de
      // handleRestaurarProjetos, Etapa 8).
      fs.mkdirSync(trashDirectory, { recursive: true })
      const entradasLixeira = fs
        .readdirSync(trashDirectory, { withFileTypes: true })
        .filter((entrada) => entrada.isDirectory())

      let nomePastaOrigemLixeira: string | null = null

      for (const entrada of entradasLixeira) {
        const emailsJsonPath = path.resolve(trashDirectory, entrada.name, 'emails.json')
        let candidato: EmailsData
        try {
          candidato = JSON.parse(fs.readFileSync(emailsJsonPath, 'utf-8'))
        } catch {
          continue
        }
        const slugCandidato = candidato.slug ?? entrada.name.split('--')[0]

        if (slugCandidato === novoSlug) {
          throw new ApiError(409, 'Já existe uma planilha na lixeira com esse nome de arquivo.')
        }
        if (origem === 'lixeira' && slugCandidato === slugAtual) {
          nomePastaOrigemLixeira = entrada.name
        }
      }

      if (origem === 'ativo') {
        const diretorioAtual = path.resolve(activeDirectory, slugAtual)
        const emailsJsonPath = path.resolve(diretorioAtual, 'emails.json')
        if (!fs.statSync(diretorioAtual, { throwIfNoEntry: false })?.isDirectory()) {
          throw new ApiError(404, 'Projeto não encontrado.')
        }

        const dadosAtuais: EmailsData = JSON.parse(fs.readFileSync(emailsJsonPath, 'utf-8'))
        if (dadosAtuais.slug) {
          fs.writeFileSync(
            emailsJsonPath,
            JSON.stringify({ ...dadosAtuais, slug: novoSlug }, null, 2) + '\n',
            'utf-8',
          )
        }

        fs.renameSync(diretorioAtual, diretorioNovoAtivo)
      } else {
        if (!nomePastaOrigemLixeira) {
          throw new ApiError(404, 'Planilha não encontrada na lixeira.')
        }

        const diretorioAtual = path.resolve(trashDirectory, nomePastaOrigemLixeira)
        const emailsJsonPath = path.resolve(diretorioAtual, 'emails.json')
        const dadosAtuais: EmailsData = JSON.parse(fs.readFileSync(emailsJsonPath, 'utf-8'))
        fs.writeFileSync(
          emailsJsonPath,
          JSON.stringify({ ...dadosAtuais, slug: novoSlug }, null, 2) + '\n',
          'utf-8',
        )

        const timestampPasta = nomePastaOrigemLixeira.slice(nomePastaOrigemLixeira.indexOf('--') + 2)
        fs.renameSync(diretorioAtual, path.resolve(trashDirectory, `${novoSlug}--${timestampPasta}`))
      }

      // Etapa 2: renomeio de arquivo (ativo ou lixeira) é tag
      // `alterar_planilha`, não um tipo próprio — planner, "Etapa 2 —
      // Instrumentar os handlers existentes". Logado sob o slug
      // resultante (`novoSlug`), já que é a identidade que sobrevive à
      // mutação e sob a qual buscas futuras na tela `/logs` vão filtrar.
      registrarLog('alterar_planilha', {
        projeto: novoSlug,
        original: { slug: slugAtual },
        atual: { slug: novoSlug },
      })

      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: true, slug: novoSlug }))
    } catch (err) {
      registrarErroServidor(err, 'PATCH /api/projetos/:slug')
      const status = err instanceof ApiError ? err.status : 500
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }))
    }
  })
}

/**
 * Middleware de dev server que cria `data/active/<slug>/emails.json` do zero.
 *
 * Implementa a Etapa 5 de implementacaoImportacao.md: endpoint chamado pelo
 * wizard de importação (via `criarProjeto` em `projetosApi.ts`, Etapa 6) ao
 * confirmar a importação de uma planilha nova. A validação de slug único do
 * client (Etapa 4, `PROJETOS` em memória) é só conveniência de UX — aqui é a
 * garantia real, checada contra o disco no momento da escrita.
 */
function projetosApiPlugin() {
  return {
    name: 'projetos-api',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/api/projetos', (req, res) => {
        const caminho = (req.url ?? '/').split('?')[0]

        if (req.method === 'PATCH') {
          const slugAtual = decodeURIComponent(caminho.replace(/^\/+/, ''))
          handleRenomearProjeto(req, res, slugAtual)
          return
        }

        if (req.method === 'DELETE') {
          handleDeletarProjetos(req, res)
          return
        }

        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', () => {
          try {
            const dados = JSON.parse(body)

            const formatoValido =
              dados &&
              typeof dados === 'object' &&
              !Array.isArray(dados) &&
              typeof dados.slug === 'string' &&
              typeof dados.projeto === 'string' &&
              dados.email &&
              typeof dados.email === 'object' &&
              !Array.isArray(dados.email) &&
              Array.isArray(dados.registros) &&
              // Novo, Etapa 1 de AtualizacaoDaPlanilhaViaUI.md: a planilha
              // bruta enviada passa a ser persistida junto ao projeto (ver
              // `persistirSheetBruto`), não só o EmailRecord[] já processado.
              arquivoBrutoValido(dados.arquivo) &&
              // Demanda 7 (Mapeamento de ID Personalizado, Etapa 7): campo
              // opcional — ausente/`undefined` (chamadores antigos de
              // `criarProjeto`) ou `null` (client atual, "Gerar
              // Automaticamente") são válidos; só bloqueia se vier um tipo
              // que não seja string nem null.
              (dados.colunaId === undefined || dados.colunaId === null || typeof dados.colunaId === 'string')

            if (!formatoValido) {
              throw new ApiError(
                400,
                'Corpo inválido: esperado objeto { slug, projeto, email, registros, arquivo }.'
              )
            }

            const { slug, projeto, email, registros, arquivo, colunaId } = dados as {
              slug: string
              projeto: string
              email: EmailsData['email']
              registros: EmailsData['registros']
              arquivo: { nomeArquivo: string; conteudoBase64: string }
              colunaId?: string | null
            }

            if (!slugEhSeguro(slug)) {
              throw new ApiError(400, 'Slug de projeto inválido.')
            }

            const diretorioProjeto = path.resolve(activeDirectory, slug)
            const caminhoProjetoRelativo = path.relative(activeDirectory, diretorioProjeto)
            if (caminhoProjetoRelativo.startsWith('..') || path.isAbsolute(caminhoProjetoRelativo)) {
              throw new ApiError(400, 'Slug de projeto inválido.')
            }

            // Garantia real de unicidade: checagem contra o disco, não contra
            // o array `PROJETOS` em memória (que só é atualizado em reload).
            if (fs.statSync(diretorioProjeto, { throwIfNoEntry: false })) {
              throw new ApiError(409, 'Já existe um projeto com esse slug.')
            }

            const agora = new Date().toISOString()
            const dadosProjeto: EmailsData = {
              projeto,
              criado_em: agora,
              atualizado_em: agora,
              email,
              registros,
              // Demanda 7 (Mapeamento de ID Personalizado, Etapa 7): grava o
              // campo só quando uma coluna de verdade foi escolhida — `null`
              // (client) ou `undefined` (chamadores antigos) viram ausência
              // do campo no JSON persistido, mesmo padrão de "Gerar
              // Automaticamente" já usado em todo o resto da demanda
              // (`EmailsData.colunaId` é opcional, não `string | null`).
              ...(typeof colunaId === 'string' && colunaId !== '' ? { colunaId } : {}),
            }

            fs.mkdirSync(diretorioProjeto, { recursive: true })
            const emailsJsonPath = path.resolve(diretorioProjeto, 'emails.json')
            fs.writeFileSync(emailsJsonPath, JSON.stringify(dadosProjeto, null, 2) + '\n', 'utf-8')
            // Novo, Etapa 1: cópia extra do arquivo original, ao lado de
            // emails.json — sem alterar o restante do fluxo de criação.
            persistirSheetBruto(diretorioProjeto, arquivo.nomeArquivo, arquivo.conteudoBase64)

            // Etapa 2: `importar_planilha` está em `ACOES_SEMPRE_REAIS`
            // (`registrarLog.ts`) — sempre grava, mesmo com `quantidade: 0`.
            registrarLog('importar_planilha', { projeto: slug, quantidade: registros.length })

            res.statusCode = 201
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, slug }))
          } catch (err) {
            registrarErroServidor(err, 'POST /api/projetos')
            const status = err instanceof ApiError ? err.status : 500
            res.statusCode = status
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            }))
          }
        })
      })
    },
  }
}

/**
 * Item de resposta de `GET /api/lixeira`, um por pasta em `data/trash/`.
 */
interface ItemLixeira {
  slug: string
  projeto: string
  deletado_em: string
  diasRestantes: number
  totalRegistros: number
}

const MS_POR_DIA = 24 * 60 * 60 * 1000

/**
 * Handler de `GET /api/lixeira` — lista os projetos na lixeira (Etapa 6 de
 * implementacaoDelecao.md). Varre `data/trash/*\/emails.json` e calcula
 * `diasRestantes` a partir de `deletado_em`. Expiração de 30 dias é
 * oportunista (seção 2 do plano — decisão consciente, não descuido): não há
 * processo de longa duração nesta fase local, então o expurgo definitivo
 * (`fs.rmSync`) de itens vencidos acontece aqui, a cada chamada desta rota,
 * antes de montar a resposta — um `GET` com efeito colateral.
 */
function handleListarLixeira(res: import('node:http').ServerResponse) {
  try {
    fs.mkdirSync(trashDirectory, { recursive: true })

    const entradas = fs
      .readdirSync(trashDirectory, { withFileTypes: true })
      .filter((entrada) => entrada.isDirectory())

    const itens: ItemLixeira[] = []

    for (const entrada of entradas) {
      const diretorioItem = path.resolve(trashDirectory, entrada.name)
      const emailsJsonPath = path.resolve(diretorioItem, 'emails.json')

      let dados: EmailsData
      try {
        dados = JSON.parse(fs.readFileSync(emailsJsonPath, 'utf-8'))
      } catch {
        // Pasta corrompida/incompleta dentro da lixeira: ignorada da
        // listagem em vez de derrubar a rota inteira por causa de um item.
        continue
      }

      if (!dados.deletado_em) {
        // Não deveria acontecer — todo item chega aqui via a Etapa 2, que
        // sempre grava `deletado_em` antes de mover a pasta — mas sem essa
        // data não há como calcular `diasRestantes`, então o item é
        // ignorado em vez de quebrar a listagem.
        continue
      }

      const diasRestantes =
        30 - Math.floor((Date.now() - new Date(dados.deletado_em).getTime()) / MS_POR_DIA)

      if (diasRestantes <= 0) {
        fs.rmSync(diretorioItem, { recursive: true, force: true })
        continue
      }

      itens.push({
        // Identidade real do projeto é o campo `slug` do JSON (ver
        // src/types/email.ts), não o nome físico da pasta — este só entra
        // como rede de segurança para um item que, por algum motivo fora
        // do fluxo normal da Etapa 2, tenha chegado à lixeira sem o campo.
        slug: dados.slug ?? entrada.name.split('--')[0],
        projeto: dados.projeto,
        deletado_em: dados.deletado_em,
        diasRestantes,
        totalRegistros: dados.registros.length,
      })
    }

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(itens))
  } catch (err) {
    registrarErroServidor(err, 'GET /api/lixeira')
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }))
  }
}

/**
 * Handler de `POST /api/lixeira/restaurar` — restauração em lote, caminho
 * feliz + detecção de conflito (Etapa 8 de implementacaoDelecao.md). Corpo
 * `{ slugs: string[] }`, mesmo formato de lote de `DELETE /api/projetos`
 * (Etapa 2), pelo mesmo motivo (seção 2 do plano): evita duas rotas fazendo
 * a mesma coisa para os casos individual e em lote.
 *
 * Para cada slug: localiza a pasta em `data/trash/` pelo campo `slug`
 * interno do `emails.json` — nunca pelo nome físico da pasta, que carrega o
 * timestamp da exclusão e não é a identidade real do projeto (ver
 * `src/types/email.ts`, junto de `EmailsData`). Se `data/active/<slug>`
 * ainda não existir, restaura de fato: `deletado_em` é removido do JSON
 * antes de mover a pasta de volta para `data/active/<slug>` (nome original,
 * sem timestamp). Se já existir um projeto ativo com esse slug, nada é
 * movido — o item volta marcado como conflito, com os dados completos dos
 * dois lados (o projeto ativo e o da lixeira), para a Etapa 9 (modal de
 * resolução) resolver sem precisar de uma segunda chamada ao servidor.
 */
function handleRestaurarProjetos(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) {
  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', () => {
    try {
      const dados = JSON.parse(body || '{}')

      const formatoValido =
        dados &&
        typeof dados === 'object' &&
        !Array.isArray(dados) &&
        Array.isArray(dados.slugs) &&
        dados.slugs.every((s: unknown) => typeof s === 'string')

      if (!formatoValido) {
        throw new ApiError(400, 'Corpo inválido: esperado objeto { slugs: string[] }.')
      }

      const { slugs } = dados as { slugs: string[] }

      const resultados = slugs.map((slug) => {
        try {
          if (!slugEhSeguro(slug)) {
            throw new ApiError(400, 'Slug de projeto inválido.')
          }

          // Busca a pasta em data/trash/ pelo campo `slug` interno do JSON
          // — mesma lógica de identidade de `handleListarLixeira` (Etapa 6),
          // já que o nome físico da pasta (`<slug>--<timestamp>`) não é
          // confiável sozinho para essa busca.
          fs.mkdirSync(trashDirectory, { recursive: true })
          const entradasLixeira = fs
            .readdirSync(trashDirectory, { withFileTypes: true })
            .filter((entrada) => entrada.isDirectory())

          let nomePastaLixeira: string | null = null
          let dadosLixeira: EmailsData | null = null

          for (const entrada of entradasLixeira) {
            const emailsJsonPath = path.resolve(trashDirectory, entrada.name, 'emails.json')
            let candidato: EmailsData
            try {
              candidato = JSON.parse(fs.readFileSync(emailsJsonPath, 'utf-8'))
            } catch {
              continue
            }
            const slugCandidato = candidato.slug ?? entrada.name.split('--')[0]
            if (slugCandidato === slug) {
              nomePastaLixeira = entrada.name
              dadosLixeira = candidato
              break
            }
          }

          if (!nomePastaLixeira || !dadosLixeira) {
            throw new ApiError(404, 'Planilha não encontrada na lixeira.')
          }

          const diretorioAtivo = path.resolve(activeDirectory, slug)
          const caminhoAtivoRelativo = path.relative(activeDirectory, diretorioAtivo)
          if (caminhoAtivoRelativo.startsWith('..') || path.isAbsolute(caminhoAtivoRelativo)) {
            throw new ApiError(400, 'Slug de projeto inválido.')
          }

          const jaExisteAtivo = fs
            .statSync(diretorioAtivo, { throwIfNoEntry: false })
            ?.isDirectory()

          if (jaExisteAtivo) {
            const emailsJsonAtivoPath = path.resolve(diretorioAtivo, 'emails.json')
            const dadosAtivo: EmailsData = JSON.parse(fs.readFileSync(emailsJsonAtivoPath, 'utf-8'))
            return {
              slug,
              ok: false as const,
              conflito: { ativo: dadosAtivo, lixeira: dadosLixeira },
            }
          }

          const diretorioLixeira = path.resolve(trashDirectory, nomePastaLixeira)
          const emailsJsonLixeiraPath = path.resolve(diretorioLixeira, 'emails.json')
          const dadosRestaurados: EmailsData = { ...dadosLixeira }
          delete dadosRestaurados.deletado_em
          fs.writeFileSync(emailsJsonLixeiraPath, JSON.stringify(dadosRestaurados, null, 2) + '\n', 'utf-8')
          fs.renameSync(diretorioLixeira, diretorioAtivo)

          registrarLog('restaurar_projeto', { projeto: slug })

          return { slug, ok: true as const }
        } catch (err) {
          registrarErroServidor(err, 'POST /api/lixeira/restaurar (item)')
          return {
            slug,
            ok: false as const,
            error: err instanceof Error ? err.message : String(err),
          }
        }
      })

      const algumaFalha = resultados.some((r) => !r.ok)
      res.statusCode = algumaFalha ? 207 : 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: !algumaFalha, resultados }))
    } catch (err) {
      registrarErroServidor(err, 'POST /api/lixeira/restaurar')
      const status = err instanceof ApiError ? err.status : 500
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }))
    }
  })
}

/**
 * Handler de `DELETE /api/lixeira` — exclusão permanente em lote (Etapa 10
 * de implementacaoDelecao.md). Corpo `{ slugs: string[] }`, mesmo formato
 * de lote das demais rotas (seção 2 do plano). Para cada slug, localiza a
 * pasta em `data/trash/` pelo campo `slug` interno do JSON (mesma busca de
 * `handleRestaurarProjetos`, Etapa 8 — nunca pelo nome físico) e remove a
 * pasta inteira com `fs.rmSync(..., { recursive: true, force: true })`.
 * Cada slug é tratado de forma independente: uma falha isolada (slug não
 * encontrado na lixeira) não impede o processamento dos demais.
 */
function handleExcluirPermanentemente(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) {
  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', () => {
    try {
      const dados = JSON.parse(body || '{}')

      const formatoValido =
        dados &&
        typeof dados === 'object' &&
        !Array.isArray(dados) &&
        Array.isArray(dados.slugs) &&
        dados.slugs.every((s: unknown) => typeof s === 'string')

      if (!formatoValido) {
        throw new ApiError(400, 'Corpo inválido: esperado objeto { slugs: string[] }.')
      }

      const { slugs } = dados as { slugs: string[] }

      fs.mkdirSync(trashDirectory, { recursive: true })
      // Mesmo snapshot da lixeira reaproveitado para localizar cada slug do
      // lote — uma pasta já removida por um item anterior do mesmo lote só
      // faz a leitura de seu emails.json falhar (ENOENT), pulada pelo
      // `catch` interno como qualquer outra pasta corrompida/ilegível.
      const entradasLixeira = fs
        .readdirSync(trashDirectory, { withFileTypes: true })
        .filter((entrada) => entrada.isDirectory())

      const resultados = slugs.map((slug) => {
        try {
          if (!slugEhSeguro(slug)) {
            throw new ApiError(400, 'Slug de projeto inválido.')
          }

          let nomePasta: string | null = null
          for (const entrada of entradasLixeira) {
            const emailsJsonPath = path.resolve(trashDirectory, entrada.name, 'emails.json')
            let candidato: EmailsData
            try {
              candidato = JSON.parse(fs.readFileSync(emailsJsonPath, 'utf-8'))
            } catch {
              continue
            }
            const slugCandidato = candidato.slug ?? entrada.name.split('--')[0]
            if (slugCandidato === slug) {
              nomePasta = entrada.name
              break
            }
          }

          if (!nomePasta) {
            throw new ApiError(404, 'Planilha não encontrada na lixeira.')
          }

          fs.rmSync(path.resolve(trashDirectory, nomePasta), { recursive: true, force: true })

          registrarLog('deletar_projeto_permanente', { projeto: slug })

          return { slug, ok: true as const }
        } catch (err) {
          registrarErroServidor(err, 'DELETE /api/lixeira (item)')
          return {
            slug,
            ok: false as const,
            error: err instanceof Error ? err.message : String(err),
          }
        }
      })

      const algumaFalha = resultados.some((r) => !r.ok)
      res.statusCode = algumaFalha ? 207 : 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: !algumaFalha, resultados }))
    } catch (err) {
      registrarErroServidor(err, 'DELETE /api/lixeira')
      const status = err instanceof ApiError ? err.status : 500
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }))
    }
  })
}

/**
 * Middleware de dev server para `/api/lixeira` (Etapa 6, Etapa 8 e Etapa 10
 * de implementacaoDelecao.md). Plugin dedicado — rota separada de
 * `/api/projetos`, sem nenhum verbo em comum com ela. Roteia `GET /`
 * (listagem, Etapa 6), `POST /restaurar` (Etapa 8) e, a partir da Etapa 10,
 * `DELETE /` (exclusão permanente).
 */
function lixeiraApiPlugin() {
  return {
    name: 'lixeira-api',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/api/lixeira', (req, res) => {
        const caminho = (req.url ?? '/').split('?')[0]

        if (req.method === 'GET' && (caminho === '/' || caminho === '')) {
          handleListarLixeira(res)
          return
        }

        if (req.method === 'POST' && caminho.replace(/\/+$/, '') === '/restaurar') {
          handleRestaurarProjetos(req, res)
          return
        }

        if (req.method === 'DELETE' && (caminho === '/' || caminho === '')) {
          handleExcluirPermanentemente(req, res)
          return
        }

        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Rota não encontrada.' }))
      })
    },
  }
}

/**
 * Tipos de ação aceitos por `POST /api/logs` — subconjunto da taxonomia
 * completa (`TIPOS_ACAO`, `types/log.ts`): só os dois eventos que nascem
 * no cliente sem um handler de mutação de servidor ao qual se anexar
 * (planner, seção 3, tabela de endpoints). Todo handler de mutação real
 * (Etapa 2) chama `registrarLog` diretamente — não passa por este
 * endpoint. Espelha `AcaoLogCliente` em `src/services/logsApi.ts`; mantenha
 * os dois sincronizados se a whitelist mudar. `erro_cliente` só passa a
 * ser emitido de fato a partir da Etapa 4.
 */
const ACOES_ACEITAS_POST_LOGS = new Set<TipoAcao>(['exportar_planilha', 'erro_cliente'])

function corpoValidoParaPostLogs(valor: unknown): valor is { acao: TipoAcao; dados?: DadosLog } {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) return false
  const objeto = valor as { acao?: unknown; dados?: unknown }
  if (typeof objeto.acao !== 'string' || !ACOES_ACEITAS_POST_LOGS.has(objeto.acao as TipoAcao)) {
    return false
  }
  return (
    objeto.dados === undefined ||
    (typeof objeto.dados === 'object' && objeto.dados !== null && !Array.isArray(objeto.dados))
  )
}

/**
 * Handler de `POST /api/logs` (novo, Etapa 3) — recebe `{ acao, dados? }`
 * de eventos originados no cliente (`registrarLogCliente`,
 * `services/logsApi.ts`) e repassa direto para `registrarLog` (Etapa 1),
 * mesma validação/whitelist/no-op/guard anti-loop de qualquer outro ponto
 * de mutação — este handler não duplica nenhuma dessas regras, só valida
 * o formato do corpo e a whitelist restrita (`ACOES_ACEITAS_POST_LOGS`)
 * antes de repassar.
 */
function handleReceberLogCliente(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) {
  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', () => {
    try {
      const corpo = JSON.parse(body || '{}')
      if (!corpoValidoParaPostLogs(corpo)) {
        throw new ApiError(
          400,
          'Corpo inválido: esperado objeto { acao, dados? }, com acao em "exportar_planilha" ou "erro_cliente".',
        )
      }
      registrarLog(corpo.acao, corpo.dados ?? {})
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: true }))
    } catch (err) {
      registrarErroServidor(err, 'POST /api/logs')
      const status = err instanceof ApiError ? err.status : 500
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }))
    }
  })
}

/**
 * Quantidade fixa de itens por página de `GET /api/logs` (seção 6 do
 * planner: "fixa em 50 por página, sem opção de o usuário mudar o
 * tamanho") — nenhum query param sobrescreve este valor.
 */
const TAMANHO_PAGINA_LOGS = 50

/** Formato de resposta de `GET /api/logs` (Etapa 5, ajustada na Etapa 6). Espelhado em `services/logsApi.ts` (`RespostaListagemLogs`) — mantenha os dois sincronizados. */
interface RespostaListagemLogs {
  itens: LinhaLog[]
  pagina: number
  /**
   * `true` quando existe pelo menos mais um item além dos já devolvidos
   * nesta página — descoberto durante a própria leitura sequencial (early-
   * exit da seção 6), nunca por uma contagem total à parte, que exigiria
   * ler todo o histórico a cada request.
   */
  temProximaPagina: boolean
  /**
   * Ajuste de rota (Etapa 6): campo novo, não previsto na Etapa 5. A tela
   * `/logs` precisa saber se `LOGS_ATIVOS=false` no ambiente atual para
   * exibir o banner somente-leitura da seção 6 ("o GET /api/logs pode
   * retornar esse estado junto da listagem") — sem isso, o cliente não tem
   * nenhuma forma de descobrir o valor de uma variável de ambiente do
   * servidor. Reflete `process.env.LOGS_ATIVOS` no momento da consulta, com
   * o mesmo critério de `registrarLog` (`registrarLog.ts`): qualquer valor
   * diferente de `"false"` conta como ativo.
   */
  logsAtivos: boolean
}

/**
 * Lista, em ordem decrescente de nome de arquivo (`<AAAA-MM>.jsonl`), os
 * meses já gravados em `data/logs/` — mês mais recente primeiro, mesma
 * ordem de leitura pedida pela seção 6 ("mês mais recente → mais antigo").
 * Devolve array vazio se a pasta ainda não existir (nenhum log gravado
 * ainda), sem lançar.
 */
function listarArquivosMensaisDeLogs(): string[] {
  const diretorio = path.resolve(process.cwd(), 'data', 'logs')
  if (!fs.statSync(diretorio, { throwIfNoEntry: false })?.isDirectory()) {
    return []
  }
  return fs
    .readdirSync(diretorio)
    .filter((nome) => /^\d{4}-\d{2}\.jsonl$/.test(nome))
    .sort()
    .reverse()
    .map((nome) => path.resolve(diretorio, nome))
}

/** `true` se `linha` pertence à aba pedida ("Ações" ou "Erros", seção 6). */
function linhaCorrespondeAba(linha: LinhaLog, aba: 'acoes' | 'erros'): boolean {
  return aba === 'erros' ? ehTipoAcaoErro(linha.acao) : !ehTipoAcaoErro(linha.acao)
}

/**
 * `true` se `linha.data` (sempre UTC, seção 4) cai dentro de
 * `[dataInicio, dataFim]` — limites inclusivos, cada um opcional (range
 * aberto de um dos lados quando ausente). Dia único é só um caso particular
 * do cliente mandar `dataInicio`/`dataFim` do mesmo dia (conversão de fuso
 * horário local → UTC é responsabilidade de quem monta a query, seção 6 —
 * este handler só compara timestamps já em UTC, sem conhecer o fuso do
 * cliente).
 */
function linhaCorrespondeData(linha: LinhaLog, dataInicio: string | null, dataFim: string | null): boolean {
  const timestamp = Date.parse(linha.data)
  if (dataInicio !== null && timestamp < Date.parse(dataInicio)) return false
  if (dataFim !== null && timestamp > Date.parse(dataFim)) return false
  return true
}

/**
 * `true` se `busca` (case-insensitive, substring) aparece em algum dos
 * campos pesquisáveis da seção 6 ("nome, tipo, projeto, registroId ou id da
 * alteração"). Ajuste de rota: nenhum desses cinco nomes é literalmente um
 * campo de `LinhaLog` (seção 4) — "tipo" é `acao`, e não existe campo
 * "nome" no formato gravado. Interpretação adotada: `acao` cobre "tipo";
 * `mensagem` (texto montado por `montarMensagem`, Etapa 1, que já embute
 * nomes de campo/projeto quando relevante) cobre a intenção de buscar por
 * "nome" sem exigir um campo dedicado só para isso — junto de `projeto`,
 * `registroId` e `id`, que têm correspondência direta.
 */
function linhaCorrespondeBusca(linha: LinhaLog, busca: string | null): boolean {
  if (!busca) return true
  const alvo = busca.toLowerCase()
  const campos: unknown[] = [linha.acao, linha.projeto, linha.registroId, linha.id, linha.mensagem]
  return campos.some((campo) => typeof campo === 'string' && campo.toLowerCase().includes(alvo))
}

/**
 * Handler de `GET /api/logs` (novo, Etapa 5) — busca/filtro/paginação
 * (seção 6). Query params (nomes definidos nesta etapa, não especificados
 * literalmente pelo planner):
 * - `aba`: `'acoes'` (padrão) ou `'erros'` — alterna as duas abas da seção 6.
 * - `pagina`: inteiro ≥ 1 (padrão 1) — tamanho sempre `TAMANHO_PAGINA_LOGS`,
 *   nunca configurável pelo cliente.
 * - `busca`: texto livre, ver `linhaCorrespondeBusca`.
 * - `dataInicio`/`dataFim`: ISO 8601 em UTC, ambos opcionais e
 *   independentes — ver `linhaCorrespondeData`.
 *
 * Leitura sequencial mês a mês (mais recente → mais antigo,
 * `listarArquivosMensaisDeLogs`), e dentro de cada arquivo da linha mais
 * recente para a mais antiga (arquivo é append-only, então a ordem física
 * já é cronológica crescente — `reverse()` inverte para a ordem de leitura
 * pedida). Early-exit: para assim que a página pedida está cheia E mais um
 * item correspondente é encontrado (confirma `temProximaPagina` sem
 * precisar contar o restante do histórico) — nunca lê todo `data/logs/` à
 * toa, mesmo padrão de "nenhum handler mantém cache em memória" já citado
 * na seção 6.
 */
function handleListarLogs(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const params = url.searchParams

    const aba: 'acoes' | 'erros' = params.get('aba') === 'erros' ? 'erros' : 'acoes'
    const paginaBruta = Number(params.get('pagina'))
    const pagina = Number.isInteger(paginaBruta) && paginaBruta > 0 ? paginaBruta : 1
    const busca = params.get('busca')?.trim() || null
    const dataInicio = params.get('dataInicio') || null
    const dataFim = params.get('dataFim') || null

    const pular = (pagina - 1) * TAMANHO_PAGINA_LOGS
    const itens: LinhaLog[] = []
    let contador = 0
    let temProximaPagina = false

    busca_por_arquivos:
    for (const caminho of listarArquivosMensaisDeLogs()) {
      const conteudo = fs.readFileSync(caminho, 'utf-8')
      const linhasBrutas = conteudo.split('\n').filter((l) => l.trim().length > 0).reverse()

      for (const linhaBruta of linhasBrutas) {
        let linha: LinhaLog
        try {
          linha = JSON.parse(linhaBruta)
        } catch {
          // Linha corrompida/incompleta (ex.: escrita interrompida no meio):
          // ignorada da listagem, mesmo critério já usado para pastas
          // corrompidas da lixeira em outros handlers deste arquivo.
          continue
        }

        if (!linhaCorrespondeAba(linha, aba)) continue
        if (!linhaCorrespondeData(linha, dataInicio, dataFim)) continue
        if (!linhaCorrespondeBusca(linha, busca)) continue

        if (contador < pular) {
          contador++
          continue
        }

        if (itens.length < TAMANHO_PAGINA_LOGS) {
          itens.push(linha)
          contador++
          continue
        }

        temProximaPagina = true
        break busca_por_arquivos
      }
    }

    const logsAtivos = process.env.LOGS_ATIVOS !== 'false'
    const resposta: RespostaListagemLogs = { itens, pagina, temProximaPagina, logsAtivos }
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(resposta))
  } catch (err) {
    registrarErroServidor(err, 'GET /api/logs')
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }))
  }
}

/** Formatos aceitos por `GET /api/logs/export` (Etapa 7, seção 6: "CSV ou JSON"). */
type FormatoExportacaoLogs = 'csv' | 'json'

/** Formato de mês aceito por `mesInicio`/`mesFim` (Etapa 7): `AAAA-MM`. */
const REGEX_MES_EXPORTACAO = /^\d{4}-\d{2}$/

/**
 * Sequência de meses (`AAAA-MM`) de `inicio` até `fim`, ambos inclusivos,
 * em ordem crescente — usada por `handleExportarLogs` para saber quais
 * arquivos mensais ler. Assume `fim >= inicio` (já validado pelo chamador).
 */
function sequenciaDeMeses(inicio: string, fim: string): string[] {
  const [anoInicio, mesInicio] = inicio.split('-').map(Number)
  const [anoFim, mesFim] = fim.split('-').map(Number)
  const meses: string[] = []
  let ano = anoInicio
  let mes = mesInicio
  while (ano < anoFim || (ano === anoFim && mes <= mesFim)) {
    meses.push(`${ano}-${String(mes).padStart(2, '0')}`)
    mes++
    if (mes > 12) {
      mes = 1
      ano++
    }
  }
  return meses
}

/**
 * Lê e faz parse das linhas de `data/logs/<mes>.jsonl` — `[]` se o mês
 * ainda não tiver arquivo (nenhum log gravado naquele mês, não é erro) ou
 * se todas as linhas estiverem corrompidas. Mesmo critério de descarte de
 * linha corrompida já usado por `handleListarLogs` (Etapa 5).
 */
function lerLinhasDoMes(mes: string): LinhaLog[] {
  const caminho = path.resolve(process.cwd(), 'data', 'logs', `${mes}.jsonl`)
  if (!fs.statSync(caminho, { throwIfNoEntry: false })?.isFile()) return []
  const linhas: LinhaLog[] = []
  for (const linhaBruta of fs.readFileSync(caminho, 'utf-8').split('\n')) {
    if (!linhaBruta.trim()) continue
    try {
      linhas.push(JSON.parse(linhaBruta) as LinhaLog)
    } catch {
      continue
    }
  }
  return linhas
}

/**
 * Escapa um campo para o CSV de exportação de logs — mesmo critério de
 * `escaparCampoCsv` (`exportarPlanilha.ts`, client-side): separador `;`
 * (padrão Excel pt-BR), aspas quando o valor contém separador/aspas/quebra
 * de linha, dobrando aspas internas (RFC 4180).
 */
function escaparCampoCsvLog(valor: string): string {
  if (/[;"\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`
  return valor
}

/**
 * Colunas fixas do CSV de exportação (seção 6): `alteracoes_de`/
 * `alteracoes_para` são o `JSON.stringify` de `original`/`atual` — nunca
 * achatados em uma coluna por campo. Limitação conhecida, não fechada
 * nesta etapa: `origem`/`detalhe` (só existem em linhas de erro) não têm
 * coluna própria aqui — o planner (seção 6) fixa as colunas do CSV sem
 * mencionar esses dois campos; quem precisar deles na exportação usa JSON.
 */
const COLUNAS_CSV_LOGS = [
  'id',
  'data',
  'acao',
  'projeto',
  'registroId',
  'quantidade',
  'mensagem',
  'alteracoes_de',
  'alteracoes_para',
] as const

/** Monta o CSV de um mês de logs (seção 6) a partir das linhas já lidas/parseadas (`lerLinhasDoMes`). */
function gerarCsvDoMes(linhas: LinhaLog[]): string {
  const corpo = linhas.map((linha) =>
    [
      linha.id,
      linha.data,
      linha.acao,
      linha.projeto ?? '',
      linha.registroId ?? '',
      linha.quantidade ?? '',
      linha.mensagem,
      linha.original ? JSON.stringify(linha.original) : '',
      linha.atual ? JSON.stringify(linha.atual) : '',
    ]
      .map((campo) => escaparCampoCsvLog(String(campo)))
      .join(';')
  )
  return [COLUNAS_CSV_LOGS.join(';'), ...corpo].join('\r\n')
}

/** Conteúdo serializado de um mês, no formato pedido — mesmo gerador para o caso de arquivo único e para cada entrada do `.zip`. */
function conteudoExportacaoDoMes(mes: string, formato: FormatoExportacaoLogs): string {
  const linhas = lerLinhasDoMes(mes)
  return formato === 'csv' ? gerarCsvDoMes(linhas) : JSON.stringify(linhas, null, 2)
}

/**
 * Handler de `GET /api/logs/export` (novo, Etapa 7) — gera o arquivo (ou
 * `.zip`) de exportação dos próprios logs, por mês ou intervalo de meses,
 * em CSV ou JSON (seção 6). Não chama `registrarLog`: a exportação é
 * leitura sobre o próprio log, mesmo raciocínio de `GET /api/lixeira` não
 * ser logado (seção 6, última frase).
 *
 * Query params (nomes definidos nesta etapa, não especificados literalmente
 * pelo planner — mesmo critério da Etapa 5):
 * - `mesInicio` (obrigatório, `AAAA-MM`): primeiro mês do intervalo.
 * - `mesFim` (opcional, `AAAA-MM`): último mês — ausente equivale a mês
 *   único (mesmo critério de "Até" ausente = dia único, seção 6/Etapa 6).
 * - `formato` (obrigatório): `csv` ou `json`.
 *
 * 1 mês → arquivo direto (`Content-Disposition: attachment`); 2+ meses →
 * `.zip` com um arquivo por mês (seção 6) — nunca achatado num único
 * arquivo agregado.
 */
async function handleExportarLogs(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const params = url.searchParams

    const mesInicio = params.get('mesInicio')
    const mesFimBruto = params.get('mesFim')
    const formato = params.get('formato')

    if (!mesInicio || !REGEX_MES_EXPORTACAO.test(mesInicio)) {
      throw new ApiError(400, 'Parâmetro "mesInicio" obrigatório, no formato AAAA-MM.')
    }
    if (mesFimBruto && !REGEX_MES_EXPORTACAO.test(mesFimBruto)) {
      throw new ApiError(400, 'Parâmetro "mesFim" inválido, esperado formato AAAA-MM.')
    }
    const mesFim = mesFimBruto || mesInicio
    if (mesFim < mesInicio) {
      throw new ApiError(400, 'Parâmetro "mesFim" não pode ser anterior a "mesInicio".')
    }
    if (formato !== 'csv' && formato !== 'json') {
      throw new ApiError(400, 'Parâmetro "formato" obrigatório: "csv" ou "json".')
    }

    const meses = sequenciaDeMeses(mesInicio, mesFim)
    const extensao = formato

    if (meses.length === 1) {
      res.statusCode = 200
      res.setHeader('Content-Type', formato === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="logs-${meses[0]}.${extensao}"`)
      res.end(conteudoExportacaoDoMes(meses[0], formato))
      return
    }

    const zip = new JSZip()
    for (const mes of meses) {
      zip.file(`logs-${mes}.${extensao}`, conteudoExportacaoDoMes(mes, formato))
    }
    const bufferZip = await zip.generateAsync({ type: 'nodebuffer' })
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="logs-${mesInicio}_a_${mesFim}.zip"`)
    res.end(bufferZip)
  } catch (err) {
    registrarErroServidor(err, 'GET /api/logs/export')
    const status = err instanceof ApiError ? err.status : 500
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }))
  }
}

/**
 * Middleware de dev server para `/api/logs` (Etapa 3, Etapa 5, Etapa 7).
 * `POST /` (Etapa 3), `GET /` (listagem com filtro/paginação, Etapa 5) e
 * `GET /export` (exportação por mês/intervalo, Etapa 7).
 */
function logsApiPlugin() {
  return {
    name: 'logs-api',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/api/logs', (req, res) => {
        const caminho = (req.url ?? '/').split('?')[0]

        if (caminho === '/export') {
          if (req.method !== 'GET') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }))
            return
          }
          void handleExportarLogs(req, res)
          return
        }

        if (caminho !== '/' && caminho !== '') {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: 'Rota não encontrada.' }))
          return
        }

        if (req.method === 'POST') {
          handleReceberLogCliente(req, res)
          return
        }

        if (req.method === 'GET') {
          handleListarLogs(req, res)
          return
        }

        res.statusCode = 405
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }))
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), emailsApiPlugin(), projetosApiPlugin(), lixeiraApiPlugin(), logsApiPlugin()],
})