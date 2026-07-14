import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const emailsJsonPath = path.resolve(__dirname, 'data/emails.json')

/**
 * Middleware de dev server que persiste `data/emails.json`.
 *
 * A partir da migração descrita em REFATORACAO-EMAIL-TITULO-CONTEUDO.md, o
 * arquivo passou a ser o objeto completo `{ email, registros }` (EmailsData) —
 * não mais um array puro de registros. `salvarEmails` (services/emailsApi.ts)
 * sempre envia esse objeto completo, então o middleware valida explicitamente
 * o formato recebido antes de gravar, para não persistir silenciosamente um
 * corpo incompleto (ex.: um array de registros solto, que apagaria `email`).
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
                'Corpo inválido: esperado objeto { email, registros }, não um array de registros solto.'
              )
            }

            fs.writeFileSync(emailsJsonPath, JSON.stringify(dados, null, 2) + '\n', 'utf-8')
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