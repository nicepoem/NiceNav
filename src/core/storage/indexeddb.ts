import Dexie, { type Table } from 'dexie'
import { getDescendantIds } from '../category-tree'
import {
  DEFAULT_SETTINGS,
  normalizeDockOrder,
  normalizeHeaderMenus,
  SEED_VERSION,
  stripUnusedHeaderMenus,
} from '../defaults'
import { createSeedData } from '../seed'
import type { AppSettings, Category, NavData, Site } from '../types'
import type { NavStorage } from './types'

type MetaRow = {
  key: string
  value: AppSettings | boolean | number
}

class NiceNavDatabase extends Dexie {
  categories!: Table<Category, string>
  sites!: Table<Site, string>
  meta!: Table<MetaRow, string>

  constructor(dbName = 'nice-nav') {
    super(dbName)
    this.version(1).stores({
      categories: 'id, order, parentId',
      sites: 'id, categoryId, order',
      meta: 'key',
    })
  }
}

export class IndexedDbStorage implements NavStorage {
  private db: NiceNavDatabase
  private seeded = false

  constructor(dbName = 'nice-nav') {
    this.db = new NiceNavDatabase(dbName)
  }

  private async writeSeed(seed = createSeedData()) {
    await this.db.transaction('rw', this.db.categories, this.db.sites, this.db.meta, async () => {
      await this.db.categories.clear()
      await this.db.sites.clear()
      await this.db.categories.bulkPut(seed.categories)
      await this.db.sites.bulkPut(seed.sites)
      await this.db.meta.put({ key: 'settings', value: seed.settings })
      await this.db.meta.put({ key: 'seeded', value: true })
      await this.db.meta.put({ key: 'seedVersion', value: SEED_VERSION })
    })
  }

  private async ensureSeed(): Promise<void> {
    if (this.seeded) return
    const seededFlag = await this.db.meta.get('seeded')
    const seedVersionRow = await this.db.meta.get('seedVersion')
    const count = await this.db.categories.count()
    const currentVersion = typeof seedVersionRow?.value === 'number' ? seedVersionRow.value : 0

    if (!seededFlag && count === 0) {
      await this.writeSeed()
    } else if (currentVersion < SEED_VERSION) {
      // 示例数据升级：刷新带有默认 cat-* 前缀的演示库
      const cats = await this.db.categories.toArray()
      const allDemoIds = cats.length > 0 && cats.every((c) => c.id.startsWith('cat-'))
      if (count === 0 || allDemoIds) {
        await this.writeSeed()
      } else {
        await this.db.meta.put({ key: 'seedVersion', value: SEED_VERSION })
      }
    } else if (!seededFlag) {
      await this.db.meta.put({ key: 'seeded', value: true })
      await this.db.meta.put({ key: 'seedVersion', value: SEED_VERSION })
    }
    this.seeded = true
  }

  async getAll(): Promise<NavData> {
    await this.ensureSeed()
    const [categories, sites, settingsRow] = await Promise.all([
      this.db.categories.toArray(),
      this.db.sites.toArray(),
      this.db.meta.get('settings'),
    ])

    const settings =
      settingsRow && typeof settingsRow.value === 'object'
        ? ({ ...DEFAULT_SETTINGS, ...(settingsRow.value as AppSettings) } as AppSettings)
        : { ...DEFAULT_SETTINGS, searchEngines: [...DEFAULT_SETTINGS.searchEngines] }
    settings.dockOrder = normalizeDockOrder(settings.dockOrder)
    const headerMenus = normalizeHeaderMenus(settings.headerMenus)
    const cleanedMenus = stripUnusedHeaderMenus(headerMenus)
    settings.headerMenus = cleanedMenus
    settings.searchEngines = settings.searchEngines?.length
      ? settings.searchEngines
      : [...DEFAULT_SETTINGS.searchEngines]
    if (cleanedMenus.length !== headerMenus.length) {
      await this.db.meta.put({ key: 'settings', value: settings })
    }

    return {
      categories: categories.sort((a, b) => a.order - b.order),
      sites: sites.sort((a, b) => a.order - b.order),
      settings,
    }
  }

  async saveAll(data: NavData): Promise<void> {
    await this.db.transaction('rw', this.db.categories, this.db.sites, this.db.meta, async () => {
      await this.db.categories.clear()
      await this.db.sites.clear()
      await this.db.categories.bulkPut(data.categories)
      await this.db.sites.bulkPut(data.sites)
      await this.db.meta.put({ key: 'settings', value: data.settings })
      await this.db.meta.put({ key: 'seeded', value: true })
      await this.db.meta.put({ key: 'seedVersion', value: SEED_VERSION })
    })
    this.seeded = true
  }

  async putCategory(category: Category): Promise<void> {
    await this.ensureSeed()
    await this.db.categories.put(category)
  }

  async putSite(site: Site): Promise<void> {
    await this.ensureSeed()
    await this.db.sites.put(site)
  }

  async removeCategory(id: string): Promise<void> {
    await this.ensureSeed()
    const all = await this.db.categories.toArray()
    const ids = getDescendantIds(all, id)
    await this.db.transaction('rw', this.db.categories, this.db.sites, async () => {
      await this.db.categories.bulkDelete(ids)
      for (const catId of ids) {
        await this.db.sites.where('categoryId').equals(catId).delete()
      }
    })
  }

  async removeSite(id: string): Promise<void> {
    await this.ensureSeed()
    await this.db.sites.delete(id)
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await this.ensureSeed()
    await this.db.meta.put({ key: 'settings', value: settings })
  }

  async clear(): Promise<void> {
    await this.db.transaction('rw', this.db.categories, this.db.sites, this.db.meta, async () => {
      await this.db.categories.clear()
      await this.db.sites.clear()
      await this.db.meta.clear()
    })
    this.seeded = false
  }
}
