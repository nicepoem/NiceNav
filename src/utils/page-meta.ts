export type PageMeta = {
  title: string
  description: string
  icon: string
}

type ChromeRuntime = {
  id?: string
  sendMessage: (
    message: unknown,
    responseCallback?: (response: unknown) => void,
  ) => void
  lastError?: { message?: string }
}

declare global {
  interface Window {
    chrome?: { runtime?: ChromeRuntime }
  }
}

function decodeEntities(input: string): string {
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

function cleanText(value: string | null | undefined, max = 240): string {
  if (!value) return ''
  const text = decodeEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trim()}…`
}

function absUrl(base: string, maybeRelative: string | null | undefined): string {
  if (!maybeRelative?.trim()) return ''
  try {
    return new URL(maybeRelative.trim(), base).href
  } catch {
    return ''
  }
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

function pickLinkHref(html: string, rel: string): string {
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

function pickBodyText(html: string): string {
  const withoutNoise = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
  const body = withoutNoise.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? withoutNoise
  return cleanText(body.replace(/<[^>]+>/g, ' '), 180)
}

/** 从 HTML 抽取标题 / 简介 / 图标 */
export function parseHtmlMeta(html: string, pageUrl: string): PageMeta {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title =
    cleanText(pickMetaContent(html, 'og:title')) ||
    cleanText(pickMetaContent(html, 'twitter:title')) ||
    cleanText(titleMatch?.[1] ?? '')

  const description =
    cleanText(pickMetaContent(html, 'description'), 320) ||
    cleanText(pickMetaContent(html, 'og:description'), 320) ||
    cleanText(pickMetaContent(html, 'twitter:description'), 320) ||
    pickBodyText(html)

  const icon =
    absUrl(pageUrl, pickLinkHref(html, 'apple-touch-icon')) ||
    absUrl(pageUrl, pickLinkHref(html, 'icon')) ||
    absUrl(pageUrl, pickMetaContent(html, 'og:image')) ||
    ''

  return { title, description, icon }
}

export function normalizeSiteUrl(
  protocol: 'https://' | 'http://',
  rawHostPath: string,
): string | null {
  let host = rawHostPath.trim().replace(/[\u200b\u00a0]/g, '')
  if (!host) return null

  // 粘贴完整链接时同步识别协议
  let proto = protocol
  if (/^https:\/\//i.test(host)) {
    proto = 'https://'
    host = host.replace(/^https:\/\//i, '')
  } else if (/^http:\/\//i.test(host)) {
    proto = 'http://'
    host = host.replace(/^http:\/\//i, '')
  }

  host = host.replace(/\/+$/, '')
  if (!host || /\s/.test(host)) return null

  try {
    const url = new URL(`${proto}${host}`)
    if (!url.hostname) return null
    // 允许 example.com / localhost:5173 / IP
    const hostOk =
      url.hostname.includes('.') ||
      url.hostname === 'localhost' ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname)
    if (!hostOk) return null
    return url.href
  } catch {
    return null
  }
}

function withTimeout<T>(promise: Promise<T | null>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      () => {
        window.clearTimeout(timer)
        resolve(null)
      },
    )
  })
}

function asMeta(data: Partial<PageMeta> | null | undefined): PageMeta | null {
  if (!data) return null
  const meta: PageMeta = {
    title: cleanText(data.title ?? ''),
    description: cleanText(data.description ?? '', 320),
    icon: String(data.icon ?? '').trim(),
  }
  return meta.title || meta.description || meta.icon ? meta : null
}

async function fetchViaDevProxy(url: string): Promise<PageMeta | null> {
  if (!import.meta.env.DEV) return null
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch(`/api/page-meta?url=${encodeURIComponent(url)}`, {
      signal: controller.signal,
    })
    if (!res.ok) return null
    return asMeta((await res.json()) as Partial<PageMeta>)
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

async function fetchViaExtension(url: string): Promise<PageMeta | null> {
  const runtime = window.chrome?.runtime
  if (!runtime?.id) return null

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), 10000)
    try {
      runtime.sendMessage({ type: 'FETCH_PAGE_META', url }, (response) => {
        window.clearTimeout(timer)
        if (runtime.lastError || !response || typeof response !== 'object') {
          resolve(null)
          return
        }
        const data = response as Partial<PageMeta> & { error?: string }
        if (data.error) {
          resolve(null)
          return
        }
        resolve(asMeta(data))
      })
    } catch {
      window.clearTimeout(timer)
      resolve(null)
    }
  })
}

async function fetchHtmlDirect(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      credentials: 'omit',
      mode: 'cors',
      redirect: 'follow',
    })
    if (!res.ok) return null
    const type = res.headers.get('content-type') || ''
    if (type && !/text\/html|application\/xhtml/i.test(type)) return null
    return await res.text()
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

async function fetchViaMicrolink(url: string): Promise<PageMeta | null> {
  const endpoint = `https://api.microlink.io/?url=${encodeURIComponent(url)}&meta=true`
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(endpoint, { signal: controller.signal })
    if (!res.ok) return null
    const json = (await res.json()) as {
      status?: string
      data?: {
        title?: string
        description?: string
        image?: { url?: string }
        logo?: { url?: string }
      }
    }
    if (json.status !== 'success' || !json.data) return null
    return asMeta({
      title: json.data.title ?? '',
      description: json.data.description ?? '',
      icon: json.data.logo?.url || json.data.image?.url || '',
    })
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

/** 浏览器侧 CORS 代理：取 HTML 后再本地解析 */
async function fetchViaAllOrigins(url: string): Promise<PageMeta | null> {
  const endpoint = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(endpoint, { signal: controller.signal })
    if (!res.ok) return null
    const html = await res.text()
    if (!html || html.length < 32) return null
    return asMeta(parseHtmlMeta(html, url))
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

function metaScore(meta: PageMeta): number {
  let score = 0
  if (meta.title) score += 2
  if (meta.description) score += 3
  if (meta.icon) score += 1
  if (meta.description.length > 24) score += 1
  return score
}

/** 并行抓取，短时间内取分数最高的结果 */
async function bestMeta(
  tasks: Array<Promise<PageMeta | null>>,
  fallback: PageMeta,
  waitMs = 2600,
): Promise<PageMeta> {
  return new Promise((resolve) => {
    let pending = tasks.length
    let best: PageMeta | null = null
    let settled = false

    const finish = (meta: PageMeta) => {
      if (settled) return
      settled = true
      resolve(meta)
    }

    const timer = window.setTimeout(() => {
      finish(best ?? fallback)
    }, waitMs)

    const done = (meta: PageMeta | null) => {
      if (settled) return
      if (meta && metaScore(meta) > 0) {
        if (!best || metaScore(meta) > metaScore(best)) best = meta
        // 标题+简介都有时立刻采用
        if (meta.title && meta.description) {
          window.clearTimeout(timer)
          finish(meta)
          return
        }
      }
      pending -= 1
      if (pending <= 0) {
        window.clearTimeout(timer)
        finish(best ?? fallback)
      }
    }

    if (!pending) {
      window.clearTimeout(timer)
      finish(fallback)
      return
    }

    for (const task of tasks) {
      task.then(done).catch(() => done(null))
    }
  })
}

/**
 * 输入链接后自动获取标题与简介。
 * 开发代抓 / 扩展后台 / 直连 / 公开接口并行，取最优结果。
 */
export async function fetchPageMeta(url: string): Promise<PageMeta> {
  const empty: PageMeta = { title: '', description: '', icon: '' }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return empty
  }
  if (!/^https?:$/i.test(parsed.protocol)) return empty

  const fallback: PageMeta = {
    title: parsed.hostname.replace(/^www\./i, ''),
    description: '',
    icon: '',
  }

  return bestMeta(
    [
      fetchViaDevProxy(url),
      fetchViaExtension(url),
      withTimeout(
        fetchHtmlDirect(url).then((html) => (html ? asMeta(parseHtmlMeta(html, url)) : null)),
        3500,
      ),
      fetchViaMicrolink(url),
      fetchViaAllOrigins(url),
    ],
    fallback,
  )
}
