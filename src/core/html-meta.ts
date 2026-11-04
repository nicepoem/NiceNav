export type HtmlPageMeta = {
  title: string
  description: string
  icon: string
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

export function cleanHtmlText(value: string | null | undefined, max = 240): string {
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
  return cleanHtmlText(body.replace(/<[^>]+>/g, ' '), 180)
}

/** 从 HTML 抽取标题 / 简介 / 图标（Web、Vite 代理、扩展共用） */
export function parseHtmlMeta(html: string, pageUrl = ''): HtmlPageMeta {
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
