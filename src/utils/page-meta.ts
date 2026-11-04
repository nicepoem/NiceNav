import { cleanHtmlText, parseHtmlMeta as parseSharedHtmlMeta } from '@/core/html-meta'

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

type ChromePermissions = {
  contains: (perm: { origins: string[] }) => Promise<boolean>
  request: (perm: { origins: string[] }) => Promise<boolean>
}

declare global {
  interface Window {
    chrome?: {
      runtime?: ChromeRuntime
      permissions?: ChromePermissions
    }
  }
}

/** 从 HTML 抽取标题 / 简介 / 图标 */
export function parseHtmlMeta(html: string, pageUrl: string): PageMeta {
  return parseSharedHtmlMeta(html, pageUrl)
}

export function normalizeSiteUrl(
  protocol: 'https://' | 'http://',
  rawHostPath: string,
): string | null {
  let host = rawHostPath.trim().replace(/[\u200b\u00a0]/g, '')
  if (!host) return null

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
    title: cleanHtmlText(data.title ?? ''),
    description: cleanHtmlText(data.description ?? '', 320),
    icon: String(data.icon ?? '').trim(),
  }
  return meta.title || meta.description || meta.icon ? meta : null
}

async function fetchViaDevProxy(
  url: string,
  signal?: AbortSignal,
): Promise<PageMeta | null> {
  if (!import.meta.env.DEV) return null
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
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
    signal?.removeEventListener('abort', onAbort)
  }
}

async function ensureExtensionOriginPermission(url: string): Promise<boolean> {
  const permissions = window.chrome?.permissions
  if (!permissions?.contains || !permissions.request) return true
  try {
    const origin = `${new URL(url).origin}/*`
    if (await permissions.contains({ origins: [origin] })) return true
    return await permissions.request({ origins: [origin] })
  } catch {
    return false
  }
}

async function fetchViaExtension(url: string): Promise<PageMeta | null> {
  const runtime = window.chrome?.runtime
  if (!runtime?.id) return null
  const allowed = await ensureExtensionOriginPermission(url)
  if (!allowed) return null

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

function linkAbort(signal: AbortSignal | undefined, local: AbortController) {
  if (!signal) return () => undefined
  const onAbort = () => local.abort()
  if (signal.aborted) local.abort()
  else signal.addEventListener('abort', onAbort, { once: true })
  return () => signal.removeEventListener('abort', onAbort)
}

async function fetchHtmlDirect(
  url: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const controller = new AbortController()
  const unlink = linkAbort(signal, controller)
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
    unlink()
  }
}

async function fetchViaMicrolink(
  url: string,
  signal?: AbortSignal,
): Promise<PageMeta | null> {
  const endpoint = `https://api.microlink.io/?url=${encodeURIComponent(url)}&meta=true`
  const controller = new AbortController()
  const unlink = linkAbort(signal, controller)
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
    unlink()
  }
}

async function fetchViaAllOrigins(
  url: string,
  signal?: AbortSignal,
): Promise<PageMeta | null> {
  const endpoint = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
  const controller = new AbortController()
  const unlink = linkAbort(signal, controller)
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
    unlink()
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

async function bestMeta(
  tasks: Array<Promise<PageMeta | null>>,
  fallback: PageMeta,
  abort: AbortController,
  waitMs = 2600,
): Promise<PageMeta> {
  return new Promise((resolve) => {
    let pending = tasks.length
    let best: PageMeta | null = null
    let settled = false

    const finish = (meta: PageMeta) => {
      if (settled) return
      settled = true
      abort.abort()
      resolve(meta)
    }

    const timer = window.setTimeout(() => {
      finish(best ?? fallback)
    }, waitMs)

    const done = (meta: PageMeta | null) => {
      if (settled) return
      if (meta && metaScore(meta) > 0) {
        if (!best || metaScore(meta) > metaScore(best)) best = meta
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

export type FetchPageMetaOptions = {
  allowThirdParty?: boolean
}

/**
 * 输入链接后自动获取标题与简介。
 * 默认：开发代抓 / 扩展后台 / 直连；可选再并行第三方公开接口。
 */
export async function fetchPageMeta(
  url: string,
  options?: FetchPageMetaOptions,
): Promise<PageMeta> {
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

  const abort = new AbortController()
  const signal = abort.signal
  const tasks: Array<Promise<PageMeta | null>> = [
    fetchViaDevProxy(url, signal),
    fetchViaExtension(url),
    withTimeout(
      fetchHtmlDirect(url, signal).then((html) =>
        html ? asMeta(parseHtmlMeta(html, url)) : null,
      ),
      3500,
    ),
  ]
  if (options?.allowThirdParty) {
    tasks.push(fetchViaMicrolink(url, signal), fetchViaAllOrigins(url, signal))
  }

  return bestMeta(tasks, fallback, abort)
}
