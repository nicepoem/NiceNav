import { faviconUrl, type Site } from '@nice-nav/core'

const CONCURRENCY = 3
const PROBE_TIMEOUT_MS = 4000

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
let active = 0

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
    const autoUrl = faviconUrl(item.siteUrl)
    if (!autoUrl) {
      failed.add(item.id)
      item.onFail?.()
      return
    }
    const ok = await probe(autoUrl)
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
 * 已有 icon / 已失败 / 进行中的会跳过或更新优先级。
 */
export function enqueueSiteIcon(options: {
  site: Site
  priority: number
  persist: (iconUrl: string) => void | Promise<void>
  onFail?: () => void
  /** 允许对曾失败的 id 再试一次（例如落库地址失效后） */
  retry?: boolean
}) {
  const { site, priority, persist, onFail, retry } = options
  if (site.icon?.trim()) return
  if (retry) failed.delete(site.id)
  if (failed.has(site.id) || running.has(site.id)) {
    if (failed.has(site.id)) onFail?.()
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
