<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import { Fold, Expand } from '@element-plus/icons-vue'
import Sortable from 'sortablejs'
import { useNavStore } from '@/stores/nav'
import { collectSortIds } from '@/composables/useSortable'
import NavIcon from '@/components/common/NavIcon.vue'

const props = defineProps<{
  mobileOpen?: boolean
}>()

const emit = defineEmits<{
  openMobile: []
  closeMobile: []
}>()

const nav = useNavStore()
const menuRef = ref<{ $el?: HTMLElement } | null>(null)

const collapsed = computed(() => nav.settings.sidebarCollapsed)
const activeMenu = computed(() => nav.activeCategoryId ?? '')
const isWide = computed(() => !collapsed.value || Boolean(props.mobileOpen))
const canSort = computed(() => isWide.value && nav.editMode)
const collapseTip = computed(() => {
  if (props.mobileOpen) return '收起'
  return collapsed.value ? '展开' : '收起'
})

/**
 * 抽屉顶边对齐右侧第一个分类块（如「常用推荐」）：
 * 内容在下方时侧栏跟着沉到同一高度；上滚贴顶后再向上展开。
 */
const drawerTopPx = ref(0)
const drawerReady = ref(false)
/** 首帧定位后再开过渡，滚动跟随时才平滑 */
const drawerSmooth = ref(false)
let drawerRaf = 0

function readGapPx() {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--nn-sidebar-gap')
    .trim()
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : 20
}

function resolveAlignSection(): Element | null {
  const firstId = nav.categoryTree[0]?.id
  if (firstId) {
    const el = document.getElementById(`category-${firstId}`)
    if (el) return el
  }
  return document.querySelector('[id^="category-"].cat-block, .cat-block[id^="category-"], .cat-block')
}

function updateDrawerTop() {
  if (typeof window === 'undefined' || window.innerWidth <= 900) {
    drawerReady.value = false
    return
  }

  const gap = readGapPx()
  const chrome = document.querySelector('.layout-chrome-wrap')
  const chromeBottom = chrome?.getBoundingClientRect().bottom ?? gap
  const minTop = chromeBottom + gap

  const section = resolveAlignSection()
  let top = minTop
  if (section) {
    // 分类块还在下方 → 侧栏顶对齐分类块；滚过贴顶线后固定在 minTop
    top = Math.max(minTop, section.getBoundingClientRect().top)
  }

  // 阈值略放大，减少抖动；具体位移交给 CSS transition 平滑插值
  if (!drawerReady.value || Math.abs(drawerTopPx.value - top) > 1.5) {
    drawerTopPx.value = top
    if (!drawerReady.value) {
      drawerReady.value = true
      requestAnimationFrame(() => {
        drawerSmooth.value = true
      })
    }
  }
}

function scheduleDrawerTop() {
  if (drawerRaf) cancelAnimationFrame(drawerRaf)
  drawerRaf = requestAnimationFrame(() => {
    drawerRaf = 0
    updateDrawerTop()
  })
}

/** 折叠/展开共用同一套 top+bottom，只过渡宽度，避免垂直跳动 */
const drawerCardStyle = computed(() => {
  if (!drawerReady.value) return undefined
  return {
    top: `${drawerTopPx.value}px`,
    bottom: 'var(--nn-sidebar-gap)',
  }
})

let rootSortable: Sortable | null = null
const childSortables: Sortable[] = []

function destroySortables() {
  rootSortable?.destroy()
  rootSortable = null
  while (childSortables.length) {
    childSortables.pop()?.destroy()
  }
}

function bindSortable(
  el: HTMLElement,
  parentId: string | null,
) {
  return Sortable.create(el, {
    animation: 160,
    draggable: '.nn-sortable-cat',
    filter: '.nn-no-sort',
    ghostClass: 'nn-sortable-ghost',
    chosenClass: 'nn-sortable-chosen',
    dragClass: 'nn-sortable-drag',
    onMove: (evt) => !evt.related?.classList.contains('nn-no-sort'),
    onEnd: () => {
      const ids = collectSortIds(el, 'data-cat-id')
      if (ids.length) void nav.reorderCategories(parentId, ids)
    },
  })
}

async function setupSortables() {
  destroySortables()
  await nextTick()
  if (!canSort.value) return
  const root = menuRef.value?.$el
  if (!(root instanceof HTMLElement)) return

  rootSortable = bindSortable(root, null)

  root.querySelectorAll<HTMLElement>('.el-sub-menu').forEach((sub) => {
    const parentId = sub.getAttribute('data-cat-id')
    const childMenu = sub.querySelector<HTMLElement>(':scope > .el-menu')
    if (!parentId || !childMenu) return
    childSortables.push(bindSortable(childMenu, parentId))
  })
}

watch(
  isWide,
  (wide) => {
    document.documentElement.classList.toggle('nn-sidebar-wide', wide)
    document.documentElement.classList.toggle('nn-sidebar-narrow', !wide)
  },
  { immediate: true },
)

watch(
  [
    canSort,
    () =>
      nav.categoryTree
        .map((n) => `${n.id}:${n.children.map((c) => c.id).join(',')}`)
        .join('|'),
  ],
  () => {
    void setupSortables()
  },
  { flush: 'post', immediate: true },
)

onMounted(() => {
  updateDrawerTop()
  window.addEventListener('scroll', scheduleDrawerTop, { passive: true })
  window.addEventListener('resize', scheduleDrawerTop, { passive: true })
})

onBeforeUnmount(() => {
  destroySortables()
  window.removeEventListener('scroll', scheduleDrawerTop)
  window.removeEventListener('resize', scheduleDrawerTop)
  if (drawerRaf) cancelAnimationFrame(drawerRaf)
})

watch(
  () =>
    [
      props.mobileOpen,
      nav.ready,
      nav.categoryTree.map((n) => n.id).join(','),
    ] as const,
  async () => {
    await nextTick()
    scheduleDrawerTop()
  },
)

function jumpToCategory(id: string) {
  nav.activeCategoryId = id
  const block =
    document.querySelector<HTMLElement>(`.cat-block[id="category-${CSS.escape(id)}"]`) ??
    document.getElementById(`category-${id}`)
  block?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
  emit('closeMobile')
}

function onSelect(index: string) {
  jumpToCategory(index)
}

/** 有子分类时，点击父级标题直接滚到该分类区块，不必先点子分类 */
function onParentClick(id: string, event: MouseEvent) {
  const target = event.target
  if (target instanceof Element && target.closest('.el-menu-item')) return
  jumpToCategory(id)
}

async function toggleCollapse() {
  // 手机端展开抽屉时，「收起」关闭抽屉，与桌面折叠侧栏区分
  if (props.mobileOpen) {
    emit('closeMobile')
    return
  }
  await nav.updateSettings({ sidebarCollapsed: !nav.settings.sidebarCollapsed })
}
</script>

<template>
  <!-- 手机端默认：折叠成浮动展开按钮 -->
  <button
    v-show="!props.mobileOpen"
    type="button"
    class="sidebar-fab"
    aria-label="打开分类菜单"
    @click="emit('openMobile')"
  >
    <svg
      class="sidebar-fab__icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
    >
      <rect x="4" y="5.5" width="16" height="2.4" rx="1.2" fill="currentColor" />
      <rect x="4" y="11.3" width="7.5" height="2.4" rx="1.2" fill="currentColor" />
      <path
        d="M14.2 10.6 L20 12.5 L14.2 14.4 Z"
        fill="currentColor"
      />
      <rect x="4" y="16.1" width="7.5" height="2.4" rx="1.2" fill="currentColor" />
    </svg>
  </button>

  <aside
    class="sidebar-rail"
    :class="{
      'is-collapsed': collapsed,
      'is-mobile-open': props.mobileOpen,
    }"
  >
    <div
      class="sidebar-card"
      :class="{ 'is-smooth': drawerSmooth }"
      :style="drawerCardStyle"
    >
      <div class="sidebar-card__body nn-scroll">
        <el-menu
          ref="menuRef"
          :default-active="activeMenu"
          :collapse="true"
          :collapse-transition="false"
          popper-class="nn-sidebar-popup"
          popper-effect="dark"
          :popper-offset="12"
          background-color="transparent"
          text-color="var(--nn-sidebar-text)"
          active-text-color="var(--nn-primary)"
          class="sidebar-menu"
          :class="{ 'is-wide': isWide, 'is-sortable': canSort }"
          @select="onSelect"
        >
          <template v-for="node in nav.categoryTree" :key="node.id">
            <el-sub-menu
              v-if="node.children.length"
              :index="node.id"
              class="nn-sortable-cat"
              :data-cat-id="node.id"
              @click="onParentClick(node.id, $event)"
            >
              <template #title>
                <el-icon class="menu-icon" :size="18">
                  <NavIcon :icon="node.icon" :size="18" />
                </el-icon>
                <span class="menu-label">{{ node.name }}</span>
              </template>
              <el-menu-item
                v-for="child in node.children"
                :key="child.id"
                :index="child.id"
                class="nn-sortable-cat"
                :data-cat-id="child.id"
              >
                <el-icon class="menu-icon" :size="16">
                  <NavIcon :icon="child.icon" :size="16" />
                </el-icon>
                <template #title>
                  <span>{{ child.name }}</span>
                </template>
              </el-menu-item>
            </el-sub-menu>

            <el-menu-item
              v-else
              :index="node.id"
              class="nn-sortable-cat"
              :data-cat-id="node.id"
            >
              <el-icon class="menu-icon" :size="18">
                <NavIcon :icon="node.icon" :size="18" />
              </el-icon>
              <span class="menu-label">{{ node.name }}</span>
              <template #title>{{ node.name }}</template>
            </el-menu-item>
          </template>

        </el-menu>
      </div>

      <div
        class="sidebar-footer"
        :class="{ 'desktop-only': !props.mobileOpen }"
      >
        <el-tooltip
          :content="collapseTip"
          :placement="collapsed && !props.mobileOpen ? 'right' : 'top'"
          :show-after="400"
        >
          <button
            type="button"
            class="sidebar-collapse-btn"
            :class="{ 'is-collapsed': collapsed && !props.mobileOpen }"
            :aria-label="collapseTip"
            @click="toggleCollapse"
          >
            <el-icon class="menu-icon" :size="18">
              <Expand v-if="collapsed && !props.mobileOpen" />
              <Fold v-else />
            </el-icon>
            <span class="menu-label">
              {{ collapsed && !props.mobileOpen ? '展开' : '收起' }}
            </span>
          </button>
        </el-tooltip>
      </div>
    </div>
  </aside>

  <div
    v-if="props.mobileOpen"
    class="sidebar-backdrop"
    @click="emit('closeMobile')"
  />
</template>

<style scoped lang="scss">
/*
 * 抽屉侧栏：外轨只占位；卡片始终 fixed 浮在视口上，
 * 宽度用抽屉缓动伸缩，滚到底也不会被淹没。
 */
.sidebar-rail {
  --nn-sidebar-panel-height: calc(
    100dvh - var(--nn-sidebar-sticky-top, var(--nn-sidebar-gap)) - var(--nn-sidebar-gap)
  );
  /* 图标槽宽：折叠内宽，展开时图标仍落在同一水平位置 */
  --nn-icon-slot: calc(var(--nn-sidebar-collapsed) - var(--nn-sidebar-pad) * 2);
  --nn-drawer-card-width: var(--nn-sidebar-width);
  width: var(--nn-sidebar-rail);
  flex-shrink: 0;
  align-self: stretch;
  padding: 0;
  box-sizing: border-box;
  position: relative;
  transition: width 0.32s var(--nn-drawer-ease);

  &.is-collapsed {
    --nn-drawer-card-width: var(--nn-sidebar-collapsed);
    width: var(--nn-sidebar-rail-collapsed);
  }
}

.sidebar-card {
  position: fixed;
  /* 顶对齐分类块 / 贴顶线；底始终钉视口 gap —— 折叠展开同一水平框 */
  top: var(--nn-sidebar-sticky-top, var(--nn-sidebar-gap));
  left: var(--nn-sidebar-gap);
  bottom: var(--nn-sidebar-gap);
  width: var(--nn-drawer-card-width, var(--nn-sidebar-width));
  height: auto;
  max-height: none;
  z-index: 90;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  isolation: isolate;
  background-color: var(--nn-section-bg, var(--nn-sidebar-bg));
  border: none;
  border-radius: var(--nn-sidebar-radius, 12px);
  -webkit-border-radius: var(--nn-sidebar-radius, 12px);
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-sizing: border-box;
  color: var(--nn-sidebar-text);
  /* 宽度从右侧收起，左对齐图标槽不动 */
  transition: width 0.32s var(--nn-drawer-ease);

  &.is-smooth {
    transition:
      width 0.32s var(--nn-drawer-ease),
      top 0.38s var(--nn-drawer-ease);
  }
}

.sidebar-card__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }
}

.sidebar-menu {
  border-right: none !important;
  width: 100% !important;
  --el-menu-icon-width: 18px;
  background: transparent !important;
  padding: var(--nn-sidebar-pad, 6px);
  padding-bottom: 2px;
  font-weight: 650;
  box-sizing: border-box;

  :deep(.el-menu-item),
  :deep(.el-sub-menu__title) {
    font-weight: 650;
  }
}

.sidebar-footer {
  flex: 0 0 auto;
  padding: var(--nn-sidebar-pad, 6px);
  padding-top: 2px;
  border-top: 0;
  background: transparent;
  position: relative;
  z-index: 1;
  box-sizing: border-box;
}

.sidebar-collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: var(--nn-icon-slot);
  margin: 0;
  padding: 0 8px;
  border: none;
  border-radius: calc(var(--nn-sidebar-radius, 16px) - var(--nn-sidebar-pad, 6px));
  background: transparent;
  color: var(--nn-sidebar-text);
  font-weight: 650;
  cursor: pointer;
  box-sizing: border-box;
  overflow: hidden;
  transition:
    background-color var(--nn-transition-fast),
    color var(--nn-transition-fast);

  &:hover {
    background: var(--nn-menu-hover-bg);
    color: var(--nn-primary);
  }
}

.menu-icon {
  width: 18px;
  height: 18px;
  margin: 0;
  flex-shrink: 0;
  display: inline-flex;
  justify-content: center;
  align-items: center;
}

.menu-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 650;
  min-width: 0;
  max-width: 72px;
  opacity: 1;
  padding: 0;
  line-height: var(--nn-icon-slot);
  transition:
    opacity 0.2s ease,
    max-width 0.32s var(--nn-drawer-ease);
}

.sidebar-rail.is-collapsed:not(.is-mobile-open) {
  .sidebar-collapse-btn {
    padding: 0;
    gap: 0;
    justify-content: center;
  }

  /* 完全移出布局，避免 max-width:0 仍占 gap 导致图标偏一侧 */
  .menu-label {
    display: none !important;
  }

  :deep(.el-menu--collapse > .el-menu-item),
  :deep(.el-menu--collapse > .el-sub-menu) {
    justify-content: center !important;
  }

  :deep(.el-menu--collapse > .el-menu-item > .el-tooltip__trigger),
  :deep(.el-menu--collapse > .el-menu-item > .el-menu-tooltip__trigger),
  :deep(.el-menu--collapse > .el-sub-menu > .el-sub-menu__title) {
    padding: 0 !important;
    margin: 0 auto !important;
    gap: 0 !important;
    justify-content: center !important;
    align-items: center !important;
    width: var(--nn-icon-slot) !important;
    min-width: var(--nn-icon-slot) !important;
    height: var(--nn-icon-slot) !important;
  }

  :deep(.el-menu--collapse .menu-icon),
  :deep(.el-menu--collapse .el-icon) {
    margin: 0 !important;
  }

  /* 折叠时 EP 可能残留的标题节点一并隐藏 */
  :deep(.el-menu--collapse > .el-sub-menu > .el-sub-menu__title > span:not(.el-icon):not(.menu-icon)) {
    display: none !important;
  }
}

.sidebar-menu.is-sortable {
  :deep(.nn-sortable-cat),
  :deep(.nn-sortable-cat .el-sub-menu__title),
  :deep(.nn-sortable-cat.el-menu-item) {
    cursor: grab;
  }

  :deep(.nn-sortable-cat:active),
  :deep(.nn-sortable-cat .el-sub-menu__title:active),
  :deep(.nn-sortable-cat.el-menu-item:active) {
    cursor: grabbing;
  }
}

:deep(.el-menu--collapse) {
  width: 100% !important;
}

/* 折叠/展开共用：图标+文字整体水平居中，左右边距一致 */
:deep(.el-menu--collapse > .el-menu-item),
:deep(.el-menu--collapse > .el-sub-menu) {
  width: 100% !important;
  height: auto !important;
  margin: 0 0 2px !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: transparent !important;
}

:deep(.el-menu--collapse > .el-menu-item > .el-tooltip__trigger),
:deep(.el-menu--collapse > .el-menu-item > .el-menu-tooltip__trigger),
:deep(.el-menu--collapse > .el-sub-menu > .el-sub-menu__title) {
  width: 100% !important;
  min-width: 0 !important;
  height: var(--nn-icon-slot) !important;
  line-height: 1 !important;
  margin: 0 !important;
  padding: 0 8px !important;
  border-radius: calc(var(--nn-sidebar-radius, 16px) - var(--nn-sidebar-pad, 6px)) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  box-sizing: border-box !important;
  position: relative !important;
  overflow: hidden !important;
  gap: 6px !important;
}

:deep(.el-menu--collapse .el-sub-menu__icon-arrow) {
  display: none !important;
}

:deep(.el-menu--collapse .menu-icon) {
  margin: 0 !important;
  width: 18px !important;
  height: 18px !important;
  flex-shrink: 0 !important;
}

:deep(.el-menu--collapse .menu-icon .nav-icon) {
  display: inline-flex !important;
  visibility: visible !important;
  width: 18px !important;
  height: 18px !important;
}

:deep(.el-menu--collapse > .el-menu-item.is-active) {
  background: transparent !important;
}

:deep(.el-menu--collapse > .el-menu-item.is-active > .el-tooltip__trigger),
:deep(.el-menu--collapse > .el-menu-item.is-active > .el-menu-tooltip__trigger),
:deep(.el-menu--collapse > .el-sub-menu.is-active > .el-sub-menu__title) {
  background-color: var(--nn-menu-hover-bg) !important;
  color: var(--nn-primary) !important;
}

:deep(.el-menu--collapse > .el-menu-item:hover > .el-tooltip__trigger),
:deep(.el-menu--collapse > .el-menu-item:hover > .el-menu-tooltip__trigger),
:deep(.el-menu--collapse > .el-sub-menu > .el-sub-menu__title:hover) {
  background-color: var(--nn-menu-hover-bg) !important;
  color: var(--nn-primary) !important;
}

.sidebar-rail:not(.is-collapsed),
.sidebar-rail.is-mobile-open {
  :deep(.menu-label) {
    visibility: visible !important;
    overflow: hidden !important;
    text-align: center;
  }

  :deep(.el-menu--collapse > .el-sub-menu > .el-sub-menu__title > span) {
    visibility: visible !important;
    width: auto !important;
    height: auto !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    overflow: hidden !important;
    min-width: 0 !important;
    gap: 6px !important;
  }

  :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
    color: var(--nn-primary) !important;
  }
}

.sidebar-backdrop {
  display: none;
}

.desktop-only {
  display: block;
}

/* 手机端浮动展开按钮：仅窄屏显示 */
.sidebar-fab {
  display: none;
  position: fixed;
  left: 10px;
  bottom: 20px;
  z-index: 95;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 12px;
  place-items: center;
  cursor: pointer;
  color: var(--el-text-color-regular);
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--nn-section-bg) 88%, #fff) 0%,
    var(--nn-tab-bg) 100%
  );
  box-shadow:
    0 2px 8px rgba(15, 23, 42, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
  transition:
    transform var(--nn-transition-fast),
    box-shadow var(--nn-transition-fast),
    color var(--nn-transition-fast);

  &:active {
    transform: scale(0.96);
  }

  &:hover {
    color: var(--nn-primary);
  }
}

.sidebar-fab__icon {
  display: block;
}

@media (max-width: 900px) {
  .desktop-only {
    display: none !important;
  }

  .sidebar-fab {
    display: grid;
  }

  .sidebar-rail {
    --nn-sidebar-panel-height: calc(
      100dvh - var(--nn-sidebar-sticky-top, var(--nn-sidebar-gap)) - var(--nn-sidebar-gap)
    );
    /* 与 PC 展开侧栏同宽、同布局 */
    --nn-drawer-card-width: var(--nn-sidebar-width);
    position: fixed;
    top: var(--nn-sidebar-sticky-top, var(--nn-sidebar-gap));
    left: 8px;
    z-index: 1001;
    width: var(--nn-sidebar-width) !important;
    height: var(--nn-sidebar-panel-height);
    padding: 0;
    transform: translateX(calc(-100% - 16px));
    transition: transform var(--nn-transition-slow);
    pointer-events: none;

    &.is-collapsed {
      /* 手机抽屉打开时仍按展开宽度，不被桌面折叠态带窄 */
      --nn-drawer-card-width: var(--nn-sidebar-width);
      width: var(--nn-sidebar-width) !important;
    }

    &.is-mobile-open {
      transform: translateX(0);
      pointer-events: auto;
    }
  }

  /* 手机展开：强制与 PC 展开相同的图标+文字居中 */
  .sidebar-rail.is-mobile-open {
    .menu-label {
      max-width: 72px !important;
      opacity: 1 !important;
      pointer-events: auto !important;
      visibility: visible !important;
    }

    .sidebar-collapse-btn {
      padding: 0 8px;
      justify-content: center;
      gap: 6px;
    }

    :deep(.el-menu--collapse > .el-menu-item > .el-tooltip__trigger),
    :deep(.el-menu--collapse > .el-menu-item > .el-menu-tooltip__trigger),
    :deep(.el-menu--collapse > .el-sub-menu > .el-sub-menu__title) {
      padding: 0 8px !important;
      justify-content: center !important;
      gap: 6px !important;
    }
  }

  .sidebar-card {
    position: relative;
    top: auto;
    left: auto;
    bottom: auto;
    width: 100%;
    height: 100%;
    max-height: none;
    will-change: auto;
  }

  .sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.45);
  }
}

</style>
