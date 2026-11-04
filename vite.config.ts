import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { defineConfig, type Plugin } from 'vite'
import { parseHtmlMeta } from './src/core/html-meta.ts'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function fetchText(url: string, timeoutMs = 12000): Promise<string> {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
      'User-Agent': UA,
    },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}

/** 仅直连目标页，不走第三方可读代理（本地优先） */
async function loadPageMeta(target: string) {
  const html = await fetchText(target)
  const meta = parseHtmlMeta(html, target)
  if (!meta.title && !meta.description) throw new Error('empty meta')
  return meta
}

/** 开发时由 Vite 代抓目标网页，避开浏览器跨域 */
function pageMetaProxy(): Plugin {
  return {
    name: 'page-meta-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url ?? ''
        if (!rawUrl.startsWith('/api/page-meta')) {
          next()
          return
        }

        const query = new URL(rawUrl, 'http://localhost').searchParams.get('url')
        if (!query || !/^https?:\/\//i.test(query)) {
          res.statusCode = 400
          res.end('bad url')
          return
        }

        try {
          const meta = await loadPageMeta(query)
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.end(JSON.stringify(meta))
        } catch (error) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end(error instanceof Error ? error.message : 'fetch failed')
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [
    pageMetaProxy(),
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver({ importStyle: 'css' })],
      dts: 'src/types/auto-imports.d.ts',
    }),
    Components({
      resolvers: [ElementPlusResolver({ importStyle: 'css' })],
      dts: 'src/types/components.d.ts',
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@nice-nav/core': fileURLToPath(new URL('./src/core', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
})
