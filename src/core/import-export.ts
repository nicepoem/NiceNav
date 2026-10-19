import {
  DEFAULT_SETTINGS,
  normalizeDockOrder,
  normalizeHeaderMenus,
} from './defaults'
import { createId } from './id'
import { parseNavExportPayload, safeParseNavExportPayload } from './schema'
import type {
  AppSettings,
  Category,
  ImportMode,
  ImportResult,
  NavData,
  NavExportPayload,
  Site,
} from './types'

export function createExportPayload(data: NavData): NavExportPayload {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: data.categories,
    sites: data.sites,
    settings: data.settings,
  }
}

export function exportToJson(data: NavData, pretty = true): string {
  return JSON.stringify(createExportPayload(data), null, pretty ? 2 : undefined)
}

export function downloadExportFilename(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `nice-nav-backup-${y}${m}${d}.json`
}

export function validateImportJson(raw: string):
  | { ok: true; payload: NavExportPayload }
  | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(raw) as unknown
    const result = safeParseNavExportPayload(parsed)
    if (!result.success) {
      return { ok: false, error: result.error.issues[0]?.message ?? 'Invalid backup file' }
    }
    return { ok: true, payload: result.data as NavExportPayload }
  } catch {
    return { ok: false, error: 'JSON 解析失败' }
  }
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const map = new Map(current.map((item) => [item.id, item]))
  for (const item of incoming) {
    map.set(item.id, item)
  }
  return Array.from(map.values())
}

function remappedImport(payload: NavExportPayload): { categories: Category[]; sites: Site[] } {
  const idMap = new Map<string, string>()
  const categories = payload.categories.map((cat) => {
    const newId = createId('cat')
    idMap.set(cat.id, newId)
    return {
      ...cat,
      id: newId,
      parentId: cat.parentId ? (idMap.get(cat.parentId) ?? null) : null,
    }
  })

  // Second pass for parent refs that appear after children in file order
  const categoriesFixed = categories.map((cat, index) => {
    const original = payload.categories[index]
    const parentId = original.parentId ? (idMap.get(original.parentId) ?? null) : null
    return { ...cat, parentId }
  })

  const sites = payload.sites.map((site) => ({
    ...site,
    id: createId('site'),
    categoryId: idMap.get(site.categoryId) ?? site.categoryId,
  }))

  return { categories: categoriesFixed, sites }
}

export function applyImport(
  current: NavData,
  payloadInput: unknown,
  mode: ImportMode,
): { data: NavData; result: ImportResult } {
  const payload = parseNavExportPayload(payloadInput)
  const settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...current.settings,
    ...(payload.settings ?? {}),
    searchEngines:
      payload.settings?.searchEngines ??
      current.settings.searchEngines ??
      DEFAULT_SETTINGS.searchEngines,
    dockOrder: normalizeDockOrder(
      payload.settings?.dockOrder ?? current.settings.dockOrder,
    ),
    headerMenus: normalizeHeaderMenus(
      payload.settings?.headerMenus ?? current.settings.headerMenus,
    ),
  }

  if (mode === 'replace') {
    return {
      data: {
        categories: payload.categories,
        sites: payload.sites,
        settings,
      },
      result: {
        mode,
        categories: payload.categories.length,
        sites: payload.sites.length,
      },
    }
  }

  // merge: remap ids to avoid collisions when same backup imported twice
  const remapped = remappedImport(payload)
  const categories = mergeById(current.categories, remapped.categories)
  const sites = mergeById(current.sites, remapped.sites)

  return {
    data: { categories, sites, settings },
    result: {
      mode,
      categories: remapped.categories.length,
      sites: remapped.sites.length,
    },
  }
}

export function filterSites(sites: Site[], query: string): Site[] {
  const q = query.trim().toLowerCase()
  if (!q) return sites
  return sites.filter((site) => {
    const haystack = [site.title, site.url, site.description ?? '', ...(site.tags ?? [])]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

export function buildSearchEngineUrl(template: string, query: string): string {
  return template.replace('{q}', encodeURIComponent(query.trim()))
}

/** 从站点 URL 解析 hostname */
export function siteHostname(siteUrl: string): string {
  try {
    return new URL(siteUrl).hostname || ''
  } catch {
    return ''
  }
}

/**
 * favicon 候选：国内源优先，国外源兜底。
 * 调用方应串行尝试：当前源失败后再请求下一个。
 */
export function faviconCandidates(siteUrl: string): string[] {
  const host = siteHostname(siteUrl)
  if (!host) return []
  const enc = encodeURIComponent(host)
  return [
    // 国内节点
    `https://api.iowen.cn/favicon/${host}.png`,
    `https://cravatar.com/favicon/api/index.php?url=${enc}`,
    `https://favicon.cccyun.cc/${host}`,
    // 直连站点自身（国内站往往很快）
    `https://${host}/favicon.ico`,
    // 国外兜底
    `https://www.google.com/s2/favicons?domain=${enc}&sz=64`,
    `https://icons.duckduckgo.com/ip3/${host}.ico`,
    `https://icon.horse/icon/${host}`,
  ]
}

/** 兼容旧调用：返回最快的候选 */
export function faviconUrl(siteUrl: string): string {
  return faviconCandidates(siteUrl)[0] ?? ''
}

/** 优先自定义 icon，否则返回自动 favicon URL */
export function resolveSiteIcon(site: Site): string {
  if (site.icon?.trim()) return site.icon.trim()
  return faviconUrl(site.url)
}
