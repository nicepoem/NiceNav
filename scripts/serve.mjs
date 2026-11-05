/**
 * 生产静态站 + 同域元数据 API
 * 用法：pnpm build && pnpm start
 * 环境变量：PORT（默认 4173）、HOST（默认 0.0.0.0）
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMetaApiMiddleware } from '../server/meta-api.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')
const host = process.env.HOST || '0.0.0.0'
const port = Number(process.env.PORT || 4173)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('[serve] 未找到 dist/index.html，请先执行 pnpm build')
  process.exit(1)
}

const metaApi = createMetaApiMiddleware()

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase()
  res.statusCode = 200
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
  fs.createReadStream(filePath).pipe(res)
}

function safeJoin(base, reqPath) {
  const decoded = decodeURIComponent(reqPath.split('?')[0] || '/')
  const cleaned = path.normalize(decoded).replace(/^([/\\])+/, '')
  const full = path.join(base, cleaned)
  if (!full.startsWith(base)) return null
  return full
}

const server = http.createServer((req, res) => {
  metaApi(req, res, () => {
    const urlPath = (req.url || '/').split('?')[0] || '/'
    let filePath = safeJoin(dist, urlPath === '/' ? '/index.html' : urlPath)
    if (!filePath) {
      res.statusCode = 400
      res.end('bad path')
      return
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html')
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      sendFile(res, filePath)
      return
    }

    // SPA fallback
    sendFile(res, path.join(dist, 'index.html'))
  })
})

server.listen(port, host, () => {
  console.log(`[serve] http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`)
  console.log('[serve] /api/page-meta 与 /api/icon-probe 已启用')
})
