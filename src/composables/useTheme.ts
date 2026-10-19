import { watch } from 'vue'
import { useNavStore } from '@/stores/nav'
import type { ThemeMode } from '@nice-nav/core'

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'system' && systemPrefersDark())
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
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
