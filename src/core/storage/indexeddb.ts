import Dexie, { type Table } from 'dexie'
import { getDescendantIds } from '../category-tree'
import {
  hasObsoleteSettings,
  normalizeAppSettings,
  SEED_VERSION,
  stripUnusedHeaderMenus,
} from '../defaults'
import { createSeedData } from '../demo-catalog'
import type { AppSettings, Category, NavData, Site } from '../types'
import { clonePlain } from './clone'
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
    const seedVersionRow = await this.db.meta.get('seedVersion')
    const currentVersion = typeof seedVersionRow?.value === 'number' ? seedVersionRow.value : 0

    // 版本落后时强制重写（不依赖内存 seeded，避免 HMR 挡升级）
    if (currentVersion < SEED_VERSION) {
      await this.writeSeed()
      this.seeded = true
      return
    }

    if (this.seeded) return

    const seededFlag = await this.db.meta.get('seeded')
    const count = await this.db.categories.count()
    if (!seededFlag && count === 0) {
      await this.writeSeed()
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

    const rawSettings =
      settingsRow && typeof settingsRow.value === 'object' ? settingsRow.value : null
    const settings = normalizeAppSettings(rawSettings as AppSettings | null)
    const headerMenus = settings.headerMenus
    const cleanedMenus = stripUnusedHeaderMenus(headerMenus)
    settings.headerMenus = cleanedMenus
    if (cleanedMenus.length !== headerMenus.length || hasObsoleteSettings(rawSettings)) {
      await this.db.meta.put({ key: 'settings', value: clonePlain(settings) })
    }

    return {
      categories: categories.sort((a, b) => a.order - b.order),
      sites: sites.sort((a, b) => a.order - b.order),
      settings,
    }
  }

  async saveAll(data: NavData): Promise<void> {
    const plain = clonePlain(data)
    await this.db.transaction('rw', this.db.categories, this.db.sites, this.db.meta, async () => {
      await this.db.categories.clear()
      await this.db.sites.clear()
      await this.db.categories.bulkPut(plain.categories)
      await this.db.sites.bulkPut(plain.sites)
      await this.db.meta.put({ key: 'settings', value: plain.settings })
      await this.db.meta.put({ key: 'seeded', value: true })
      await this.db.meta.put({ key: 'seedVersion', value: SEED_VERSION })
    })
    this.seeded = true
  }

  async putCategory(category: Category): Promise<void> {
    await this.ensureSeed()
    await this.db.categories.put(clonePlain(category))
  }

  async putSite(site: Site): Promise<void> {
    await this.ensureSeed()
    await this.db.sites.put(clonePlain(site))
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
    await this.db.meta.put({ key: 'settings', value: clonePlain(settings) })
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
