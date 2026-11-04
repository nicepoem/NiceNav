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

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('index.html') })
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return undefined
  const msg = message as { type?: string; url?: string }
  if (msg.type !== 'FETCH_PAGE_META' || !msg.url) return undefined

  fetchPageMeta(String(msg.url))
    .then((meta) => sendResponse(meta))
    .catch((error) => {
      sendResponse({
        error: error instanceof Error ? error.message : 'fetch failed',
      })
    })

  return true
})
