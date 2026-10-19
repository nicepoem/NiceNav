export type ThemeMode = 'light' | 'dark' | 'system'

/** 右侧浮动工具栏按钮 id */
export type DockButtonId =
  | 'backTop'
  | 'addSite'
  | 'manageCategories'
  | 'sort'
  | 'theme'

export type SearchEngine = {
  name: string
  urlTemplate: string
}

/** 顶栏导航：下拉子项 */
export type HeaderMenuLink = {
  id: string
  label: string
  url: string
}

/**
 * 顶栏导航菜单项。
 * - 无 children：作为直接链接（需填写 url）
 * - 有 children：作为下拉菜单标题（url 可空）
 */
export type HeaderMenuItem = {
  id: string
  label: string
  url?: string
  children?: HeaderMenuLink[]
}

export type Category = {
  id: string
  name: string
  icon?: string
  parentId?: string | null
  order: number
  createdAt: number
  updatedAt: number
}

export type Site = {
  id: string
  categoryId: string
  title: string
  url: string
  description?: string
  icon?: string
  order: number
  tags?: string[]
  createdAt: number
  updatedAt: number
}

export type AppSettings = {
  theme: ThemeMode
  openInNewTab: boolean
  searchEngines: SearchEngine[]
  sidebarCollapsed: boolean
  /** 站点名称，侧栏与页面标题展示 */
  siteName: string
  /** 站点副标题 / 口号 */
  siteSlogan: string
  /** Logo 图片（data URL 或 http URL） */
  logo: string
  /** 浏览器图标 favicon（data URL 或 http URL） */
  favicon: string
  /** 站点文章 / 公告正文（纯文本或简易 Markdown） */
  siteArticle: string
  /** 右侧浮动工具栏总开关 */
  dockEnabled: boolean
  /** 浮动栏：返回顶部 */
  dockBackTop: boolean
  /** 浮动栏：主题切换 */
  dockTheme: boolean
  /** 浮动栏：添加网址 */
  dockAddSite: boolean
  /** 浮动栏：分类管理 */
  dockManageCategories: boolean
  /** 浮动栏：排序 */
  dockSort: boolean
  /** 浮动栏：导出 JSON */
  dockExport: boolean
  /** 浮动栏：导入 JSON */
  dockImport: boolean
  /** 浮动栏按钮顺序（上→下） */
  dockOrder: DockButtonId[]
  /** 顶栏自定义导航菜单 */
  headerMenus: HeaderMenuItem[]
}

export type NavData = {
  categories: Category[]
  sites: Site[]
  settings: AppSettings
}

export type NavExportPayload = {
  version: 1
  exportedAt: string
  categories: Category[]
  sites: Site[]
  settings?: Partial<AppSettings>
}

export type ImportMode = 'merge' | 'replace'

export type ImportResult = {
  mode: ImportMode
  categories: number
  sites: number
}
