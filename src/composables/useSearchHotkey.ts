import { nextTick, onBeforeUnmount, onMounted } from 'vue'
import { useNavStore } from '@/stores/nav'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return target.isContentEditable
}

function isSearchInput(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.classList.contains('cmd-search__input')
}

function focusSearchInput() {
  const input = document.querySelector<HTMLInputElement>('.cmd-search__input')
  input?.focus()
  input?.select()
}

/** `/` 或 Ctrl/Cmd+K 打开/聚焦搜索；Esc 清搜索、关弹窗或退出排序 */
export function useSearchHotkey(options?: {
  /** 为 false 时不响应快捷键（可传函数） */
  enabled?: boolean | (() => boolean)
  clearLocalQuery?: () => void
  /** 打开搜索弹窗；提供后快捷键会先打开再聚焦 */
  openSearch?: () => void
  /** 关闭搜索弹窗 */
  closeSearch?: () => void
  /** 搜索弹窗是否打开 */
  isOpen?: () => boolean
}) {
  const nav = useNavStore()

  function isEnabled() {
    const flag = options?.enabled
    if (typeof flag === 'function') return flag()
    return flag !== false
  }

  async function focusSearch() {
    if (options?.openSearch) {
      options.openSearch()
      await nextTick()
      await nextTick()
      focusSearchInput()
      return
    }
    focusSearchInput()
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || !isEnabled()) return
    const meta = event.ctrlKey || event.metaKey
    const dialogOpen = options?.isOpen?.() === true

    if (event.key === 'Escape') {
      if (dialogOpen) {
        event.preventDefault()
        options?.closeSearch?.()
        return
      }
      if (nav.editMode) {
        event.preventDefault()
        nav.setEditMode(false)
        return
      }
      const hasLocal = Boolean(
        document.querySelector<HTMLInputElement>('.cmd-search__input')?.value.trim(),
      )
      if (nav.searchQuery || hasLocal) {
        event.preventDefault()
        nav.searchQuery = ''
        options?.clearLocalQuery?.()
        if (isSearchInput(event.target)) {
          ;(event.target as HTMLInputElement).blur()
        }
      }
      return
    }

    if (meta && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      void focusSearch()
      return
    }
    if (event.key === '/' && !meta && !event.altKey && !isEditableTarget(event.target)) {
      event.preventDefault()
      void focusSearch()
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

  return { focusSearch }
}
