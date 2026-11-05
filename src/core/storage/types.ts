import type { AppSettings, Category, NavData, Site } from '../types'

export interface NavStorage {
  getAll(): Promise<NavData>
  saveAll(data: NavData): Promise<void>
  putCategory(category: Category): Promise<void>
  putSite(site: Site): Promise<void>
  /** 批量写入分类（一次事务） */
  putCategories(categories: Category[]): Promise<void>
  /** 批量写入网址（一次事务） */
  putSites(sites: Site[]): Promise<void>
  removeCategory(id: string): Promise<void>
  removeSite(id: string): Promise<void>
  saveSettings(settings: AppSettings): Promise<void>
  clear(): Promise<void>
}
