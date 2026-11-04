<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useNavStore } from '@/stores/nav'
import GlobalSearch from '@/components/layout/GlobalSearch.vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const nav = useNavStore()
const rootRef = ref<HTMLElement | null>(null)
let previousOverflow = ''
let previousPaddingRight = ''

function unlockBodyScroll() {
  document.body.style.overflow = previousOverflow
  document.body.style.paddingRight = previousPaddingRight
}

function lockBodyScroll() {
  previousOverflow = document.body.style.overflow
  previousPaddingRight = document.body.style.paddingRight
  const scrollbar = window.innerWidth - document.documentElement.clientWidth
  document.body.style.overflow = 'hidden'
  if (scrollbar > 0) {
    document.body.style.paddingRight = `${scrollbar}px`
  }
}

function close(clearQuery = true) {
  if (clearQuery) nav.searchQuery = ''
  emit('update:modelValue', false)
}

function onOverlayClick(e: MouseEvent) {
  if (e.target !== e.currentTarget) return
  close(true)
}

function focusables(): HTMLElement[] {
  const root = rootRef.value
  if (!root) return []
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    close(true)
    return
  }
  if (e.key !== 'Tab') return
  const items = focusables()
  if (items.length === 0) return
  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last) return
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      lockBodyScroll()
      await nextTick()
      const input = rootRef.value?.querySelector<HTMLInputElement>('.cmd-search__input')
      input?.focus()
      input?.select()
      return
    }
    unlockBodyScroll()
  },
)

onBeforeUnmount(() => {
  unlockBodyScroll()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="search-dlg">
      <div
        v-if="modelValue"
        ref="rootRef"
        class="search-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="搜索"
        @keydown="onKeydown"
        @click="onOverlayClick"
      >
        <div class="search-dialog__panel" @click.stop>
          <GlobalSearch class="search-dialog__form" :enable-hotkey="false" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.search-dialog {
  position: fixed;
  inset: 0;
  z-index: 4000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: min(16vh, 120px) 20px 24px;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  box-sizing: border-box;
}

.search-dialog__panel {
  width: min(920px, calc(100vw - 40px));
  padding: 8px;
  border-radius: 16px;
  background: var(--nn-section-bg, #fff);
  box-shadow: 0 20px 50px rgba(15, 40, 80, 0.22);
  box-sizing: border-box;
  overflow: visible;
}

:deep(.search-dialog__form.cmd-search) {
  min-height: 52px;
  padding: 6px 8px 6px 10px;
  background: var(--nn-tab-bg, #f2f4f7);
  border-radius: 14px;
  box-shadow: none;

  &:focus-within {
    background: var(--nn-section-bg, #fff);
    box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--nn-primary) 40%, transparent);
  }

  .cmd-search__engine {
    height: 36px;
    padding: 0 12px;
    font-size: 13px;
    background: var(--nn-section-bg, #fff);
  }

  .cmd-search__input {
    font-size: 15px;
  }

  .cmd-search__clear {
    width: 32px;
    height: 32px;
  }
}

.search-dlg-enter-active,
.search-dlg-leave-active {
  transition: opacity 0.2s ease;

  .search-dialog__panel {
    transition:
      transform 0.24s cubic-bezier(0.22, 1, 0.36, 1),
      opacity 0.2s ease;
  }
}

.search-dlg-enter-from,
.search-dlg-leave-to {
  opacity: 0;

  .search-dialog__panel {
    opacity: 0;
    transform: translateY(-10px) scale(0.98);
  }
}
</style>
