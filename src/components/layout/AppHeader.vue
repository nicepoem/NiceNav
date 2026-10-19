<script setup lang="ts">
import { computed } from 'vue'
import {
  Menu,
  Plus,
  Download,
  Upload,
  Moon,
  Sunny,
  Rank,
  Check,
  ArrowDown,
  FolderOpened,
} from '@element-plus/icons-vue'
import type { HeaderMenuItem, HeaderMenuLink } from '@nice-nav/core'
import { normalizeHeaderMenus } from '@nice-nav/core'
import { useNavStore } from '@/stores/nav'
import { useTheme } from '@/composables/useTheme'

const emit = defineEmits<{
  openMobile: []
  addSite: []
  manageCategories: []
  importData: []
}>()

const nav = useNavStore()
const { setTheme } = useTheme()

/** 右侧浮动工具栏开启时，顶栏隐藏对应重复按钮 */
const dockOn = computed(() => nav.settings.dockEnabled !== false)

const headerMenus = computed(() =>
  normalizeHeaderMenus(nav.settings.headerMenus),
)

const isDark = computed(() => {
  const mode = nav.settings.theme
  if (mode === 'dark') return true
  if (mode === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
})

function openUrl(url: string) {
  const href = url.trim()
  if (!href) return
  const target = nav.settings.openInNewTab ? '_blank' : '_self'
  window.open(href, target, 'noopener,noreferrer')
}

function isDropdown(item: HeaderMenuItem) {
  return Boolean(item.children?.length)
}

function onMenuChild(item: HeaderMenuLink) {
  openUrl(item.url)
}

async function toggleTheme() {
  await setTheme(isDark.value ? 'light' : 'dark')
}
</script>

<template>
  <header class="navbar">
    <div class="navbar__left">
      <button
        type="button"
        class="hamburger mobile-only"
        aria-label="打开菜单"
        @click="emit('openMobile')"
      >
        <el-icon :size="20"><Menu /></el-icon>
      </button>

      <div class="navbar-brand mobile-only" title="NiceNav">
        <span class="navbar-brand__title">NiceNav</span>
      </div>

      <nav v-if="headerMenus.length" class="header-menus" aria-label="顶部导航">
        <template v-for="item in headerMenus" :key="item.id">
          <button
            v-if="!isDropdown(item)"
            type="button"
            class="header-menu-link"
            @click="openUrl(item.url || '')"
          >
            {{ item.label }}
          </button>
          <el-dropdown
            v-else
            trigger="hover"
            popper-class="nn-header-menu-popper"
            @command="onMenuChild"
          >
            <button type="button" class="header-menu-link is-dropdown">
              <span>{{ item.label }}</span>
              <el-icon :size="12" class="header-menu-caret"><ArrowDown /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="child in item.children"
                  :key="child.id"
                  :command="child"
                >
                  {{ child.label }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </nav>
    </div>

    <div class="navbar__actions">
      <!-- 浮动工具栏开启时，这些入口改到右侧 dock，顶栏隐藏以免重复 -->
      <button
        v-if="!dockOn || !nav.settings.dockAddSite"
        type="button"
        class="cta-add"
        @click="emit('addSite')"
      >
        <el-icon :size="16"><Plus /></el-icon>
        <span class="cta-add__label">添加</span>
      </button>

      <button
        v-if="!dockOn || nav.settings.dockManageCategories === false"
        type="button"
        class="sort-toggle"
        title="分类管理"
        @click="emit('manageCategories')"
      >
        <el-icon :size="15"><FolderOpened /></el-icon>
        <span class="sort-toggle__label">分类</span>
      </button>

      <button
        v-if="!dockOn || !nav.settings.dockSort"
        type="button"
        class="sort-toggle"
        :class="{ 'is-active': nav.editMode }"
        :aria-pressed="nav.editMode"
        @click="nav.toggleEditMode()"
      >
        <el-icon :size="15">
          <Check v-if="nav.editMode" />
          <Rank v-else />
        </el-icon>
        <span class="sort-toggle__label">{{ nav.editMode ? '完成' : '排序' }}</span>
      </button>

      <div
        v-if="!dockOn || !nav.settings.dockTheme"
        class="toolbar-rail"
        role="toolbar"
        aria-label="工具"
      >
        <button
          type="button"
          class="rail-btn"
          :title="isDark ? '切换亮色' : '切换暗色'"
          :aria-label="isDark ? '切换亮色' : '切换暗色'"
          @click="toggleTheme"
        >
          <el-icon :size="16"><Sunny v-if="isDark" /><Moon v-else /></el-icon>
        </button>
      </div>

      <button type="button" class="nav-io" title="导入 JSON" @click="emit('importData')">
        <el-icon :size="15"><Upload /></el-icon>
        <span class="nav-io__label">导入</span>
      </button>
      <button type="button" class="nav-io" title="导出 JSON" @click="nav.exportBackup()">
        <el-icon :size="15"><Download /></el-icon>
        <span class="nav-io__label">导出</span>
      </button>
    </div>
  </header>
</template>

<style scoped lang="scss">
.navbar {
  height: 100%;
  min-height: calc(var(--nn-header-height) - 2px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 14px;
  background: transparent;
  box-sizing: border-box;
}

.navbar__left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.navbar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.navbar-brand {
  display: none;
  align-items: center;
  min-width: 0;
}

.navbar-brand__title {
  font-size: 15px;
  font-weight: 650;
  letter-spacing: 0.04em;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.hamburger {
  border: 0;
  background: transparent;
  cursor: pointer;
  color: var(--el-text-color-regular);
  width: 32px;
  height: 32px;
  border-radius: var(--nn-item-radius);
  display: none;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition:
    background-color var(--nn-transition-fast),
    color var(--nn-transition-fast);

  &:hover {
    background-color: var(--nn-item-hover-bg);
    color: var(--nn-primary);
  }
}

.header-menus {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.header-menu-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 12px;
  margin: 0;
  border: 0;
  border-radius: var(--nn-item-radius);
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition:
    color var(--nn-transition-fast),
    background var(--nn-transition-fast);

  &:hover {
    color: var(--nn-primary);
    background: var(--nn-item-hover-bg);
  }

  &.is-dropdown {
    padding-right: 8px;
  }
}

.header-menu-caret {
  opacity: 0.65;
}

.cta-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 32px;
  padding: 0 14px;
  border: 0;
  border-radius: var(--nn-item-radius);
  background: var(--nn-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    filter var(--nn-transition-fast),
    transform var(--nn-transition-fast);

  &:hover {
    filter: brightness(1.05);
  }

  &:active {
    transform: scale(0.97);
  }
}

.sort-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--nn-item-radius);
  background: var(--nn-tab-bg);
  color: var(--el-text-color-regular);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color var(--nn-transition-fast),
    background var(--nn-transition-fast);

  &:hover {
    color: var(--nn-primary);
  }

  &.is-active {
    color: #fff;
    background: var(--nn-primary);
  }
}

.nav-io {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--nn-item-radius);
  background: var(--nn-tab-bg);
  color: var(--el-text-color-regular);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color var(--nn-transition-fast),
    background var(--nn-transition-fast);

  &:hover {
    color: var(--nn-primary);
  }
}

.toolbar-rail {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: var(--nn-item-radius);
  background: var(--nn-tab-bg);
}

.rail-btn {
  width: 30px;
  height: 28px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: calc(var(--nn-item-radius) - 2px);
  background: transparent;
  color: var(--el-text-color-regular);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    color var(--nn-transition-fast),
    background var(--nn-transition-fast);

  &:hover {
    color: var(--nn-primary);
    background: var(--nn-section-bg);
  }
}

.mobile-only {
  display: none;
}

.desktop-only {
  display: inline-flex;
}

@media (max-width: 900px) {
  .navbar {
    padding: 0 10px;
    gap: 8px;
  }

  .navbar__actions {
    gap: 6px;
  }

  .mobile-only {
    display: inline-flex;
  }

  .hamburger.mobile-only {
    display: none !important;
  }

  .navbar-brand.mobile-only {
    display: flex;
  }

  .header-menus {
    display: none;
  }

  .cta-add {
    width: 32px;
    padding: 0;
  }

  .cta-add__label,
  .sort-toggle__label,
  .nav-io__label {
    display: none;
  }

  .nav-io {
    width: 32px;
    padding: 0;
  }

  .sort-toggle {
    width: 32px;
    padding: 0;
  }
}
</style>
