import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { defineConfig, type Plugin } from 'vite'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function cleanText(value: string, max = 240): string {
  const text = value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trim()}…`
}

function pickAttr(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'))
  return match?.[2]?.trim() ?? ''
}

function pickMetaContent(html: string, key: string): string {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? []
  const wanted = key.toLowerCase()
  for (const tag of tags) {
    const name = (pickAttr(tag, 'name') || pickAttr(tag, 'property')).toLowerCase()
    if (name !== wanted) continue
    const content = pickAttr(tag, 'content')
    if (content) return content
  }
  return ''
}

function parseHtmlMeta(html: string) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title =
    cleanText(pickMetaContent(html, 'og:title')) ||
    cleanText(pickMetaContent(html, 'twitter:title')) ||
    cleanText(titleMatch?.[1] ?? '')

  const description =
    cleanText(pickMetaContent(html, 'description'), 320) ||
    cleanText(pickMetaContent(html, 'og:description'), 320) ||
    cleanText(pickMetaContent(html, 'twitter:description'), 320)

  return { title, description, icon: '' }
}

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

async function loadPageMeta(target: string) {
  try {
    const html = await fetchText(target)
    const meta = parseHtmlMeta(html)
    if (meta.title || meta.description) return meta
  } catch {
    // 直连失败时走可读代理
  }

  const text = await fetchText(`https://r.jina.ai/${target}`)
  const title = text.match(/^Title:\s*(.+)$/m)?.[1]?.trim() ?? ''
  const body = text.split('Markdown Content:')[1] ?? text
  const description = cleanText(body, 180)
  if (!title && !description) throw new Error('empty meta')
  return { title, description, icon: '' }
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
      resolvers: [ElementPlusResolver()],
      dts: 'src/types/auto-imports.d.ts',
    }),
    Components({
      resolvers: [ElementPlusResolver()],
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
