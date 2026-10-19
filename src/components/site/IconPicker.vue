<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { Close } from '@element-plus/icons-vue'
import { CATEGORY_ICON_OPTIONS, isIconifyName } from '@/constants/category-icons'

const model = defineModel<string>({ default: '' })

const dialogOpen = ref(false)
const keyword = ref('')

const filtered = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return CATEGORY_ICON_OPTIONS
  return CATEGORY_ICON_OPTIONS.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q),
  )
})

const selectedLabel = computed(() => {
  if (!model.value) return '点击选择图标'
  const hit = CATEGORY_ICON_OPTIONS.find((i) => i.name === model.value)
  return hit?.label ?? model.value
})

watch(dialogOpen, (open) => {
  if (open) keyword.value = ''
})

function openDialog() {
  dialogOpen.value = true
}

function select(name: string) {
  model.value = name
  dialogOpen.value = false
}

function clear() {
  model.value = ''
}
</script>

<template>
  <div class="icon-picker">
    <div class="icon-picker__trigger-row">
      <button
        type="button"
        class="icon-picker__trigger"
        title="选择图标"
        @click="openDialog"
      >
        <span class="preview-box">
          <Icon
            v-if="isIconifyName(model)"
            :icon="model"
            width="26"
            height="26"
          />
          <span v-else-if="model" class="preview-emoji">{{ model }}</span>
          <span v-else class="preview-empty">图标</span>
        </span>
        <span class="preview-meta">
          <span class="preview-name">{{ selectedLabel }}</span>
          <span class="preview-hint">点击打开图标列表</span>
        </span>
      </button>
      <el-button v-if="model" link type="primary" @click="clear">清除</el-button>
    </div>

    <el-dialog
      v-model="dialogOpen"
      width="560px"
      align-center
      append-to-body
      destroy-on-close
      class="nn-dialog"
      :show-close="false"
    >
      <template #header>
        <div class="nn-dlg-head">
          <div>
            <h2 class="nn-dlg-head__title">选择图标</h2>
            <p class="nn-dlg-head__hint">从列表中挑选分类图标</p>
          </div>
          <button
            type="button"
            class="nn-dlg-head__close"
            aria-label="关闭"
            @click="dialogOpen = false"
          >
            <el-icon :size="16"><Close /></el-icon>
          </button>
        </div>
      </template>

      <div class="nn-dlg-body icon-picker-dlg">
        <div class="nn-field">
          <input
            v-model="keyword"
            class="nn-field__input"
            type="search"
            placeholder="搜索图标名称，例如 开发、云盘、AI"
            autocomplete="off"
          />
        </div>

        <div class="icon-picker__grid nn-scroll">
          <button
            v-for="item in filtered"
            :key="item.name"
            type="button"
            class="icon-option"
            :class="{ active: model === item.name }"
            :title="`${item.label} (${item.name})`"
            @click="select(item.name)"
          >
            <Icon :icon="item.name" width="22" height="22" />
            <span>{{ item.label }}</span>
          </button>
          <el-empty
            v-if="!filtered.length"
            description="没有匹配的图标"
            :image-size="56"
          />
        </div>
      </div>

      <template #footer>
        <div class="nn-dlg-foot">
          <button type="button" class="nn-btn nn-btn--ghost" @click="dialogOpen = false">
            取消
          </button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.icon-picker {
  width: 100%;
}

.icon-picker__trigger-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-picker__trigger {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  padding: 8px 10px;
  border: 0;
  border-radius: var(--nn-item-radius, 8px);
  background: var(--nn-tab-bg, #eef0f3);
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: background var(--nn-transition-fast);

  &:hover {
    background: var(--nn-item-hover-bg);
  }
}

.preview-box {
  width: 44px;
  height: 44px;
  border-radius: var(--nn-item-radius, 8px);
  background: var(--nn-section-bg);
  box-shadow: var(--nn-card-inset);
  display: grid;
  place-items: center;
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.preview-emoji {
  font-size: 22px;
  line-height: 1;
}

.preview-empty {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.preview-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preview-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.icon-picker-dlg {
  gap: 12px;
}

.icon-picker__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 8px;
  max-height: min(420px, 55vh);
  overflow: auto;
  padding: 2px;
}

.icon-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 6px;
  margin: 0;
  border: 0;
  border-radius: var(--nn-item-radius);
  background: transparent;
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition:
    color var(--nn-transition-fast),
    background var(--nn-transition-fast);

  span {
    font-size: 12px;
    line-height: 1.2;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &:hover {
    color: var(--el-color-primary);
    background: var(--nn-item-hover-bg);
  }

  &.active {
    color: var(--el-color-primary);
    background: var(--nn-item-active-bg);
    font-weight: 600;
  }
}
</style>
