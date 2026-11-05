<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Plus,
  Rank,
  Check,
  FolderOpened,
  Search,
} from '@element-plus/icons-vue'
import { useNavStore } from '@/stores/nav'
import { useSearchHotkey } from '@/composables/useSearchHotkey'
import SearchDialog from '@/components/layout/SearchDialog.vue'

const emit = defineEmits<{
  openMobile: []
  addSite: []
  manageCategories: []
}>()

const nav = useNavStore()
const searchOpen = ref(false)

useSearchHotkey({
  openSearch: () => {
    searchOpen.value = true
  },
  closeSearch: () => {
    searchOpen.value = false
    nav.searchQuery = ''
  },
  isOpen: () => searchOpen.value,
  clearLocalQuery: () => {
    nav.searchQuery = ''
  },
})

/** 右侧浮动工具栏开启时，顶栏隐藏对应重复按钮 */
const dockOn = computed(() => nav.settings.dockEnabled !== false)

const hasQuery = computed(() => Boolean(nav.searchQuery.trim()))

const hasActions = computed(
  () =>
    !dockOn.value ||
    !nav.settings.dockAddSite ||
    nav.settings.dockManageCategories === false ||
    !nav.settings.dockSort,
)
</script>

<template>
  <header class="navbar">
    <div class="navbar__spacer" />

    <div class="navbar__actions">
      <button
        type="button"
        class="search-trigger"
        :class="{ 'is-active': hasQuery || searchOpen }"
        title="搜索"
        aria-label="搜索"
        @click="searchOpen = true"
      >
        <el-icon :size="16"><Search /></el-icon>
      </button>

      <template v-if="hasActions">
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
      </template>
    </div>

    <SearchDialog v-model="searchOpen" />
  </header>
</template>

<style scoped lang="scss">
.navbar {
  height: 100%;
  min-height: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px;
  background: transparent;
  box-sizing: border-box;
}

.navbar__spacer {
  flex: 1;
  min-width: 0;
}

.navbar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: auto;
}

.search-trigger {
  width: 36px;
  height: 36px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 11px;
  display: grid;
  place-items: center;
  background: var(--nn-tab-bg);
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition:
    color var(--nn-transition-fast),
    background var(--nn-transition-fast),
    box-shadow var(--nn-transition-fast);

  &:hover {
    color: var(--nn-primary);
    background: var(--nn-item-hover-bg);
  }

  &.is-active {
    color: var(--nn-primary);
    background: color-mix(in srgb, var(--nn-primary) 12%, var(--nn-tab-bg));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--nn-primary) 28%, transparent);
  }
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

@media (max-width: 900px) {
  .navbar {
    padding: 0 10px;
    gap: 8px;
  }

  .navbar__actions {
    gap: 6px;
  }

  .search-trigger {
    width: 32px;
    height: 32px;
    border-radius: var(--nn-item-radius);
  }

  .cta-add {
    width: 32px;
    padding: 0;
  }

  .cta-add__label,
  .sort-toggle__label {
    display: none;
  }

  .sort-toggle {
    width: 32px;
    padding: 0;
  }
}
</style>
