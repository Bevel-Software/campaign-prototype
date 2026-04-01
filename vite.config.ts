import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const SESSION_FILE = path.resolve(__dirname, 'data/session.json')
const DATA_DIR = path.dirname(SESSION_FILE)

function sessionApiPlugin() {
  return {
    name: 'session-api',
    configureServer(server: { middlewares: { use: Function } }) {
      server.middlewares.use('/api/session', (req: any, res: any) => {
        if (req.method === 'GET') {
          if (fs.existsSync(SESSION_FILE)) {
            const data = fs.readFileSync(SESSION_FILE, 'utf-8')
            res.setHeader('Content-Type', 'application/json')
            res.end(data)
          } else {
            res.statusCode = 404
            res.end(JSON.stringify({ error: 'No session found' }))
          }
          return
        }

        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: string) => { body += chunk })
          req.on('end', () => {
            if (!fs.existsSync(DATA_DIR)) {
              fs.mkdirSync(DATA_DIR, { recursive: true })
            }
            fs.writeFileSync(SESSION_FILE, body, 'utf-8')
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          })
          return
        }

        res.statusCode = 405
        res.end(JSON.stringify({ error: 'Method not allowed' }))
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), sessionApiPlugin()],
})
