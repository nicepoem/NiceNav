import { watch } from 'vue'
import { useNavStore } from '@/stores/nav'
import type { ThemeMode } from '@nice-nav/core'

const THEME_BOOT_KEY = 'nn.theme.boot'

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function applyTheme(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'system' && systemPrefersDark())
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  try {
    localStorage.setItem(THEME_BOOT_KEY, mode)
  } catch {
    // ignore
  }
}

/** 在 Vue mount 前同步应用，避免主题闪烁 */
export function bootstrapThemeFromCache() {
  let mode: ThemeMode = 'system'
  try {
    const raw = localStorage.getItem(THEME_BOOT_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') mode = raw
  } catch {
    // ignore
  }
  applyTheme(mode)
}

export function useTheme() {
  const nav = useNavStore()

  function initTheme() {
    applyTheme(nav.settings.theme)
    watch(
      () => nav.settings.theme,
      (mode) => applyTheme(mode),
    )
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (nav.settings.theme === 'system') applyTheme('system')
    })
  }

  async function setTheme(mode: ThemeMode) {
    await nav.updateSettings({ theme: mode })
    applyTheme(mode)
  }

  return { initTheme, setTheme, applyTheme }
}
