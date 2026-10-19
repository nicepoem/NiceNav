import type {
  AppSettings,
  DockButtonId,
  HeaderMenuItem,
  HeaderMenuLink,
} from './types'
import { createId } from './id'

export const DEFAULT_DOCK_ORDER: DockButtonId[] = [
  'backTop',
  'addSite',
  'sort',
  'theme',
]

/** 规范浮动栏顺序：去重、过滤非法项，并补齐缺失按钮 */
export function normalizeDockOrder(order?: readonly string[] | null): DockButtonId[] {
  const allowed = new Set<string>(DEFAULT_DOCK_ORDER)
  const seen = new Set<string>()
  const result: DockButtonId[] = []
  for (const id of order ?? []) {
    if (!allowed.has(id) || seen.has(id)) continue
    result.push(id as DockButtonId)
    seen.add(id)
  }
  for (const id of DEFAULT_DOCK_ORDER) {
    if (!seen.has(id)) result.push(id)
  }
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
    const url = String(raw?.url ?? '').trim() || undefined
    const children: HeaderMenuLink[] = []
    if (Array.isArray(raw?.children)) {
      for (const c of raw.children) {
        const cl = String(c?.label ?? '').trim()
        const cu = String(c?.url ?? '').trim()
        if (!cl || !cu) continue
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
  siteName: 'Nice Nav',
  siteSlogan: '本地导航起始页',
  logo: '',
  favicon: '',
  siteArticle: '',
  dockEnabled: true,
  dockBackTop: true,
  dockTheme: true,
  dockAddSite: true,
  dockSort: true,
  dockExport: true,
  dockImport: true,
  dockOrder: [...DEFAULT_DOCK_ORDER],
  headerMenus: [],
  searchEngines: [
    { name: '百度', urlTemplate: 'https://www.baidu.com/s?wd={q}' },
    { name: 'Google', urlTemplate: 'https://www.google.com/search?q={q}' },
    { name: 'Bing', urlTemplate: 'https://www.bing.com/search?q={q}' },
  ],
}

/** 示例数据版本，变更后本地库会自动刷新示例（仅覆盖默认种子 ID） */
export const SEED_VERSION = 4
