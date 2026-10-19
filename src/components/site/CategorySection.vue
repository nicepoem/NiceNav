<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Edit, Delete, MoreFilled } from '@element-plus/icons-vue'
import type { Category, CategoryTreeNode, Site } from '@nice-nav/core'
import { useNavStore } from '@/stores/nav'
import { collectSortIds, useSortable } from '@/composables/useSortable'
import NavIcon from '@/components/common/NavIcon.vue'
import SiteCard from './SiteCard.vue'

const props = defineProps<{
  node: CategoryTreeNode
}>()

const emit = defineEmits<{
  editSite: [site: Site]
  removeSite: [site: Site]
  editCategory: [category: Category]
  removeCategory: [category: Category]
}>()

const nav = useNavStore()

const children = computed(() => props.node.children)
const hasChildren = computed(() => children.value.length > 0)
const canReorder = computed(() => nav.editMode && !nav.searchQuery.trim())

const activeTabId = ref('')
const cardsEl = ref<HTMLElement | null>(null)
const tabsEl = ref<HTMLElement | null>(null)

function pickDefaultTab() {
  if (!hasChildren.value) {
    activeTabId.value = props.node.id
    return
  }
  const active = nav.activeCategoryId
  if (active && children.value.some((c) => c.id === active)) {
    activeTabId.value = active
    return
  }
  if (active === props.node.id) {
    activeTabId.value = children.value[0]?.id ?? props.node.id
    return
  }
  if (!activeTabId.value || !children.value.some((c) => c.id === activeTabId.value)) {
    activeTabId.value = children.value[0]?.id ?? props.node.id
  }
}

watch(
  () => [props.node.id, children.value.map((c) => c.id).join(','), nav.activeCategoryId] as const,
  () => pickDefaultTab(),
  { immediate: true },
)

const activeCategory = computed(() => {
  if (!hasChildren.value) return props.node
  return children.value.find((c) => c.id === activeTabId.value) ?? children.value[0] ?? props.node
})

const displaySites = computed(() => {
  const id = activeCategory.value?.id
  if (!id) return []
  return nav.sitesByCategory.get(id) ?? []
})

function scrollActiveTabIntoView(behavior: ScrollBehavior = 'smooth') {
  const root = tabsEl.value
  if (!root || !activeTabId.value) return
  const tab = root.querySelector<HTMLElement>(`.cat-tab[data-id="${activeTabId.value}"]`)
  if (!tab) return

  const rootRect = root.getBoundingClientRect()
  const tabRect = tab.getBoundingClientRect()
  const pad = 12
  const overflowLeft = tabRect.left < rootRect.left + pad
  const overflowRight = tabRect.right > rootRect.right - pad
  if (!overflowLeft && !overflowRight) return

  const target =
    tab.offsetLeft - (root.clientWidth - tab.offsetWidth) / 2
  root.scrollTo({
    left: Math.max(0, target),
    behavior,
  })
}

watch(activeTabId, () => {
  void nextTick(() => scrollActiveTabIntoView('smooth'))
})

function selectTab(id: string) {
  activeTabId.value = id
  nav.activeCategoryId = id
  void nextTick(() => scrollActiveTabIntoView('smooth'))
}

function onManageCommand(cmd: string) {
  if (cmd === 'edit') emit('editCategory', activeCategory.value)
  if (cmd === 'edit-parent') emit('editCategory', props.node)
  if (cmd === 'remove') emit('removeCategory', activeCategory.value)
}

useSortable(
  cardsEl,
  () => {
    if (!canReorder.value || !displaySites.value.length) return null
    const categoryId = activeCategory.value?.id
    if (!categoryId) return null
    return {
      draggable: '.url-card',
      filter: '.url-card__actions, .url-card__actions *',
      preventOnFilter: true,
      onEnd: (evt) => {
        const el = evt.to
        if (!el) return
        const ids = collectSortIds(el)
        if (ids.length) void nav.reorderSites(categoryId, ids)
      },
    }
  },
  [canReorder, activeTabId, () => displaySites.value.map((s) => s.id).join(',')],
)

useSortable(
  tabsEl,
  () => {
    if (!canReorder.value || !hasChildren.value) return null
    return {
      draggable: '.cat-tab',
      direction: 'horizontal',
      onEnd: (evt) => {
        const el = evt.to
        if (!el) return
        const ids = collectSortIds(el)
        if (ids.length) void nav.reorderCategories(props.node.id, ids)
      },
    }
  },
  [canReorder, hasChildren, () => children.value.map((c) => c.id).join(',')],
)
</script>

<template>
  <section :id="`category-${node.id}`" class="cat-block">
    <div class="cat-toolbar">
      <div class="cat-block__heading">
        <NavIcon :icon="node.icon" :size="20" />
        <span class="cat-block__name">{{ node.name }}</span>

        <el-dropdown
          v-if="nav.editMode"
          trigger="click"
          @command="onManageCommand"
        >
          <button
            type="button"
            class="cat-action"
            title="管理分类"
            aria-label="管理分类"
          >
            <el-icon :size="15"><MoreFilled /></el-icon>
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="edit" :icon="Edit">编辑当前分类</el-dropdown-item>
              <el-dropdown-item v-if="hasChildren" command="edit-parent" :icon="Edit">
                编辑父分类
              </el-dropdown-item>
              <el-dropdown-item command="remove" :icon="Delete" divided>
                删除当前分类
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <div
        v-if="hasChildren"
        ref="tabsEl"
        class="cat-tabs"
        :class="{ 'is-sortable': canReorder }"
      >
        <button
          v-for="child in children"
          :id="`category-${child.id}`"
          :key="child.id"
          type="button"
          class="cat-tab"
          :data-id="child.id"
          :class="{ active: activeTabId === child.id }"
          @click="selectTab(child.id)"
        >
          {{ child.name }}
        </button>
      </div>
    </div>

    <div
      v-if="displaySites.length"
      ref="cardsEl"
      class="cat-cards"
      :class="{ 'is-sortable': canReorder }"
    >
      <SiteCard
        v-for="site in displaySites"
        :key="site.id"
        :site="site"
        :sortable="canReorder"
        @open="nav.openSite"
        @edit="emit('editSite', $event)"
        @remove="emit('removeSite', $event)"
      />
    </div>
    <el-empty
      v-else
      description="该分类暂无网址"
      :image-size="64"
    />
  </section>
</template>

<style scoped lang="scss">
.cat-block {
  scroll-margin-top: calc(
    var(--nn-sidebar-gap) + var(--nn-header-height) + var(--nn-sidebar-gap)
  );
  background: var(--nn-section-bg);
  border-radius: var(--nn-sidebar-radius, 16px);
  padding: 8px 10px 10px;
}

.cat-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.cat-block__heading {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  font-size: 16px;
  font-weight: 650;
  line-height: 1.2;
  color: var(--el-text-color-primary);
}

.cat-block__name {
  margin-right: 2px;
}

.cat-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: var(--nn-item-radius);
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition:
    color var(--nn-transition-fast),
    background var(--nn-transition-fast);

  &:hover,
  &:focus-visible {
    color: var(--nn-primary);
    background: var(--nn-item-hover-bg, var(--nn-tab-bg));
  }
}

.cat-tabs {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  padding: 3px;
  border-radius: 7px;
  background: var(--nn-tab-bg, #eef0f3);
  box-sizing: border-box;
}

.cat-tabs.is-sortable .cat-tab {
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
}

.cat-tab {
  border: 0;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.2;
  padding: 6px 12px;
  margin: 0;
  border-radius: 5px;
  cursor: pointer;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition:
    background var(--nn-transition-fast),
    color var(--nn-transition-fast);

  &:hover:not(.active) {
    background: var(--nn-section-bg, #fff);
    color: var(--el-text-color-secondary);
  }

  &.active {
    background: var(--nn-primary);
    color: #fff;
    font-weight: 600;
  }
}

.cat-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}

@media (max-width: 900px) {
  .cat-block {
    padding: 8px;
    border-radius: 12px;
  }

  .cat-toolbar {
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
  }

  .cat-tabs {
    order: 3;
    flex: 1 1 100%;
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-x: contain;
    touch-action: pan-x;
    scroll-snap-type: x proximity;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
      width: 0;
      height: 0;
    }
  }

  .cat-tab {
    flex-shrink: 0;
    scroll-snap-align: center;
    /* 扩大可点区域，避免贴边时点不到 */
    position: relative;

    &::after {
      content: '';
      position: absolute;
      inset: -4px -2px;
    }
  }

  .cat-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
}
</style>
