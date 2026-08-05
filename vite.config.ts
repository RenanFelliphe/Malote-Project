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
 * Middleware de dev server que persiste `data/<slug>/emails.json`.
 *
 * A partir da migração descrita em REFATORACAO-EMAIL-TITULO-CONTEUDO.md, o
 * arquivo passou a ser o objeto completo `{ email, registros }` (EmailsData) —
 * não mais um array puro de registros. `salvarEmails` (services/emailsApi.ts)
 * envia apenas `{ email, registros }`; os metadados do projeto são preservados
 * pelo merge feito aqui, no servidor.
 */
function emailsApiPlugin() {
  return {
    name: 'emails-api',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/api/emails', (req, res) => {
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
              Array.isArray(dados.registros)

            if (!formatoValido) {
              throw new Error(
                'Corpo inválido: esperado objeto { email, registros }.'
              )
            }

            const dadosAtuais = JSON.parse(fs.readFileSync(emailsJsonPath, 'utf-8'))
            const dadosMesclados = {
              ...dadosAtuais,
              atualizado_em: new Date().toISOString(),
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
              Array.isArray(dados.registros)

            if (!formatoValido) {
              throw new ApiError(
                400,
                'Corpo inválido: esperado objeto { slug, projeto, email, registros }.'
              )
            }

            const { slug, projeto, email, registros } = dados as {
              slug: string
              projeto: string
              email: EmailsData['email']
              registros: EmailsData['registros']
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

export default defineConfig({
  plugins: [react(), emailsApiPlugin(), projetosApiPlugin()],
})