import type { AppModule } from './types'
import { navModule } from './nav'

const modules: AppModule[] = [navModule]

const byId = new Map(modules.map((m) => [m.id, m]))

export function listModules(): AppModule[] {
  return [...modules]
}

export function getModule(id: string): AppModule | undefined {
  return byId.get(id)
}

export function registerModule(mod: AppModule): void {
  if (byId.has(mod.id)) {
    console.warn(`[modules] duplicate id "${mod.id}", skipped`)
    return
  }
  modules.push(mod)
  byId.set(mod.id, mod)
}
