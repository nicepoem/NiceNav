/**
 * 同域页面元数据 / 图标探测 API（开发 Vite 中间件与生产 serve 共用）
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function decodeEntities(input) {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
}

function cleanHtmlText(value, max = 240) {
  if (!value) return ''
  const text = decodeEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trim()}…`
}

function absUrl(base, maybeRelative) {
  if (!maybeRelative?.trim()) return ''
  try {
    return new URL(maybeRelative.trim(), base).href
  } catch {
    return ''
  }
}

function pickAttr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'))
  return match?.[2]?.trim() ?? ''
}

function pickMetaContent(html, key) {
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

function pickLinkHref(html, rel) {
  const tags = html.match(/<link\b[^>]*>/gi) ?? []
  const wanted = rel.toLowerCase()
  for (const tag of tags) {
    const relValue = pickAttr(tag, 'rel').toLowerCase()
    if (!relValue.split(/\s+/).includes(wanted) && !relValue.includes(wanted)) continue
    const href = pickAttr(tag, 'href')
    if (href) return href
  }
  return ''
}

function pickBodyText(html) {
  const withoutNoise = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
  const body = withoutNoise.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? withoutNoise
  return cleanHtmlText(body.replace(/<[^>]+>/g, ' '), 180)
}

export function parseHtmlMeta(html, pageUrl = '') {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title =
    cleanHtmlText(pickMetaContent(html, 'og:title')) ||
    cleanHtmlText(pickMetaContent(html, 'twitter:title')) ||
    cleanHtmlText(titleMatch?.[1] ?? '')

  const description =
    cleanHtmlText(pickMetaContent(html, 'description'), 320) ||
    cleanHtmlText(pickMetaContent(html, 'og:description'), 320) ||
    cleanHtmlText(pickMetaContent(html, 'twitter:description'), 320) ||
    (pageUrl ? pickBodyText(html) : '')

  const icon = pageUrl
    ? absUrl(pageUrl, pickLinkHref(html, 'apple-touch-icon')) ||
      absUrl(pageUrl, pickLinkHref(html, 'icon')) ||
      absUrl(pageUrl, pickMetaContent(html, 'og:image')) ||
      ''
    : ''

  return { title, description, icon }
}

async function fetchText(url, timeoutMs = 12000) {
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

export async function loadPageMeta(target) {
  const html = await fetchText(target)
  const meta = parseHtmlMeta(html, target)
  if (!meta.title && !meta.description) throw new Error('empty meta')
  return meta
}

export async function probeIconUrl(target, timeoutMs = 1600) {
  try {
    const response = await fetch(target, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'User-Agent': UA,
      },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) return false
    const type = (response.headers.get('content-type') || '').toLowerCase()
    if (
      type &&
      !type.includes('image') &&
      !type.includes('icon') &&
      !type.includes('octet-stream') &&
      !type.includes('application/xml')
    ) {
      return false
    }
    const buf = new Uint8Array(await response.arrayBuffer())
    return buf.byteLength >= 16
  } catch {
    return false
  }
}

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

/**
 * Connect / Vite 风格中间件：处理 /api/page-meta 与 /api/icon-probe
 */
export function createMetaApiMiddleware() {
  return async function metaApiMiddleware(req, res, next) {
    const rawUrl = req.url ?? ''

    if (rawUrl.startsWith('/api/icon-probe')) {
      const query = new URL(rawUrl, 'http://localhost').searchParams.get('url')
      if (!query || !/^https?:\/\//i.test(query)) {
        sendJson(res, 200, { ok: false })
        return
      }
      const ok = await probeIconUrl(query)
      sendJson(res, 200, { ok })
      return
    }

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
      sendJson(res, 200, meta)
    } catch (error) {
      res.statusCode = 502
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end(error instanceof Error ? error.message : 'fetch failed')
    }
  }
}
