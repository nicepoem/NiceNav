<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  Top,
  Moon,
  Sunny,
  Plus,
  Rank,
  Check,
  FolderOpened,
} from '@element-plus/icons-vue'
import type { DockButtonId } from '@nice-nav/core'
import { normalizeDockOrder } from '@nice-nav/core'
import { useNavStore } from '@/stores/nav'
import { useTheme } from '@/composables/useTheme'

const emit = defineEmits<{
  addSite: []
  manageCategories: []
}>()

const nav = useNavStore()
const { setTheme } = useTheme()

const showBackTop = ref(false)

const enabled = computed(() => nav.settings.dockEnabled !== false)
const flags = computed(() => ({
  backTop: nav.settings.dockBackTop !== false,
  theme: nav.settings.dockTheme !== false,
  addSite: nav.settings.dockAddSite !== false,
  manageCategories: nav.settings.dockManageCategories !== false,
  sort: nav.settings.dockSort !== false,
}))

const order = computed(() => normalizeDockOrder(nav.settings.dockOrder))

const visible = computed(() => enabled.value && order.value.some((id) => flags.value[id]))

const isDark = computed(() => {
  const mode = nav.settings.theme
  if (mode === 'dark') return true
  if (mode === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
})

function onScroll() {
  showBackTop.value = window.scrollY > 320
}

function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function toggleTheme() {
  await setTheme(isDark.value ? 'light' : 'dark')
}

function onClick(id: DockButtonId) {
  if (id === 'backTop') scrollTop()
  else if (id === 'addSite') emit('addSite')
  else if (id === 'manageCategories') emit('manageCategories')
  else if (id === 'sort') nav.toggleEditMode()
  else if (id === 'theme') void toggleTheme()
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <aside v-if="visible" class="float-dock" aria-label="快捷操作">
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
        v-else-if="id === 'theme' && flags.theme"
        type="button"
        class="dock-btn"
        :title="isDark ? '切换亮色' : '切换暗色'"
        :aria-label="isDark ? '切换亮色' : '切换暗色'"
        @click="onClick(id)"
      >
        <el-icon :size="18"><Sunny v-if="isDark" /><Moon v-else /></el-icon>
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
    transform var(--nn-transition-fast),
    color var(--nn-transition-fast),
    background var(--nn-transition-fast),
    box-shadow var(--nn-transition-fast);

  &:hover {
    color: var(--nn-primary);
    background: var(--nn-section-bg, #fff);
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.14);
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

.dock-fade-enter-active,
.dock-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.dock-fade-enter-from,
.dock-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
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
