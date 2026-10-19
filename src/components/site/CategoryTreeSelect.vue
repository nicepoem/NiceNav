<script setup lang="ts">
import { computed, watch } from 'vue'
import type { CategoryTreeNode } from '@nice-nav/core'
import NavIcon from '@/components/common/NavIcon.vue'

const props = defineProps<{
  modelValue: string
  tree: CategoryTreeNode[]
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

/** 有子分类的一级不可选，落到其第一个子分类 */
function resolveSelectableId(id: string | undefined | null): string {
  if (!id || id.startsWith('__group__')) return ''
  for (const root of props.tree) {
    if (root.id === id) {
      return root.children.length ? root.children[0]!.id : root.id
    }
    if (root.children.some((c) => c.id === id)) return id
  }
  return id
}

const value = computed({
  get: () => resolveSelectableId(props.modelValue),
  set: (v) => emit('update:modelValue', resolveSelectableId(v)),
})

watch(
  () => [props.modelValue, props.tree] as const,
  () => {
    const next = resolveSelectableId(props.modelValue)
    if (next && next !== props.modelValue) emit('update:modelValue', next)
  },
  { immediate: true },
)

/** 选中后输入框显示「父 / 子」或一级名 */
const flatLabels = computed(() => {
  const map = new Map<string, string>()
  for (const root of props.tree) {
    if (!root.children.length) {
      map.set(root.id, root.name)
      continue
    }
    for (const child of root.children) {
      map.set(child.id, `${root.name} / ${child.name}`)
    }
  }
  return map
})

function selectedLabel(id: string) {
  return flatLabels.value.get(id) ?? id
}

function groupValue(id: string) {
  return `__group__${id}`
}
</script>

<template>
  <el-select
    v-model="value"
    :placeholder="placeholder || '选择分类'"
    teleported
    filterable
    popper-class="nn-select-popper nn-category-tree-popper"
  >
    <template v-for="root in tree" :key="root.id">
      <!-- 有子分类：一级仅展示层级，不可选 -->
      <template v-if="root.children.length">
        <el-option
          :label="root.name"
          :value="groupValue(root.id)"
          disabled
          class="nn-cat-option nn-cat-option--parent"
        >
          <span class="option-row">
            <NavIcon :icon="root.icon" :size="16" />
            <span class="option-row__name">{{ root.name }}</span>
          </span>
        </el-option>
        <el-option
          v-for="(child, index) in root.children"
          :key="child.id"
          :label="selectedLabel(child.id)"
          :value="child.id"
          class="nn-cat-option nn-cat-option--child"
          :class="{ 'is-last-child': index === root.children.length - 1 }"
        >
          <span class="option-row is-child">
            <span class="option-row__rail" aria-hidden="true" />
            <NavIcon :icon="child.icon" :size="16" />
            <span class="option-row__name">{{ child.name }}</span>
          </span>
        </el-option>
      </template>

      <!-- 无子分类：可选一级 -->
      <el-option v-else :label="root.name" :value="root.id" class="nn-cat-option">
        <span class="option-row">
          <NavIcon :icon="root.icon" :size="16" />
          <span class="option-row__name">{{ root.name }}</span>
        </span>
      </el-option>
    </template>
  </el-select>
</template>

<style scoped lang="scss">
.option-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.option-row.is-child {
  gap: 10px;
}

/* 左侧树形导轨：竖线 + 横折，拉开父子层级 */
.option-row__rail {
  position: relative;
  flex-shrink: 0;
  width: 18px;
  align-self: stretch;
  min-height: 20px;

  &::before {
    content: '';
    position: absolute;
    left: 7px;
    top: -12px;
    bottom: -12px;
    width: 0;
    border-left: 1.5px solid var(--el-border-color-darker, var(--el-border-color));
  }

  &::after {
    content: '';
    position: absolute;
    left: 7px;
    top: 50%;
    width: 11px;
    height: 0;
    border-top: 1.5px solid var(--el-border-color-darker, var(--el-border-color));
  }
}

.option-row__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
