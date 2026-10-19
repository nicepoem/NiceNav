import type { InjectionKey, Ref } from 'vue'
import type { Category, Site } from '@nice-nav/core'

export type NavHostContext = {
  mobileOpen: Ref<boolean>
  openAddSite: () => void
  openManageCategories: () => void
  openImportData: () => void
}

export type NavMainHandlers = {
  openEditSite: (site: Site) => void
  removeSite: (site: Site) => void
  openEditCategory: (category: Category) => void
  removeCategory: (category: Category) => void
  openAddSite: (category?: Category) => void
}

export const NAV_HOST_KEY: InjectionKey<NavHostContext> = Symbol('nav-host')
export const NAV_MAIN_HANDLERS_KEY: InjectionKey<NavMainHandlers> =
  Symbol('nav-main-handlers')
