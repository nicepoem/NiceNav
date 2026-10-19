import {
  faviconCandidates,
  siteHostname,
  type Site,
} from '@nice-nav/core'

/** 同时处理的卡片数；每张卡片内部按源顺序逐个尝试 */
const CONCURRENCY = 6
/** 单个源超时后立刻换下一个；国内源应更快，超时偏短 */
const PROBE_TIMEOUT_MS = 1200

const LS_KEY = 'nn.favicon.byHost'
const MAX_ENTRIES = 1500
/** 缓存有效期：60 天 */
const TTL_MS = 1000 * 60 * 60 * 24 * 60

type CacheEntry = { url: string; at: number }

type QueueItem = {
  id: string
  siteUrl: string
  priority: number
  persist: (iconUrl: string) => void | Promise<void>
  onFail?: () => void
}

const queued = new Map<string, QueueItem>()
const running = new Set<string>()
const failed = new Set<string>()
/** hostname → 图标 URL（内存 + localStorage 持久化） */
const hostCache = new Map<string, CacheEntry>()
let active = 0
let writeTimer: number | null = null
let hydrated = false

function getCachedUrl(host: string): string | undefined {
  const entry = hostCache.get(host)
  if (!entry) return undefined
  if (Date.now() - entry.at > TTL_MS) {
    hostCache.delete(host)
    schedulePersist()
    return undefined
  }
  return entry.url
}

function setCachedUrl(host: string, url: string) {
  const icon = url.trim()
  if (!host || !icon) return
  hostCache.set(host, { url: icon, at: Date.now() })
  schedulePersist()
}

function hydrateFromDisk() {
  if (hydrated || typeof localStorage === 'undefined') return
  hydrated = true
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return
    const data = JSON.parse(raw) as Record<string, CacheEntry>
    const now = Date.now()
    for (const [host, entry] of Object.entries(data)) {
      if (!host || !entry?.url?.trim()) continue
      if (now - (entry.at || 0) > TTL_MS) continue
      hostCache.set(host, { url: entry.url.trim(), at: entry.at || now })
    }
  } catch {
    // ignore corrupt cache
  }
}

function schedulePersist() {
  if (typeof localStorage === 'undefined') return
  if (writeTimer != null) return
  writeTimer = window.setTimeout(() => {
    writeTimer = null
    flushToDisk()
  }, 250)
}

function flushToDisk() {
  try {
    const now = Date.now()
    const entries = [...hostCache.entries()]
      .filter(([, entry]) => entry.url && now - entry.at <= TTL_MS)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, MAX_ENTRIES)

    hostCache.clear()
    const payload: Record<string, CacheEntry> = {}
    for (const [host, entry] of entries) {
      hostCache.set(host, entry)
      payload[host] = entry
    }
    localStorage.setItem(LS_KEY, JSON.stringify(payload))
  } catch {
    // quota / private mode
  }
}

/** 启动时加载持久化缓存，并预连接国内图标源 */
export function initSiteIconCache() {
  hydrateFromDisk()
  preconnectIconOrigins()
}

function probe(url: string, timeoutMs = PROBE_TIMEOUT_MS): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const timer = window.setTimeout(() => {
      img.onload = null
      img.onerror = null
      img.src = ''
      reject(new Error('timeout'))
    }, timeoutMs)
    img.onload = () => {
      window.clearTimeout(timer)
      // 0x0 视为无效
      if (img.naturalWidth < 2 || img.naturalHeight < 2) {
        reject(new Error('empty'))
        return
      }
      resolve(url)
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error('error'))
    }
    img.referrerPolicy = 'no-referrer'
    img.decoding = 'async'
    img.src = url
  })
}

/** 按顺序逐个请求，当前源失败或超时后再试下一个 */
async function probeInOrder(urls: string[]): Promise<string> {
  const list = [...new Set(urls.filter(Boolean))]
  if (!list.length) throw new Error('empty')
  let lastError: Error | null = null
  for (const url of list) {
    try {
      return await probe(url)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('error')
    }
  }
  throw lastError ?? new Error('all failed')
}

async function resolveAutoIcon(siteUrl: string): Promise<string> {
  hydrateFromDisk()
  const host = siteHostname(siteUrl)
  if (host) {
    const cached = getCachedUrl(host)
    if (cached) return cached
  }

  const winner = await probeInOrder(faviconCandidates(siteUrl))
  if (host) setCachedUrl(host, winner)
  return winner
}

function pickNext(): QueueItem | null {
  let best: QueueItem | null = null
  for (const item of queued.values()) {
    if (running.has(item.id)) continue
    if (!best || item.priority < best.priority) best = item
  }
  return best
}

async function runOne(item: QueueItem) {
  queued.delete(item.id)
  running.add(item.id)
  active += 1
  try {
    const ok = await resolveAutoIcon(item.siteUrl)
    await item.persist(ok)
  } catch {
    failed.add(item.id)
    item.onFail?.()
  } finally {
    running.delete(item.id)
    active -= 1
    pump()
  }
}

function pump() {
  while (active < CONCURRENCY) {
    const next = pickNext()
    if (!next) break
    void runOne(next)
  }
}

/**
 * 入队自动图标加载。priority 越小越优先（建议用页面纵向位置）。
 * 策略：持久化域名缓存 → 国内源串行 → 写入站点与缓存。
 */
export function enqueueSiteIcon(options: {
  site: Site
  priority: number
  persist: (iconUrl: string) => void | Promise<void>
  onFail?: () => void
  /** 允许对曾失败的 id 再试一次（例如落库地址失效后） */
  retry?: boolean
}) {
  hydrateFromDisk()
  const { site, priority, persist, onFail, retry } = options
  if (site.icon?.trim()) return
  if (retry) failed.delete(site.id)
  if (failed.has(site.id) || running.has(site.id)) {
    if (failed.has(site.id)) onFail?.()
    return
  }

  // 域名缓存命中：直接写回站点，不发起网络探测
  const host = siteHostname(site.url)
  const cached = host ? getCachedUrl(host) : undefined
  if (cached) {
    void Promise.resolve(persist(cached)).catch(() => {
      failed.add(site.id)
      onFail?.()
    })
    return
  }

  const existing = queued.get(site.id)
  if (existing) {
    existing.priority = Math.min(existing.priority, priority)
    existing.persist = persist
    existing.onFail = onFail
    pump()
    return
  }

  queued.set(site.id, {
    id: site.id,
    siteUrl: site.url,
    priority,
    persist,
    onFail,
  })
  pump()
}

/** 卡片卸载时取消排队（已开始的请求不中断） */
export function cancelSiteIcon(siteId: string) {
  queued.delete(siteId)
}

export function isSiteIconFailed(siteId: string) {
  return failed.has(siteId)
}

/** 已有图标按域名记入缓存（内存 + 持久化），同站其他网址可直接复用 */
export function rememberSiteIcon(siteUrl: string, iconUrl: string) {
  hydrateFromDisk()
  const host = siteHostname(siteUrl)
  const icon = iconUrl.trim()
  if (!host || !icon) return
  setCachedUrl(host, icon)
}

/** 图标失效时清除该域名缓存，以便重新探测 */
export function invalidateSiteIcon(siteUrl: string) {
  hydrateFromDisk()
  const host = siteHostname(siteUrl)
  if (!host) return
  if (!hostCache.has(host)) return
  hostCache.delete(host)
  schedulePersist()
}

/** 提前与图标服务建立连接 */
export function preconnectIconOrigins() {
  const origins = [
    'https://api.iowen.cn',
    'https://cravatar.com',
    'https://favicon.cccyun.cc',
  ]
  for (const href of origins) {
    if (document.head.querySelector(`link[rel="preconnect"][href="${href}"]`)) continue
    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = href
    link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
  }
}

/** 清空域名图标缓存（内存 + localStorage） */
export function clearSiteIconHostCache() {
  hostCache.clear()
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(LS_KEY)
    } catch {
      // ignore
    }
  }
}
