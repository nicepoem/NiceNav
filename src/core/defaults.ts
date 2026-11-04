import type {
  AppSettings,
  DockButtonId,
  HeaderMenuItem,
  HeaderMenuLink,
} from './types'
import { createId } from './id'
import { isAllowedHttpUrl, isValidSearchEngineTemplate } from './url'

export const DEFAULT_DOCK_ORDER: DockButtonId[] = [
  'addSite',
  'manageCategories',
  'sort',
  'settings',
  'theme',
  'backTop',
]

/** 规范浮动栏顺序：去重、过滤非法项，并补齐缺失按钮；返回顶部固定在末尾 */
export function normalizeDockOrder(order?: readonly string[] | null): DockButtonId[] {
  const allowed = new Set<string>(DEFAULT_DOCK_ORDER)
  const seen = new Set<string>()
  const result: DockButtonId[] = []
  for (const id of order ?? []) {
    if (!allowed.has(id) || seen.has(id) || id === 'backTop') continue
    result.push(id as DockButtonId)
    seen.add(id)
  }
  for (const id of DEFAULT_DOCK_ORDER) {
    if (id === 'backTop' || seen.has(id)) continue
    result.push(id)
    seen.add(id)
  }
  result.push('backTop')
  return result
}

/** 规范顶栏菜单，过滤无效项 */
export function normalizeHeaderMenus(
  menus?: readonly HeaderMenuItem[] | null,
): HeaderMenuItem[] {
  if (!Array.isArray(menus)) return []
  const result: HeaderMenuItem[] = []
  for (const raw of menus) {
    const label = String(raw?.label ?? '').trim()
    if (!label) continue
    const id = String(raw?.id ?? '').trim() || createId('hm')
    const urlRaw = String(raw?.url ?? '').trim()
    const url = urlRaw && isAllowedHttpUrl(urlRaw) ? urlRaw : undefined
    const children: HeaderMenuLink[] = []
    if (Array.isArray(raw?.children)) {
      for (const c of raw.children) {
        const cl = String(c?.label ?? '').trim()
        const cu = String(c?.url ?? '').trim()
        if (!cl || !cu || !isAllowedHttpUrl(cu)) continue
        children.push({
          id: String(c?.id ?? '').trim() || createId('hml'),
          label: cl,
          url: cu,
        })
      }
    }
    if (children.length) {
      result.push({ id, label, children })
      continue
    }
    if (!url) continue
    result.push({ id, label, url })
  }
  return result
}

/** 早期演示导航：博客 / 网址 / 书籍 / 电影 / 软件 / 字体 / 页面 */
const UNUSED_HEADER_MENU_IDS = new Set([
  'hm-blog',
  'hm-home',
  'hm-books',
  'hm-movies',
  'hm-soft',
  'hm-fonts',
  'hm-pages',
])

const UNUSED_HEADER_MENU_LABELS = new Set([
  '博客',
  '网址',
  '书籍',
  '电影',
  '软件',
  '字体',
  '页面',
])

export function stripUnusedHeaderMenus(
  menus: readonly HeaderMenuItem[],
): HeaderMenuItem[] {
  return menus.filter(
    (item) =>
      !UNUSED_HEADER_MENU_IDS.has(item.id) &&
      !UNUSED_HEADER_MENU_LABELS.has(item.label),
  )
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  openInNewTab: true,
  sidebarCollapsed: false,
  allowThirdPartyMeta: false,
  allowThirdPartyFavicon: false,
  dockEnabled: true,
  dockBackTop: true,
  dockTheme: true,
  dockAddSite: true,
  dockManageCategories: true,
  dockSort: true,
  dockOrder: [...DEFAULT_DOCK_ORDER],
  headerMenus: [],
  searchEngines: [
    { name: '百度', urlTemplate: 'https://www.baidu.com/s?wd={q}' },
    { name: 'Google', urlTemplate: 'https://www.google.com/search?q={q}' },
    { name: 'Bing', urlTemplate: 'https://www.bing.com/search?q={q}' },
  ],
}

/** 旧版设置中已移除的字段（读取时剥离，避免 data URL 等残留膨胀） */
const OBSOLETE_SETTING_KEYS = [
  'siteName',
  'siteSlogan',
  'logo',
  'favicon',
  'siteArticle',
  'dockExport',
  'dockImport',
  'dockSettings',
] as const

export function hasObsoleteSettings(input: unknown): boolean {
  if (!input || typeof input !== 'object') return false
  const obj = input as Record<string, unknown>
  return OBSOLETE_SETTING_KEYS.some((key) => key in obj)
}

/** 合并并只保留当前 AppSettings 字段 */
export function normalizeAppSettings(
  input?: Partial<AppSettings> | Record<string, unknown> | null,
): AppSettings {
  const raw = (input ?? {}) as Partial<AppSettings>
  const filteredEngines = Array.isArray(raw.searchEngines)
    ? raw.searchEngines.filter(
        (e) => e?.name?.trim() && isValidSearchEngineTemplate(String(e.urlTemplate ?? '')),
      )
    : []
  const searchEngines = filteredEngines.length
    ? filteredEngines
    : [...DEFAULT_SETTINGS.searchEngines]

  return {
    theme: raw.theme ?? DEFAULT_SETTINGS.theme,
    openInNewTab: raw.openInNewTab ?? DEFAULT_SETTINGS.openInNewTab,
    sidebarCollapsed: raw.sidebarCollapsed ?? DEFAULT_SETTINGS.sidebarCollapsed,
    allowThirdPartyMeta: raw.allowThirdPartyMeta === true,
    allowThirdPartyFavicon: raw.allowThirdPartyFavicon === true,
    dockEnabled: raw.dockEnabled !== false,
    dockBackTop: raw.dockBackTop !== false,
    // 无设置页时默认开启；若本地曾被强制写成 false，仍恢复显示
    dockTheme: true,
    dockAddSite: raw.dockAddSite !== false,
    dockManageCategories: raw.dockManageCategories !== false,
    dockSort: raw.dockSort !== false,
    dockOrder: normalizeDockOrder(raw.dockOrder),
    headerMenus: normalizeHeaderMenus(raw.headerMenus),
    searchEngines,
  }
}

/** 示例数据版本，变更后本地库会自动刷新示例（仅覆盖默认种子 ID） */
/** 升版本会在空库或旧种子上写入 createSeedData（当前为全量演示） */
export const SEED_VERSION = 7
