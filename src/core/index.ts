export type {
  AppSettings,
  Category,
  DockButtonId,
  HeaderMenuItem,
  HeaderMenuLink,
  ImportMode,
  ImportResult,
  NavData,
  NavExportPayload,
  SearchEngine,
  Site,
  ThemeMode,
} from './types'

export {
  DEFAULT_DOCK_ORDER,
  DEFAULT_SETTINGS,
  SEED_VERSION,
  hasObsoleteSettings,
  normalizeAppSettings,
  normalizeDockOrder,
  normalizeHeaderMenus,
} from './defaults'
export { createSeedData } from './demo-catalog'
export {
  buildCategoryTree,
  flattenCategoryTree,
  getDescendantIds,
  type CategoryTreeNode,
} from './category-tree'
export { createId } from './id'
export {
  isAllowedHttpUrl,
  isValidSearchEngineTemplate,
  sanitizeHttpUrl,
  sanitizeIconUrl,
} from './url'
export { cleanHtmlText, parseHtmlMeta, type HtmlPageMeta } from './html-meta'
export {
  parseNavExportPayload,
  safeParseNavExportPayload,
} from './schema'
export {
  applyImport,
  buildSearchEngineUrl,
  downloadExportFilename,
  exportToJson,
  faviconCandidates,
  filterSites,
  sanitizeNavGraph,
  siteHostname,
  validateImportJson,
} from './import-export'
export type { FaviconCandidateOptions } from './import-export'
export type { NavStorage } from './storage/types'
export { IndexedDbStorage } from './storage/indexeddb'
export { MemoryStorage } from './storage/memory'
