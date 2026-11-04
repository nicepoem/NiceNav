<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  Top,
  Plus,
  Rank,
  Check,
  FolderOpened,
  Sunny,
  Moon,
  Setting,
} from '@element-plus/icons-vue'
import type { DockButtonId } from '@nice-nav/core'
import { normalizeDockOrder } from '@nice-nav/core'
import { useNavStore } from '@/stores/nav'
import { useTheme } from '@/composables/useTheme'

const emit = defineEmits<{
  addSite: []
  manageCategories: []
  openSettings: []
}>()

const nav = useNavStore()
const { setTheme } = useTheme()

const showBackTop = ref(false)
/** 跟随 document 实际明暗，避免 system 模式图标不准 */
const isDark = ref(false)
/** 滚动中隐藏，停稳后再显示 */
const scrollingHidden = ref(false)
let revealTimer: ReturnType<typeof setTimeout> | null = null
const REVEAL_DELAY_MS = 900

const enabled = computed(() => nav.settings.dockEnabled !== false)
const flags = computed(() => ({
  backTop: nav.settings.dockBackTop !== false,
  addSite: nav.settings.dockAddSite !== false,
  manageCategories: nav.settings.dockManageCategories !== false,
  sort: nav.settings.dockSort !== false,
  settings: true,
  theme: nav.settings.dockTheme !== false,
}))

const order = computed(() => normalizeDockOrder(nav.settings.dockOrder))

const visible = computed(() => enabled.value && order.value.some((id) => flags.value[id as keyof typeof flags.value]))

/** 排序模式中保持可见，便于点「完成」 */
const dockObscured = computed(
  () => scrollingHidden.value && !nav.editMode,
)

const themeTitle = computed(() => (isDark.value ? '切换浅色' : '切换深色'))

function syncDark() {
  isDark.value = document.documentElement.classList.contains('dark')
}

function clearRevealTimer() {
  if (revealTimer != null) {
    clearTimeout(revealTimer)
    revealTimer = null
  }
}

function onScroll() {
  showBackTop.value = window.scrollY > 320
  scrollingHidden.value = true
  clearRevealTimer()
  revealTimer = setTimeout(() => {
    scrollingHidden.value = false
    revealTimer = null
  }, REVEAL_DELAY_MS)
}

function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function toggleTheme() {
  await setTheme(isDark.value ? 'light' : 'dark')
  syncDark()
}

function onClick(id: DockButtonId) {
  if (id === 'backTop') scrollTop()
  else if (id === 'addSite') emit('addSite')
  else if (id === 'manageCategories') emit('manageCategories')
  else if (id === 'sort') nav.toggleEditMode()
  else if (id === 'settings') emit('openSettings')
  else if (id === 'theme') void toggleTheme()
}

let themeObserver: MutationObserver | null = null

onMounted(() => {
  showBackTop.value = window.scrollY > 320
  syncDark()
  themeObserver = new MutationObserver(syncDark)
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme'],
  })
  window.addEventListener('scroll', onScroll, { passive: true })
})

onUnmounted(() => {
  clearRevealTimer()
  themeObserver?.disconnect()
  themeObserver = null
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <aside
    v-if="visible"
    class="float-dock"
    :class="{ 'is-obscured': dockObscured }"
    aria-label="快捷操作"
  >
    <template v-for="id in order" :key="id">
      <Transition v-if="id === 'backTop' && flags.backTop" name="dock-fade">
        <button
          v-if="showBackTop"
          type="button"
          class="dock-btn"
          title="返回顶部"
          aria-label="返回顶部"
          @click="onClick(id)"
        >
          <el-icon :size="18"><Top /></el-icon>
        </button>
      </Transition>

      <button
        v-else-if="id === 'addSite' && flags.addSite"
        type="button"
        class="dock-btn"
        title="添加"
        aria-label="添加"
        @click="onClick(id)"
      >
        <el-icon :size="18"><Plus /></el-icon>
      </button>

      <button
        v-else-if="id === 'manageCategories' && flags.manageCategories"
        type="button"
        class="dock-btn"
        title="分类管理"
        aria-label="分类管理"
        @click="onClick(id)"
      >
        <el-icon :size="18"><FolderOpened /></el-icon>
      </button>

      <button
        v-else-if="id === 'sort' && flags.sort"
        type="button"
        class="dock-btn"
        :class="{ 'is-active': nav.editMode }"
        :title="nav.editMode ? '完成排序' : '排序'"
        :aria-label="nav.editMode ? '完成排序' : '排序'"
        :aria-pressed="nav.editMode"
        @click="onClick(id)"
      >
        <el-icon :size="18">
          <Check v-if="nav.editMode" />
          <Rank v-else />
        </el-icon>
      </button>

      <button
        v-else-if="id === 'settings' && flags.settings"
        type="button"
        class="dock-btn"
        title="设置"
        aria-label="设置"
        @click="onClick(id)"
      >
        <el-icon :size="18"><Setting /></el-icon>
      </button>

      <button
        v-else-if="id === 'theme' && flags.theme"
        type="button"
        class="dock-btn"
        :title="themeTitle"
        :aria-label="themeTitle"
        @click="onClick(id)"
      >
        <el-icon :size="18">
          <Sunny v-if="isDark" />
          <Moon v-else />
        </el-icon>
      </button>
    </template>
  </aside>
</template>

<style scoped lang="scss">
.float-dock {
  position: fixed;
  right: 16px;
  bottom: 24px;
  z-index: 80;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  pointer-events: none;
  opacity: 1;
  transform: translate3d(0, 0, 0) scale(1);
  // 出现：稍慢、带缓出，更柔和
  transition:
    opacity 0.42s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.48s cubic-bezier(0.22, 1, 0.36, 1);

  &.is-obscured {
    opacity: 0;
    transform: translate3d(20px, 12px, 0) scale(0.94);
    pointer-events: none;
    // 收起：略快，避免拖泥带水
    transition:
      opacity 0.26s cubic-bezier(0.4, 0, 0.2, 1),
      transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    .dock-btn {
      pointer-events: none;
    }
  }
}

.dock-btn {
  pointer-events: auto;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 12px;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: var(--nn-sidebar-text, var(--el-text-color-regular));
  background: var(--nn-section-bg, #fff);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.1);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  transition:
    transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.28s ease;

  &:hover {
    color: var(--nn-primary);
    background: var(--nn-section-bg, #fff);
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.14);
    transform: translateY(-1px);
  }

  &:active {
    transform: scale(0.96);
  }

  &.is-active {
    color: #fff;
    background: var(--nn-primary);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--nn-primary) 35%, transparent);
  }
}

.dock-fade-enter-active {
  transition:
    opacity 0.36s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

.dock-fade-leave-active {
  transition:
    opacity 0.22s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.24s cubic-bezier(0.4, 0, 0.2, 1);
}

.dock-fade-enter-from,
.dock-fade-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.92);
}

@media (max-width: 900px) {
  .float-dock {
    right: 10px;
    bottom: 78px; /* 避开左下角侧栏浮动按钮 */
  }

  .dock-btn {
    width: 40px;
    height: 40px;
    border-radius: 11px;
  }
}
</style>
