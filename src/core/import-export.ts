import { normalizeAppSettings } from './defaults'
import { createId } from './id'
import { parseNavExportPayload, safeParseNavExportPayload } from './schema'
import type {
  Category,
  ImportMode,
  ImportResult,
  NavData,
  NavExportPayload,
  Site,
} from './types'
import { sanitizeHttpUrl, sanitizeIconUrl, siteDedupeKey } from './url'

export {
  isAllowedHttpUrl,
  sanitizeHttpUrl,
  sanitizeIconUrl,
  siteDedupeKey,
  isValidSearchEngineTemplate,
} from './url'

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

/** 去掉 BOM、首尾空白、markdown 代码围栏，便于粘贴/文件导入 */
export function normalizeImportText(raw: string): string {
  let text = String(raw ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/^\uFFFE/, '')
    .trim()

  const fence = /^```(?:json|JSON)?\s*\r?\n([\s\S]*?)\r?\n```$/
  const matched = text.match(fence)
  if (matched?.[1]) text = matched[1].trim()

  // 有时复制结果前后夹杂说明文字，尽量截取首个 JSON 对象
  if (text && text[0] !== '{' && text[0] !== '[') {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) text = text.slice(start, end + 1).trim()
  }
  return text
}

function formatZodIssue(path: (string | number)[], message: string): string {
  const where = path.length ? `（${path.join('.')}）` : ''
  return `备份格式不正确${where}：${message}`
}

export function validateImportJson(raw: string):
  | { ok: true; payload: NavExportPayload }
  | { ok: false; error: string } {
  const text = normalizeImportText(raw)
  if (!text) {
    return { ok: false, error: '备份内容为空' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch (e) {
    const hint =
      text === 'undefined' || text === 'null'
        ? '文件内容无效（可能是旧版设置页导出的空备份，请重新导出后再导入）'
        : e instanceof SyntaxError
          ? `语法错误：${e.message}`
          : '请确认文件是 UTF-8 编码的 NiceNav 备份'
    return { ok: false, error: `JSON 解析失败：${hint}` }
  }

  try {
    const result = safeParseNavExportPayload(parsed)
    if (!result.success) {
      const issue = result.error.issues[0]
      return {
        ok: false,
        error: formatZodIssue(issue?.path ?? [], issue?.message ?? '字段不符合要求'),
      }
    }
    const payload = result.data as NavExportPayload
    const cleaned = sanitizeNavGraph(payload.categories, payload.sites)
    if (payload.sites.length > 0 && cleaned.sites.length === 0) {
      return { ok: false, error: '没有合法的 http(s) 站点，或分类引用全部无效' }
    }
    if (payload.categories.length > 0 && cleaned.categories.length === 0) {
      return { ok: false, error: '分类数据无效' }
    }
    return {
      ok: true,
      payload: {
        ...payload,
        categories: cleaned.categories,
        sites: cleaned.sites,
      },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : '导入校验失败',
    }
  }
}

function categoryKey(name: string, parentId: string | null | undefined): string {
  return `${parentId ?? ''}::${name.trim().toLowerCase()}`
}

function siteUrlKey(url: string): string | null {
  return siteDedupeKey(url)
}

/**
 * 合并导入：同名同级分类、同 URL 站点视为重复，只保留已有一份；
 * 仅追加真正新增的项，并为新增分类/站点分配新 ID。
 */
function mergeNavGraphs(
  current: { categories: Category[]; sites: Site[] },
  incoming: { categories: Category[]; sites: Site[] },
): {
  categories: Category[]
  sites: Site[]
  addedCategories: number
  addedSites: number
} {
  const categories = current.categories.map((c) => ({ ...c }))
  const sites = current.sites.map((s) => ({ ...s }))
  const idMap = new Map<string, string>()
  const catIndex = new Map<string, string>()

  for (const cat of categories) {
    catIndex.set(categoryKey(cat.name, cat.parentId ?? null), cat.id)
  }

  // 父先于子：多轮直到全部映射，避免文件顺序颠倒
  const pending = [...incoming.categories]
  let guard = pending.length + 1
  while (pending.length && guard-- > 0) {
    let progressed = false
    for (let i = pending.length - 1; i >= 0; i--) {
      const cat = pending[i]
      if (!cat) continue
      const rawParent = cat.parentId ?? null
      if (rawParent && !idMap.has(rawParent) && incoming.categories.some((c) => c.id === rawParent)) {
        // 父分类尚未映射，且确实在导入集中 → 本轮跳过
        continue
      }
      const parentId = rawParent ? (idMap.get(rawParent) ?? null) : null
      if (rawParent && !parentId && incoming.categories.some((c) => c.id === rawParent)) {
        continue
      }
      // 父不在导入集中：挂到已有同 id，否则变根
      const resolvedParent =
        rawParent == null
          ? null
          : (idMap.get(rawParent) ??
            (categories.some((c) => c.id === rawParent) ? rawParent : null))

      const key = categoryKey(cat.name, resolvedParent)
      const existingId = catIndex.get(key)
      if (existingId) {
        idMap.set(cat.id, existingId)
      } else {
        const newId = createId('cat')
        idMap.set(cat.id, newId)
        catIndex.set(key, newId)
        categories.push({
          ...cat,
          id: newId,
          parentId: resolvedParent,
        })
      }
      pending.splice(i, 1)
      progressed = true
    }
    if (!progressed) break
  }

  // 未能解析父链的剩余分类：作为根按名称合并
  for (const cat of pending) {
    const key = categoryKey(cat.name, null)
    const existingId = catIndex.get(key)
    if (existingId) {
      idMap.set(cat.id, existingId)
      continue
    }
    const newId = createId('cat')
    idMap.set(cat.id, newId)
    catIndex.set(key, newId)
    categories.push({ ...cat, id: newId, parentId: null })
  }

  const urlIndex = new Set<string>()
  for (const site of sites) {
    const key = siteUrlKey(site.url)
    if (key) urlIndex.add(key)
  }

  let addedSites = 0
  for (const site of incoming.sites) {
    const urlKey = siteUrlKey(site.url)
    if (!urlKey || urlIndex.has(urlKey)) continue
    const categoryId = idMap.get(site.categoryId) ?? site.categoryId
    if (!categories.some((c) => c.id === categoryId)) continue
    urlIndex.add(urlKey)
    sites.push({
      ...site,
      id: createId('site'),
      categoryId,
      url: urlKey,
    })
    addedSites += 1
  }

  const addedCategories = categories.length - current.categories.length
  return { categories, sites, addedCategories, addedSites }
}

/** UI / 导入统一：最多两级（根 → 子），更深则挂到根分类下 */
export const MAX_CATEGORY_DEPTH = 1

function clampCategoryDepth(categories: Category[]): Category[] {
  const byId = new Map(categories.map((c) => [c.id, { ...c }]))

  function rootIdOf(id: string): string {
    const seen = new Set<string>()
    let cursor: string | null = id
    while (cursor) {
      if (seen.has(cursor)) break
      seen.add(cursor)
      const parentRef: string | null = byId.get(cursor)?.parentId ?? null
      if (!parentRef || !byId.has(parentRef)) return cursor
      cursor = parentRef
    }
    return id
  }

  for (const cat of byId.values()) {
    let parentId: string | null = cat.parentId ?? null
    if (parentId && !byId.has(parentId)) parentId = null

    if (parentId) {
      const parentCat = byId.get(parentId)
      // 父节点本身不是根 → 当前至少 depth 2，压成挂在根下
      if (parentCat?.parentId) {
        parentId = rootIdOf(parentId)
      }
    }
    cat.parentId = parentId
  }

  return Array.from(byId.values())
}

/** 去掉孤儿分类/站点、非法 URL，断开无效 parent 环，并限制分类深度 */
export function sanitizeNavGraph(
  categories: Category[],
  sites: Site[],
): { categories: Category[]; sites: Site[] } {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const safeCats: Category[] = []

  for (const cat of categories) {
    if (!cat.id || !byId.has(cat.id)) continue
    let parentId = cat.parentId ?? null
    if (parentId && !byId.has(parentId)) parentId = null

    // 检测 parent 环：沿父链走，若回到自身则断开
    if (parentId) {
      const seen = new Set<string>([cat.id])
      let cursor: string | null = parentId
      let cyclic = false
      while (cursor) {
        if (seen.has(cursor)) {
          cyclic = true
          break
        }
        seen.add(cursor)
        cursor = byId.get(cursor)?.parentId ?? null
      }
      if (cyclic) parentId = null
    }

    safeCats.push({ ...cat, parentId })
  }

  const clamped = clampCategoryDepth(safeCats)
  const catIds = new Set(clamped.map((c) => c.id))
  const safeSites: Site[] = []
  for (const site of sites) {
    if (!catIds.has(site.categoryId)) continue
    const url = sanitizeHttpUrl(site.url)
    if (!url) continue
    const icon = site.icon?.trim() ? sanitizeIconUrl(site.icon) ?? undefined : undefined
    safeSites.push({ ...site, url, icon })
  }

  return { categories: clamped, sites: safeSites }
}

export function applyImport(
  current: NavData,
  payloadInput: unknown,
  mode: ImportMode,
): { data: NavData; result: ImportResult } {
  const payload = parseNavExportPayload(payloadInput)
  // 导入不覆盖本地隐私开关，避免备份静默打开第三方出域
  const settings = normalizeAppSettings({
    ...current.settings,
    ...(payload.settings ?? {}),
    searchEngines:
      payload.settings?.searchEngines ?? current.settings.searchEngines,
    dockOrder: payload.settings?.dockOrder ?? current.settings.dockOrder,
    headerMenus: payload.settings?.headerMenus ?? current.settings.headerMenus,
    allowThirdPartyMeta: current.settings.allowThirdPartyMeta,
    allowThirdPartyFavicon: current.settings.allowThirdPartyFavicon,
  })

  if (mode === 'replace') {
    const cleaned = sanitizeNavGraph(payload.categories, payload.sites)
    return {
      data: {
        categories: cleaned.categories,
        sites: cleaned.sites,
        settings,
      },
      result: {
        mode,
        categories: cleaned.categories.length,
        sites: cleaned.sites.length,
      },
    }
  }

  // merge：按分类名+父级、站点 URL 去重，重复项只保留一份
  const incoming = sanitizeNavGraph(payload.categories, payload.sites)
  const merged = mergeNavGraphs(current, incoming)
  const cleaned = sanitizeNavGraph(merged.categories, merged.sites)

  return {
    data: { categories: cleaned.categories, sites: cleaned.sites, settings },
    result: {
      mode,
      categories: merged.addedCategories,
      sites: merged.addedSites,
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

export type FaviconCandidateOptions = {
  /** 是否包含第三方 CDN；默认 false（本地优先） */
  thirdParty?: boolean
}

/**
 * favicon 候选。
 * 默认仅站点自身路径；开启 thirdParty 后再追加国内/国外 CDN。
 */
export function faviconCandidates(
  siteUrl: string,
  options?: FaviconCandidateOptions,
): string[] {
  const host = siteHostname(siteUrl)
  if (!host) return []
  const enc = encodeURIComponent(host)
  const local = [`https://${host}/favicon.ico`, `https://${host}/favicon.png`]
  if (!options?.thirdParty) return local
  return [
    ...local,
    `https://api.iowen.cn/favicon/${host}.png`,
    `https://cravatar.com/favicon/api/index.php?url=${enc}`,
    `https://favicon.cccyun.cc/${host}`,
    `https://www.google.com/s2/favicons?domain=${enc}&sz=64`,
    `https://icons.duckduckgo.com/ip3/${host}.ico`,
    `https://icon.horse/icon/${host}`,
  ]
}

/** 兼容旧调用：返回首个候选 */
export function faviconUrl(siteUrl: string, options?: FaviconCandidateOptions): string {
  return faviconCandidates(siteUrl, options)[0] ?? ''
}

/** 优先自定义 icon，否则返回自动 favicon URL */
export function resolveSiteIcon(site: Site, options?: FaviconCandidateOptions): string {
  if (site.icon?.trim()) return site.icon.trim()
  return faviconUrl(site.url, options)
}
