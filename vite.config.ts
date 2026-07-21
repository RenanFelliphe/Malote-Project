import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDirectory = path.resolve(__dirname, 'data')

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
            if (!slug || slug.includes('/') || slug.includes('\\') || slug === '.' || slug === '..') {
              throw new Error('Slug de projeto inválido.')
            }

            const diretorioProjeto = path.resolve(dataDirectory, slug)
            const caminhoProjetoRelativo = path.relative(dataDirectory, diretorioProjeto)
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

export default defineConfig({
  plugins: [react(), emailsApiPlugin()],
})