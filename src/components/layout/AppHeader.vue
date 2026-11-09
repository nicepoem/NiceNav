<script setup lang="ts">
import { computed } from 'vue'
import {
  Plus,
  Rank,
  Check,
  FolderOpened,
} from '@element-plus/icons-vue'
import { useNavStore } from '@/stores/nav'

const emit = defineEmits<{
  addSite: []
  manageCategories: []
}>()

const nav = useNavStore()

/** 右侧浮动工具栏开启时，顶栏隐藏对应重复按钮 */
const dockOn = computed(() => nav.settings.dockEnabled !== false)

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

    <div v-if="hasActions" class="navbar__actions">
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
    </div>
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

.cta-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 32px;
  padding: 0 14px;
  border: 0;
  border-radius: var(--nn-item-radius);
  background: var(--nn-primary-grad);
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
    background: var(--nn-primary-grad);
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
