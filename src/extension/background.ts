import { isAllowedHttpUrl } from '../core/url'
import { parseHtmlMeta } from '../core/html-meta'

declare const chrome: {
  action: { onClicked: { addListener: (fn: () => void) => void } }
  tabs: { create: (opts: { url: string }) => void }
  runtime: {
    getURL: (path: string) => string
    onMessage: {
      addListener: (
        fn: (
          message: unknown,
          sender: unknown,
          sendResponse: (response: unknown) => void,
        ) => boolean | void,
      ) => void
    }
  }
}

async function fetchPageMeta(url: string) {
  if (!isAllowedHttpUrl(url)) throw new Error('url must be http(s)')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      credentials: 'omit',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    return parseHtmlMeta(html, url)
  } finally {
    clearTimeout(timer)
  }
}

/** 对齐 /api/icon-probe：有 host_permissions 时在后台探测图标是否可用 */
async function probeIconUrl(url: string, timeoutMs = 1600): Promise<boolean> {
  if (!isAllowedHttpUrl(url)) return false
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      credentials: 'omit',
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    })
    if (!res.ok) return false
    const type = (res.headers.get('content-type') || '').toLowerCase()
    if (
      type &&
      !type.includes('image') &&
      !type.includes('icon') &&
      !type.includes('octet-stream') &&
      !type.includes('application/xml')
    ) {
      return false
    }
    const buf = new Uint8Array(await res.arrayBuffer())
    return buf.byteLength >= 16
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('index.html') })
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return undefined
  const msg = message as { type?: string; url?: string }

  if (msg.type === 'FETCH_PAGE_META' && msg.url) {
    fetchPageMeta(String(msg.url))
      .then((meta) => sendResponse(meta))
      .catch((error) => {
        sendResponse({
          error: error instanceof Error ? error.message : 'fetch failed',
        })
      })
    return true
  }

  if (msg.type === 'PROBE_ICON' && msg.url) {
    probeIconUrl(String(msg.url))
      .then((ok) => sendResponse({ ok }))
      .catch(() => sendResponse({ ok: false }))
    return true
  }

  return undefined
})
