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
  normalizeDockOrder,
  normalizeHeaderMenus,
} from './defaults'
export { createSeedData } from './seed'
export {
  buildCategoryTree,
  flattenCategoryTree,
  getChildCategoryIds,
  getDescendantIds,
  type CategoryTreeNode,
} from './category-tree'
export { createId } from './id'
export {
  navExportPayloadSchema,
  parseNavExportPayload,
  safeParseNavExportPayload,
} from './schema'
export {
  applyImport,
  buildSearchEngineUrl,
  createExportPayload,
  downloadExportFilename,
  exportToJson,
  faviconCandidates,
  faviconUrl,
  filterSites,
  resolveSiteIcon,
  siteHostname,
  validateImportJson,
} from './import-export'
export type { NavStorage } from './storage/types'
export { IndexedDbStorage } from './storage/indexeddb'
