import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { EmailsData } from './src/types/email'

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
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: true }))
    } catch (err) {
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
              (dados.projeto === undefined || typeof dados.projeto === 'string')

            if (!formatoValido) {
              throw new Error(
                'Corpo inválido: esperado objeto { email, registros, projeto? }.'
              )
            }

            const dadosAtuais = JSON.parse(fs.readFileSync(emailsJsonPath, 'utf-8'))
            const dadosMesclados = {
              ...dadosAtuais,
              atualizado_em: new Date().toISOString(),
              projeto: dados.projeto ?? dadosAtuais.projeto,
              email: dados.email,
              registros: dados.registros,
            }

            fs.writeFileSync(emailsJsonPath, JSON.stringify(dadosMesclados, null, 2) + '\n', 'utf-8')
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch (err) {
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

          return { slug, ok: true as const }
        } catch (err) {
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

      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: true, slug: novoSlug }))
    } catch (err) {
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
              arquivoBrutoValido(dados.arquivo)

            if (!formatoValido) {
              throw new ApiError(
                400,
                'Corpo inválido: esperado objeto { slug, projeto, email, registros, arquivo }.'
              )
            }

            const { slug, projeto, email, registros, arquivo } = dados as {
              slug: string
              projeto: string
              email: EmailsData['email']
              registros: EmailsData['registros']
              arquivo: { nomeArquivo: string; conteudoBase64: string }
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
            }

            fs.mkdirSync(diretorioProjeto, { recursive: true })
            const emailsJsonPath = path.resolve(diretorioProjeto, 'emails.json')
            fs.writeFileSync(emailsJsonPath, JSON.stringify(dadosProjeto, null, 2) + '\n', 'utf-8')
            // Novo, Etapa 1: cópia extra do arquivo original, ao lado de
            // emails.json — sem alterar o restante do fluxo de criação.
            persistirSheetBruto(diretorioProjeto, arquivo.nomeArquivo, arquivo.conteudoBase64)

            res.statusCode = 201
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, slug }))
          } catch (err) {
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

          return { slug, ok: true as const }
        } catch (err) {
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

          return { slug, ok: true as const }
        } catch (err) {
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

export default defineConfig({
  plugins: [react(), emailsApiPlugin(), projetosApiPlugin(), lixeiraApiPlugin()],
})