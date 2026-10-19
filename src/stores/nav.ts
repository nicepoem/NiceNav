import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  applyImport,
  buildCategoryTree,
  buildSearchEngineUrl,
  createId,
  createSeedData,
  downloadExportFilename,
  exportToJson,
  filterSites,
  flattenCategoryTree,
  getDescendantIds,
  IndexedDbStorage,
  type AppSettings,
  type Category,
  type ImportMode,
  type NavStorage,
  type Site,
  validateImportJson,
} from '@nice-nav/core'

const storage: NavStorage = new IndexedDbStorage('nice-nav')

export const useNavStore = defineStore('nav', () => {
  const categories = ref<Category[]>([])
  const sites = ref<Site[]>([])
  const settings = ref<AppSettings>(createSeedData().settings)
  const loading = ref(false)
  const ready = ref(false)
  const searchQuery = ref('')
  const activeCategoryId = ref<string | null>(null)
  /** 会话级：仅编辑模式下显示拖拽手柄并允许排序 */
  const editMode = ref(false)

  function toggleEditMode() {
    editMode.value = !editMode.value
  }

  function setEditMode(on: boolean) {
    editMode.value = on
  }

  const filteredSites = computed(() => filterSites(sites.value, searchQuery.value))

  const sitesByCategory = computed(() => {
    const map = new Map<string, Site[]>()
    for (const site of filteredSites.value) {
      const list = map.get(site.categoryId) ?? []
      list.push(site)
      map.set(site.categoryId, list)
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.order - b.order)
    }
    return map
  })

  const categoryTree = computed(() => buildCategoryTree(categories.value))

  const visibleCategories = computed(() => {
    const flat = flattenCategoryTree(categoryTree.value)
    if (!searchQuery.value.trim()) return flat
    return flat.filter((cat) => (sitesByCategory.value.get(cat.id)?.length ?? 0) > 0)
  })

  const rootCategories = computed(() =>
    categories.value
      .filter((c) => c.parentId == null || c.parentId === '')
      .sort((a, b) => a.order - b.order),
  )

  function childrenOf(parentId: string) {
    return categories.value
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => a.order - b.order)
  }

  function isChildCategory(cat: Category) {
    return Boolean(cat.parentId)
  }

  function sameParent(c: Category, parentId: string | null) {
    if (parentId == null || parentId === '') {
      return c.parentId == null || c.parentId === ''
    }
    return c.parentId === parentId
  }

  function nextSiblingOrder(siblings: { order: number }[]) {
    if (!siblings.length) return 0
    return siblings.reduce((max, s) => Math.max(max, s.order), -1) + 1
  }

  async function hydrate() {
    const data = await storage.getAll()
    categories.value = data.categories
    sites.value = data.sites
    settings.value = data.settings
  }

  async function init() {
    if (ready.value) return
    loading.value = true
    try {
      await hydrate()
      ready.value = true
    } finally {
      loading.value = false
    }
  }

  async function persistAll() {
    await storage.saveAll({
      categories: categories.value,
      sites: sites.value,
      settings: settings.value,
    })
  }

  async function upsertCategory(input: Partial<Category> & { name: string }) {
    const now = Date.now()
    const existing = input.id ? categories.value.find((c) => c.id === input.id) : undefined
    const parentId =
      input.parentId !== undefined ? input.parentId : (existing?.parentId ?? null)
    const siblings = categories.value.filter((c) =>
      parentId ? c.parentId === parentId : c.parentId == null || c.parentId === '',
    )
    const category: Category = {
      id: existing?.id ?? createId('cat'),
      name: input.name,
      icon: input.icon ?? existing?.icon,
      parentId,
      order: input.order ?? existing?.order ?? nextSiblingOrder(siblings),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    await storage.putCategory(category)
    const idx = categories.value.findIndex((c) => c.id === category.id)
    if (idx >= 0) categories.value[idx] = category
    else categories.value.push(category)
  }

  async function removeCategory(id: string) {
    const ids = getDescendantIds(categories.value, id)
    await storage.removeCategory(id)
    categories.value = categories.value.filter((c) => !ids.includes(c.id))
    sites.value = sites.value.filter((s) => !ids.includes(s.categoryId))
    if (activeCategoryId.value && ids.includes(activeCategoryId.value)) {
      activeCategoryId.value = null
    }
  }

  async function upsertSite(
    input: Partial<Site> & { title: string; url: string; categoryId: string },
  ) {
    const now = Date.now()
    const existing = input.id ? sites.value.find((s) => s.id === input.id) : undefined
    const siblings = sites.value.filter((s) => s.categoryId === input.categoryId)
    const site: Site = {
      id: existing?.id ?? createId('site'),
      categoryId: input.categoryId,
      title: input.title,
      url: input.url,
      description: input.description ?? existing?.description,
      icon: input.icon ?? existing?.icon,
      tags: input.tags ?? existing?.tags,
      order: input.order ?? existing?.order ?? nextSiblingOrder(siblings),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    await storage.putSite(site)
    const idx = sites.value.findIndex((s) => s.id === site.id)
    if (idx >= 0) sites.value[idx] = site
    else sites.value.push(site)
  }

  async function removeSite(id: string) {
    await storage.removeSite(id)
    sites.value = sites.value.filter((s) => s.id !== id)
  }

  /**
   * 回写站点图标。默认不覆盖已有 icon（用于自动探测补全）。
   * overwrite 时可清空或替换失效地址。
   */
  async function patchSiteIcon(
    id: string,
    icon: string,
    opts?: { overwrite?: boolean },
  ) {
    const trimmed = icon.trim()
    const idx = sites.value.findIndex((s) => s.id === id)
    if (idx < 0) return
    const current = sites.value[idx]!
    if (!opts?.overwrite && current.icon?.trim()) return
    const next: Site = {
      ...current,
      icon: trimmed || undefined,
      updatedAt: Date.now(),
    }
    sites.value[idx] = next
    await storage.putSite(next)
  }

  /** 同级分类重排（parentId 为 null 表示根级） */
  async function reorderCategories(parentId: string | null, orderedIds: string[]) {
    if (!orderedIds.length) return
    const now = Date.now()
    const orderMap = new Map(orderedIds.map((id, i) => [id, i]))
    const next = categories.value.map((c) => {
      if (!sameParent(c, parentId)) return c
      const order = orderMap.get(c.id)
      if (order === undefined) return c
      return { ...c, order, updatedAt: now }
    })
    categories.value = next
    await Promise.all(
      next.filter((c) => orderMap.has(c.id)).map((c) => storage.putCategory(c)),
    )
  }

  /** 同一分类下网址重排 */
  async function reorderSites(categoryId: string, orderedIds: string[]) {
    if (!orderedIds.length) return
    const now = Date.now()
    const orderMap = new Map(orderedIds.map((id, i) => [id, i]))
    const next = sites.value.map((s) => {
      if (s.categoryId !== categoryId) return s
      const order = orderMap.get(s.id)
      if (order === undefined) return s
      return { ...s, order, updatedAt: now }
    })
    sites.value = next
    await Promise.all(
      next.filter((s) => orderMap.has(s.id)).map((s) => storage.putSite(s)),
    )
  }

  async function updateSettings(patch: Partial<AppSettings>) {
    settings.value = { ...settings.value, ...patch }
    await storage.saveSettings(settings.value)
  }

  function exportBackup() {
    const json = exportToJson({
      categories: categories.value,
      sites: sites.value,
      settings: settings.value,
    })
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = downloadExportFilename()
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importBackup(raw: string, mode: ImportMode) {
    const validated = validateImportJson(raw)
    if (!validated.ok) {
      throw new Error(validated.error)
    }
    const { data, result } = applyImport(
      {
        categories: categories.value,
        sites: sites.value,
        settings: settings.value,
      },
      validated.payload,
      mode,
    )
    await storage.saveAll(data)
    categories.value = data.categories
    sites.value = data.sites
    settings.value = data.settings
    return result
  }

  async function resetToSeed() {
    const seed = createSeedData()
    await storage.saveAll(seed)
    categories.value = seed.categories
    sites.value = seed.sites
    settings.value = seed.settings
  }

  async function clearAll() {
    await storage.clear()
    categories.value = []
    sites.value = []
    settings.value = createSeedData().settings
    await persistAll()
  }

  function openSite(site: Site) {
    const target = settings.value.openInNewTab ? '_blank' : '_self'
    window.open(site.url, target, 'noopener,noreferrer')
  }

  function openExternalSearch(query: string, engineIndex = 0) {
    const engine = settings.value.searchEngines[engineIndex]
    if (!engine || !query.trim()) return
    const url = buildSearchEngineUrl(engine.urlTemplate, query)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return {
    categories,
    sites,
    settings,
    loading,
    ready,
    searchQuery,
    activeCategoryId,
    editMode,
    toggleEditMode,
    setEditMode,
    filteredSites,
    sitesByCategory,
    visibleCategories,
    categoryTree,
    rootCategories,
    childrenOf,
    isChildCategory,
    init,
    hydrate,
    upsertCategory,
    removeCategory,
    upsertSite,
    removeSite,
    patchSiteIcon,
    reorderCategories,
    reorderSites,
    updateSettings,
    exportBackup,
    importBackup,
    resetToSeed,
    clearAll,
    openSite,
    openExternalSearch,
  }
})
