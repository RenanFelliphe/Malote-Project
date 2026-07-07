import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const emailsJsonPath = path.resolve(__dirname, 'data/emails.json')

/**
 * Middleware de dev server que persiste o array de registros em
 * data/emails.json. Usado pela Etapa 5 (atualização manual de status)
 * e será reaproveitado pelas próximas sub-etapas (exclusão/restauração).
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
            const registros = JSON.parse(body)
            fs.writeFileSync(emailsJsonPath, JSON.stringify(registros, null, 2) + '\n', 'utf-8')
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