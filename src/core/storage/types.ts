import type { AppSettings, Category, NavData, Site } from '../types'

export interface NavStorage {
  getAll(): Promise<NavData>
  saveAll(data: NavData): Promise<void>
  putCategory(category: Category): Promise<void>
  putSite(site: Site): Promise<void>
  removeCategory(id: string): Promise<void>
  removeSite(id: string): Promise<void>
  saveSettings(settings: AppSettings): Promise<void>
  clear(): Promise<void>
}
