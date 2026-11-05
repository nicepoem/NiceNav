import { getDescendantIds } from '../category-tree'
import { normalizeAppSettings } from '../defaults'
import { createSeedData } from '../demo-catalog'
import type { AppSettings, Category, NavData, Site } from '../types'
import type { NavStorage } from './types'

/** IndexedDB 不可用时的内存降级存储 */
export class MemoryStorage implements NavStorage {
  private categories: Category[] = []
  private sites: Site[] = []
  private settings: AppSettings = createSeedData().settings
  private seeded = false

  private ensureSeed() {
    if (this.seeded) return
    const seed = createSeedData()
    this.categories = [...seed.categories]
    this.sites = [...seed.sites]
    this.settings = normalizeAppSettings(seed.settings)
    this.seeded = true
  }

  async getAll(): Promise<NavData> {
    this.ensureSeed()
    return {
      categories: [...this.categories].sort((a, b) => a.order - b.order),
      sites: [...this.sites].sort((a, b) => a.order - b.order),
      settings: normalizeAppSettings(this.settings),
    }
  }

  async saveAll(data: NavData): Promise<void> {
    this.categories = [...data.categories]
    this.sites = [...data.sites]
    this.settings = normalizeAppSettings(data.settings)
    this.seeded = true
  }

  async putCategory(category: Category): Promise<void> {
    this.ensureSeed()
    const index = this.categories.findIndex((c) => c.id === category.id)
    if (index >= 0) this.categories[index] = category
    else this.categories.push(category)
  }

  async putSite(site: Site): Promise<void> {
    this.ensureSeed()
    const index = this.sites.findIndex((s) => s.id === site.id)
    if (index >= 0) this.sites[index] = site
    else this.sites.push(site)
  }

  async removeCategory(id: string): Promise<void> {
    this.ensureSeed()
    const ids = new Set(getDescendantIds(this.categories, id))
    this.categories = this.categories.filter((c) => !ids.has(c.id))
    this.sites = this.sites.filter((s) => !ids.has(s.categoryId))
  }

  async removeSite(id: string): Promise<void> {
    this.ensureSeed()
    this.sites = this.sites.filter((s) => s.id !== id)
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    this.ensureSeed()
    this.settings = normalizeAppSettings(settings)
  }

  async clear(): Promise<void> {
    this.categories = []
    this.sites = []
    this.settings = createSeedData().settings
    this.seeded = false
  }
}
