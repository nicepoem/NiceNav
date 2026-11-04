/** 仅允许 http / https 外链 */
export function isAllowedHttpUrl(raw: string | null | undefined): boolean {
  const value = String(raw ?? '').trim()
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** 合法则返回规范化 href，否则 null */
export function sanitizeHttpUrl(raw: string | null | undefined): string | null {
  const value = String(raw ?? '').trim()
  if (!isAllowedHttpUrl(value)) return null
  try {
    return new URL(value).href
  } catch {
    return null
  }
}

/**
 * 合并去重用的站点键：统一 https、去掉 www.、去掉 hash、去掉默认端口与末尾 /
 */
export function siteDedupeKey(raw: string | null | undefined): string | null {
  const href = sanitizeHttpUrl(raw)
  if (!href) return null
  try {
    const u = new URL(href)
    u.hash = ''
    u.protocol = 'https:'
    if (u.port === '443' || u.port === '80') u.port = ''
    let host = u.hostname.toLowerCase()
    if (host.startsWith('www.')) host = host.slice(4)
    u.hostname = host
    let path = u.pathname
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
    u.pathname = path || '/'
    return u.href
  } catch {
    return href
  }
}

/** 站点图标：仅允许 http(s)，拒绝 javascript: / 任意 data: 等 */
export function sanitizeIconUrl(raw: string | null | undefined): string | null {
  return sanitizeHttpUrl(raw)
}

/** 搜索引擎模板：替换 {q} 后须为合法 http(s) */
export function isValidSearchEngineTemplate(template: string): boolean {
  const value = template.trim()
  if (!value.includes('{q}')) return false
  return isAllowedHttpUrl(value.split('{q}').join('test'))
}
