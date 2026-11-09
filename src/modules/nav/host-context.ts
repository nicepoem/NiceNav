import type { InjectionKey, Ref } from 'vue'
import type { Site } from '@nice-nav/core'

export type NavHostContext = {
  mobileOpen: Ref<boolean>
  openAddSite: () => void
  openManageCategories: () => void
  openSettings: () => void
}

export type NavMainHandlers = {
  openEditSite: (site: Site) => void
  removeSite: (site: Site) => void
}

export const NAV_HOST_KEY: InjectionKey<NavHostContext> = Symbol('nav-host')
export const NAV_MAIN_HANDLERS_KEY: InjectionKey<NavMainHandlers> =
  Symbol('nav-main-handlers')
