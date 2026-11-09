<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CategoryTreeNode, Site } from '@nice-nav/core'
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
}>()

const nav = useNavStore()

const children = computed(() => props.node.children)
const hasChildren = computed(() => children.value.length > 0)
const canReorder = computed(() => nav.editMode && !nav.searchQuery.trim())

/** 有子分类时只展示子分类 tab（一级有子级时网址只能挂在子级） */
const tabs = computed(() =>
  children.value.map((child) => ({
    id: child.id,
    name: child.name,
  })),
)

const tabIds = computed(() => new Set(tabs.value.map((t) => t.id)))

const activeTabId = ref('')
const cardsEl = ref<HTMLElement | null>(null)
const tabsEl = ref<HTMLElement | null>(null)
const pillStyle = ref({
  width: '0px',
  height: '0px',
  transform: 'translate3d(0,0,0)',
  opacity: '0',
})
let pillRaf = 0
let pillRo: ResizeObserver | null = null

function updateTabPill() {
  const root = tabsEl.value
  if (!root || !activeTabId.value) {
    pillStyle.value = {
      width: '0px',
      height: '0px',
      transform: 'translate3d(0,0,0)',
      opacity: '0',
    }
    return
  }
  const tab = root.querySelector<HTMLElement>(`.cat-tab[data-id="${CSS.escape(activeTabId.value)}"]`)
  if (!tab) {
    pillStyle.value = { ...pillStyle.value, opacity: '0' }
    return
  }
  pillStyle.value = {
    width: `${tab.offsetWidth}px`,
    height: `${tab.offsetHeight}px`,
    transform: `translate3d(${tab.offsetLeft}px, ${tab.offsetTop}px, 0)`,
    opacity: '1',
  }
}

function schedulePillUpdate() {
  if (pillRaf) cancelAnimationFrame(pillRaf)
  pillRaf = requestAnimationFrame(() => {
    pillRaf = 0
    updateTabPill()
  })
}

function ensureValidTab() {
  if (!hasChildren.value) {
    activeTabId.value = props.node.id
    return
  }
  if (!activeTabId.value || !tabIds.value.has(activeTabId.value)) {
    activeTabId.value = children.value[0]?.id ?? props.node.id
  }
}

watch(
  () => [props.node.id, children.value.map((c) => c.id).join(',')] as const,
  () => ensureValidTab(),
  { immediate: true },
)

/**
 * 侧栏点到子分类时同步 tab。
 * 点到父级或滚动定位到父级时，落到第一个子分类。
 */
watch(
  () => nav.activeCategoryId,
  (active, prev) => {
    if (!hasChildren.value || !active) return
    // 与本块无关的滚动定位不处理，减少全列表 watcher 开销
    const related =
      active === props.node.id || children.value.some((c) => c.id === active)
    if (!related) return
    if (children.value.some((c) => c.id === active)) {
      activeTabId.value = active
      return
    }
    if (active === props.node.id) {
      const prevIsChild = Boolean(prev && children.value.some((c) => c.id === prev))
      if (!prevIsChild) {
        activeTabId.value = children.value[0]?.id ?? props.node.id
      }
    }
  },
)

const activeCategory = computed(() => {
  if (!hasChildren.value) return props.node
  return children.value.find((c) => c.id === activeTabId.value) ?? children.value[0] ?? props.node
})

const displaySites = computed(() => {
  const id = hasChildren.value ? activeTabId.value : props.node.id
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

  const target = tab.offsetLeft - (root.clientWidth - tab.offsetWidth) / 2
  root.scrollTo({
    left: Math.max(0, target),
    behavior,
  })
}

watch(activeTabId, () => {
  void nextTick(() => {
    schedulePillUpdate()
    scrollActiveTabIntoView('smooth')
  })
})

watch(
  () => tabs.value.map((t) => t.id).join(','),
  () => void nextTick(schedulePillUpdate),
)

function selectTab(id: string) {
  activeTabId.value = id
  nav.activeCategoryId = id
}

function onTabsScroll() {
  schedulePillUpdate()
}

onMounted(() => {
  void nextTick(schedulePillUpdate)
  if (typeof ResizeObserver !== 'undefined') {
    pillRo = new ResizeObserver(() => schedulePillUpdate())
    if (tabsEl.value) pillRo.observe(tabsEl.value)
  }
})

watch(tabsEl, (el, prev) => {
  if (prev && pillRo) pillRo.unobserve(prev)
  if (el && pillRo) pillRo.observe(el)
  schedulePillUpdate()
})

onBeforeUnmount(() => {
  if (pillRaf) cancelAnimationFrame(pillRaf)
  pillRo?.disconnect()
  pillRo = null
})

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
      </div>

      <div
        v-if="hasChildren"
        ref="tabsEl"
        class="cat-tabs"
        :class="{ 'is-sortable': canReorder }"
        @scroll.passive="onTabsScroll"
      >
        <span class="cat-tabs__pill" :style="pillStyle" aria-hidden="true" />
        <button
          v-for="tab in tabs"
          :id="`category-${tab.id}`"
          :key="tab.id"
          type="button"
          class="cat-tab"
          :class="{ active: activeTabId === tab.id }"
          :data-id="tab.id"
          @click="selectTab(tab.id)"
        >
          {{ tab.name }}
        </button>
      </div>
    </div>

    <Transition name="cat-pane" mode="out-in">
      <div
        v-if="displaySites.length"
        :key="activeCategory?.id || 'empty'"
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
        :key="`empty-${activeCategory?.id || 'none'}`"
        description="该分类暂无网址"
        :image-size="64"
      />
    </Transition>
  </section>
</template>

<style scoped lang="scss">
.cat-block {
  scroll-margin-top: calc(
    var(--nn-sidebar-gap) + var(--nn-header-height) + var(--nn-glass-band, 148px)
  );
  background: var(--nn-cat-block-bg, #ffffff70);
  border-radius: var(--nn-sidebar-radius, 16px);
  border: var(--nn-cat-block-border, 1px solid transparent);
  box-shadow: var(--nn-cat-block-shadow, 0 14px 40px -22px rgba(31, 41, 55, 0.28));
  padding: 12px 16px 14px;
  /* 骨架 → 内容切换时分类块渐入，按 index 逐块错峰（延迟由 SiteGrid 注入） */
  animation: cat-block-enter 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--cat-enter-delay, 0ms);
}

@keyframes cat-block-enter {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cat-block {
    animation: none;
  }
}

.cat-toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 12px;
}

.cat-block__heading {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  font-size: 17px;
  font-weight: 650;
  line-height: 1.2;
  color: var(--nn-sidebar-text, var(--el-text-color-regular));
}

.cat-block__name {
  margin-right: 2px;
}

.cat-tabs {
  position: relative;
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  padding: 4px;
  border-radius: 8px;
  background: var(--nn-tab-bg, #f3f4f6);
  box-sizing: border-box;
}

.cat-tabs__pill {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 0;
  border-radius: 6px;
  background: var(--nn-primary);
  pointer-events: none;
  will-change: transform, width, height;
  transition:
    transform 0.34s cubic-bezier(0.22, 1, 0.36, 1),
    width 0.34s cubic-bezier(0.22, 1, 0.36, 1),
    height 0.34s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.2s ease;
}

.cat-tabs.is-sortable .cat-tab {
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
}

.cat-tab {
  position: relative;
  z-index: 1;
  border: 0;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  line-height: 1.3;
  padding: 7px 14px;
  margin: 0;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition:
    color 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    background-color 0.28s cubic-bezier(0.22, 1, 0.36, 1);

  &:hover:not(.active) {
    color: var(--el-text-color-primary);
    background: var(--nn-tab-item-hover-bg, #fff);
  }

  &.active {
    color: #fff;
    font-weight: 600;
  }
}

.cat-pane-enter-active,
.cat-pane-leave-active {
  transition:
    opacity 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.cat-pane-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.cat-pane-leave-to {
  opacity: 0;
  transform: translateY(-4px);
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
    position: relative;

    &::after {
      content: '';
      position: absolute;
      inset: -4px -2px;
    }
  }

  .cat-cards {
    /* 临界宽度（约 858–900）约 3～4 列，不再锁死两列 */
    grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
    gap: 8px;
  }
}

@media (max-width: 520px) {
  .cat-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
