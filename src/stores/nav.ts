import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import {
  applyImport,
  buildCategoryTree,
  buildSearchEngineUrl,
  createId,
  DEFAULT_SETTINGS,
  downloadExportFilename,
  exportToJson,
  filterSites,
  getDescendantIds,
  IndexedDbStorage,
  isAllowedHttpUrl,
  MemoryStorage,
  normalizeAppSettings,
  sanitizeHttpUrl,
  sanitizeIconUrl,
  validateImportJson,
  type AppSettings,
  type Category,
  type ImportMode,
  type NavStorage,
  type Site,
} from '@nice-nav/core'
import { clearSiteIconHostCache, preconnectIconOrigins } from '@/utils/site-icon'

let storage: NavStorage = new IndexedDbStorage('nice-nav')

const SYNC_CHANNEL = 'nice-nav-data-sync'
const tabId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const useNavStore = defineStore('nav', () => {
  const categories = ref<Category[]>([])
  const sites = ref<Site[]>([])
  const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS })
  /** 图标覆盖层：避免每张 favicon 回写触发 sites 全表重算 */
  const iconOverrides = shallowRef(new Map<string, string>())
  const loading = ref(false)
  const ready = ref(false)
  /** IndexedDB 不可用时为 true，已降级到内存存储 */
  const usingMemoryFallback = ref(false)
  const initError = ref<string | null>(null)
  const searchQuery = ref('')
  const activeCategoryId = ref<string | null>(null)
  /** 会话级：仅编辑模式下显示拖拽手柄并允许排序 */
  const editMode = ref(false)

  let iconFlushTimer: ReturnType<typeof setTimeout> | null = null
  const pendingIconWrites = new Map<string, Site>()

  let syncChannel: BroadcastChannel | null = null
  /** >0 时忽略向外广播，避免远端 hydrate 回声 */
  let suppressBroadcastDepth = 0
  let remoteHydrateTimer: ReturnType<typeof setTimeout> | null = null
  let remoteHydrating = false
  let remoteHydrateQueued = false

  function notifyOtherTabs() {
    if (suppressBroadcastDepth > 0 || usingMemoryFallback.value) return
    try {
      syncChannel?.postMessage({ type: 'nav-changed', from: tabId })
    } catch {
      // BroadcastChannel 不可用时忽略
    }
  }

  async function runRemoteHydrate() {
    if (remoteHydrating) {
      remoteHydrateQueued = true
      return
    }
    remoteHydrating = true
    suppressBroadcastDepth += 1
    try {
      await hydrate()
    } catch (err) {
      // 其他标签页触发的重读失败时不应产生未处理 rejection
      console.warn('[nav] remote hydrate failed:', err)
    } finally {
      suppressBroadcastDepth -= 1
      remoteHydrating = false
      if (remoteHydrateQueued) {
        remoteHydrateQueued = false
        void runRemoteHydrate()
      }
    }
  }

  function scheduleRemoteHydrate() {
    if (remoteHydrateTimer != null) clearTimeout(remoteHydrateTimer)
    remoteHydrateTimer = setTimeout(() => {
      remoteHydrateTimer = null
      void runRemoteHydrate()
    }, 320)
  }

  function setupTabSync() {
    if (typeof BroadcastChannel === 'undefined' || syncChannel) return
    try {
      syncChannel = new BroadcastChannel(SYNC_CHANNEL)
      syncChannel.onmessage = (event) => {
        const data = event.data as { type?: string; from?: string } | null
        if (!data || data.type !== 'nav-changed' || data.from === tabId) return
        scheduleRemoteHydrate()
      }
    } catch {
      syncChannel = null
    }
  }

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

  function resolveSiteIcon(site: Site) {
    if (iconOverrides.value.has(site.id)) {
      return iconOverrides.value.get(site.id) || undefined
    }
    return site.icon
  }

  async function hydrate() {
    const data = await storage.getAll()
    categories.value = data.categories
    sites.value = data.sites
    settings.value = data.settings
    iconOverrides.value = new Map()
    pendingIconWrites.clear()
    if (settings.value.allowThirdPartyFavicon) {
      preconnectIconOrigins()
    }
  }

  async function init() {
    if (ready.value) return
    loading.value = true
    initError.value = null
    try {
      await hydrate()
      ready.value = true
      setupTabSync()
    } catch (error) {
      // 隐私模式 / IndexedDB 禁用：降级内存存储，页面仍可用
      storage = new MemoryStorage()
      usingMemoryFallback.value = true
      initError.value =
        error instanceof Error
          ? error.message
          : '本地数据库不可用，已切换为内存模式（刷新后数据会丢失）'
      try {
        await hydrate()
        ready.value = true
      } catch (fallbackError) {
        initError.value =
          fallbackError instanceof Error
            ? fallbackError.message
            : '无法初始化导航数据'
        ready.value = false
      }
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
    notifyOtherTabs()
  }

  function findDuplicateSite(url: string, excludeId?: string): Site | undefined {
    const normalized = sanitizeHttpUrl(url)
    if (!normalized) return undefined
    return sites.value.find(
      (s) => s.id !== excludeId && sanitizeHttpUrl(s.url) === normalized,
    )
  }

  async function upsertCategory(input: Partial<Category> & { name: string }) {
    const now = Date.now()
    const existing = input.id ? categories.value.find((c) => c.id === input.id) : undefined
    const parentId =
      input.parentId !== undefined ? input.parentId : (existing?.parentId ?? null)
    if (parentId) {
      const parent = categories.value.find((c) => c.id === parentId)
      if (parent?.parentId) {
        throw new Error('分类最多两级，请选择根分类作为上级')
      }
      // 禁止把「已有子分类」的节点挂到别人下面，否则会形成 depth≥2
      const selfId = existing?.id
      if (selfId) {
        const hasChildren = categories.value.some((c) => c.parentId === selfId)
        if (hasChildren) {
          throw new Error('该分类下已有子分类，不能再设置上级')
        }
      }
    }
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
    notifyOtherTabs()
  }

  async function removeCategory(id: string) {
    const ids = getDescendantIds(categories.value, id)
    await storage.removeCategory(id)
    categories.value = categories.value.filter((c) => !ids.includes(c.id))
    sites.value = sites.value.filter((s) => !ids.includes(s.categoryId))
    if (activeCategoryId.value && ids.includes(activeCategoryId.value)) {
      activeCategoryId.value = null
    }
    notifyOtherTabs()
  }

  async function upsertSite(
    input: Partial<Site> & { title: string; url: string; categoryId: string },
  ) {
    const now = Date.now()
    const existing = input.id ? sites.value.find((s) => s.id === input.id) : undefined
    const url = sanitizeHttpUrl(input.url)
    if (!url) throw new Error('网址仅支持 http/https')
    const dup = findDuplicateSite(url, existing?.id)
    if (dup) throw new Error(`网址已存在：${dup.title}`)
    const siblings = sites.value.filter((s) => s.categoryId === input.categoryId)
    const rawIcon = input.icon !== undefined ? input.icon : existing?.icon
    const icon = rawIcon?.trim() ? sanitizeIconUrl(rawIcon) ?? undefined : undefined
    const site: Site = {
      id: existing?.id ?? createId('site'),
      categoryId: input.categoryId,
      title: input.title,
      url,
      description: input.description ?? existing?.description,
      icon,
      tags: input.tags ?? existing?.tags,
      order: input.order ?? existing?.order ?? nextSiblingOrder(siblings),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    await storage.putSite(site)
    const idx = sites.value.findIndex((s) => s.id === site.id)
    if (idx >= 0) sites.value[idx] = site
    else sites.value.push(site)
    notifyOtherTabs()
  }

  async function removeSite(id: string) {
    await storage.removeSite(id)
    sites.value = sites.value.filter((s) => s.id !== id)
    notifyOtherTabs()
  }

  async function flushPendingIcons() {
    if (!pendingIconWrites.size) return
    const batch = [...pendingIconWrites.values()]
    pendingIconWrites.clear()
    try {
      await storage.putSites(batch)
    } catch (err) {
      // 落库失败时回填队列，等待下一次调度重试；避免图标数据静默丢失
      for (const item of batch) {
        if (!pendingIconWrites.has(item.id)) pendingIconWrites.set(item.id, item)
      }
      console.warn('[nav] icon flush failed, queued for retry:', err)
    }
  }

  function scheduleIconFlush() {
    if (iconFlushTimer != null) return
    iconFlushTimer = setTimeout(() => {
      iconFlushTimer = null
      void flushPendingIcons()
    }, 420)
  }

  /**
   * 回写站点图标。默认不覆盖已有 icon（用于自动探测补全）。
   * 先写覆盖层，批量落库，避免触发 sitesByCategory 全量重算。
   */
  async function patchSiteIcon(
    id: string,
    icon: string,
    opts?: { overwrite?: boolean },
  ) {
    const trimmed = icon.trim()
    const safeIcon = trimmed ? sanitizeIconUrl(trimmed) : null
    if (trimmed && !safeIcon) return
    const current = sites.value.find((s) => s.id === id)
    if (!current) return
    const existing = resolveSiteIcon(current)?.trim()
    if (!opts?.overwrite && existing) return

    const nextMap = new Map(iconOverrides.value)
    if (safeIcon) nextMap.set(id, safeIcon)
    else nextMap.set(id, '')
    iconOverrides.value = nextMap

    const next: Site = {
      ...current,
      icon: safeIcon || undefined,
      updatedAt: Date.now(),
    }
    pendingIconWrites.set(id, next)
    scheduleIconFlush()
  }

  /** 同级分类重排（parentId 为 null 表示根级） */
  async function reorderCategories(parentId: string | null, orderedIds: string[]) {
    if (!orderedIds.length) return
    const now = Date.now()
    const orderMap = new Map(orderedIds.map((id, i) => [id, i]))
    const changed: Category[] = []
    const next = categories.value.map((c) => {
      if (!sameParent(c, parentId)) return c
      const order = orderMap.get(c.id)
      if (order === undefined) return c
      const updated = { ...c, order, updatedAt: now }
      changed.push(updated)
      return updated
    })
    categories.value = next
    await storage.putCategories(changed)
    notifyOtherTabs()
  }

  /** 批量写回扁平树（拖拽排序/缩进后一次提交） */
  async function syncCategoryHierarchy(
    items: Array<{ id: string; parentId: string | null; order: number }>,
  ) {
    if (!items.length) return
    const now = Date.now()
    const normParent = (p: string | null | undefined) =>
      p == null || p === '' ? null : p
    const patch = new Map(
      items.map((item) => [item.id, { ...item, parentId: normParent(item.parentId) }]),
    )
    const changed: Category[] = []
    const next = categories.value.map((c) => {
      const item = patch.get(c.id)
      if (!item) return c
      const parentId = item.parentId
      if (normParent(c.parentId) === parentId && c.order === item.order) return c
      const updated = { ...c, parentId, order: item.order, updatedAt: now }
      changed.push(updated)
      return updated
    })
    if (!changed.length) return
    categories.value = next
    await storage.putCategories(changed)
    notifyOtherTabs()
  }

  /** 同一分类下网址重排 */
  async function reorderSites(categoryId: string, orderedIds: string[]) {
    if (!orderedIds.length) return
    const now = Date.now()
    const orderMap = new Map(orderedIds.map((id, i) => [id, i]))
    const changed: Site[] = []
    const next = sites.value.map((s) => {
      if (s.categoryId !== categoryId) return s
      const order = orderMap.get(s.id)
      if (order === undefined) return s
      const updated = { ...s, order, updatedAt: now }
      changed.push(updated)
      return updated
    })
    sites.value = next
    await storage.putSites(changed)
    notifyOtherTabs()
  }

  async function updateSettings(patch: Partial<AppSettings>) {
    const prevFavicon = settings.value.allowThirdPartyFavicon
    settings.value = normalizeAppSettings({ ...settings.value, ...patch })
    await storage.saveSettings(settings.value)
    if (settings.value.allowThirdPartyFavicon) {
      preconnectIconOrigins()
    } else if (prevFavicon && !settings.value.allowThirdPartyFavicon) {
      clearSiteIconHostCache()
    }
    notifyOtherTabs()
  }

  async function exportBackup() {
    await flushPendingIcons()
    const mergedSites = sites.value.map((s) => {
      if (!iconOverrides.value.has(s.id)) return s
      const icon = iconOverrides.value.get(s.id)
      return { ...s, icon: icon || undefined }
    })
    const json = exportToJson({
      categories: categories.value,
      sites: mergedSites,
      settings: settings.value,
    })
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = downloadExportFilename()
    a.click()
    URL.revokeObjectURL(url)
    return json
  }

  async function importBackup(raw: string, mode: ImportMode) {
    const validated = validateImportJson(raw)
    if (!validated.ok) {
      throw new Error(validated.error)
    }
    try {
      await flushPendingIcons()
      const { data, result } = applyImport(
        {
          categories: JSON.parse(JSON.stringify(categories.value)) as Category[],
          sites: JSON.parse(JSON.stringify(sites.value)) as Site[],
          settings: JSON.parse(JSON.stringify(settings.value)) as AppSettings,
        },
        validated.payload,
        mode,
      )
      await storage.saveAll(data)
      categories.value = data.categories
      sites.value = data.sites
      settings.value = data.settings
      iconOverrides.value = new Map()
      notifyOtherTabs()
      return result
    } catch (e) {
      if (e instanceof Error) throw e
      throw new Error('导入数据校验失败，请确认文件是 NiceNav 备份 JSON')
    }
  }

  async function clearAll() {
    await flushPendingIcons()
    await storage.clear()
    clearSiteIconHostCache()
    categories.value = []
    sites.value = []
    settings.value = { ...DEFAULT_SETTINGS }
    iconOverrides.value = new Map()
    await persistAll()
    notifyOtherTabs()
  }

  function openSite(site: Site) {
    if (!isAllowedHttpUrl(site.url)) return
    const target = settings.value.openInNewTab ? '_blank' : '_self'
    window.open(site.url, target, 'noopener,noreferrer')
  }

  function openExternalSearch(query: string, engineIndex = 0) {
    const engine = settings.value.searchEngines[engineIndex]
    if (!engine || !query.trim()) return
    const url = buildSearchEngineUrl(engine.urlTemplate, query)
    if (!isAllowedHttpUrl(url)) return
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return {
    categories,
    sites,
    settings,
    iconOverrides,
    ready,
    usingMemoryFallback,
    initError,
    searchQuery,
    activeCategoryId,
    editMode,
    toggleEditMode,
    setEditMode,
    filteredSites,
    sitesByCategory,
    categoryTree,
    rootCategories,
    childrenOf,
    resolveSiteIcon,
    init,
    upsertCategory,
    removeCategory,
    upsertSite,
    removeSite,
    patchSiteIcon,
    reorderCategories,
    syncCategoryHierarchy,
    reorderSites,
    updateSettings,
    exportBackup,
    importBackup,
    clearAll,
    openSite,
    openExternalSearch,
  }
})
