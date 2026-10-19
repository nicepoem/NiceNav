function decodeEntities(input) {
  return String(input)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
}

function cleanText(value, max = 240) {
  if (!value) return ''
  const text = decodeEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trim()}…`
}

function absUrl(base, maybeRelative) {
  if (!maybeRelative || !String(maybeRelative).trim()) return ''
  try {
    return new URL(String(maybeRelative).trim(), base).href
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
  const body = withoutNoise.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? withoutNoise
  return cleanText(body.replace(/<[^>]+>/g, ' '), 180)
}

function parseHtmlMeta(html, pageUrl) {
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

async function fetchPageMeta(url) {
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
  if (!message || message.type !== 'FETCH_PAGE_META' || !message.url) {
    return undefined
  }

  fetchPageMeta(String(message.url))
    .then((meta) => sendResponse(meta))
    .catch((error) => {
      sendResponse({
        error: error instanceof Error ? error.message : 'fetch failed',
      })
    })

  return true
})
