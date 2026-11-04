<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  reactive,
  ref,
  watch,
} from 'vue'
import { ElMessage } from 'element-plus'
import {
  Delete,
  Edit,
  Plus,
  Rank,
} from '@element-plus/icons-vue'
import Sortable from 'sortablejs'
import type { Category } from '@nice-nav/core'
import { useNavStore } from '@/stores/nav'
import { confirmDeleteCategory } from '@/utils/confirm-delete'
import IconPicker from '@/components/site/IconPicker.vue'
import NavIcon from '@/components/common/NavIcon.vue'

const props = withDefaults(
  defineProps<{
    /** 面板是否处于可见/激活状态（用于初始化拖拽） */
    active?: boolean
  }>(),
  { active: true },
)

const nav = useNavStore()

const form = reactive({
  id: '' as string | undefined,
  name: '',
  icon: '',
  parentId: null as string | null,
})

const isEdit = computed(() => Boolean(form.id))
const submitLabel = computed(() => (isEdit.value ? '保存' : '添加'))

const parentOptions = computed(() => {
  const selfId = form.id
  const blocked = new Set<string>()
  if (selfId) {
    const stack = [selfId]
    while (stack.length) {
      const id = stack.pop()!
      blocked.add(id)
      nav.categories
        .filter((c) => c.parentId === id)
        .forEach((c) => stack.push(c.id))
    }
  }
  const selfHasChildren =
    Boolean(selfId) && nav.categories.some((c) => c.parentId === selfId)
  if (selfHasChildren) return []
  return nav.rootCategories.filter((c) => !blocked.has(c.id))
})

const tree = computed(() => nav.categoryTree)
const categoryMap = computed(
  () => new Map(nav.categories.map((c) => [c.id, c])),
)

type MgrRow = { id: string; depth: 0 | 1 }

const rows = ref<MgrRow[]>([])
/** 拖拽中或写回中：阻止 tree → rows 同步，避免打断 Sortable */
let lockRows = false

function syncRowsFromTree() {
  if (lockRows) return
  const next: MgrRow[] = []
  for (const node of tree.value) {
    next.push({ id: node.id, depth: 0 })
    for (const child of node.children) next.push({ id: child.id, depth: 1 })
  }
  rows.value = next
}

watch(tree, () => syncRowsFromTree(), { immediate: true })

const siteCountByCategory = computed(() => {
  const map = new Map<string, number>()
  for (const site of nav.sites) {
    map.set(site.categoryId, (map.get(site.categoryId) ?? 0) + 1)
  }
  return map
})

function resetForm(parentId: string | null = null) {
  form.id = undefined
  form.name = ''
  form.icon = ''
  form.parentId = parentId
}

function startEdit(category: Category) {
  form.id = category.id
  form.name = category.name
  form.icon = category.icon ?? ''
  form.parentId = category.parentId ?? null
}

function startAddChild(parent: Category) {
  resetForm(parent.id)
}

watch(
  () => props.active,
  (on) => {
    if (on) resetForm()
  },
)

async function submit() {
  if (!form.name.trim()) {
    ElMessage.warning('请填写分类名称')
    return
  }
  try {
    await nav.upsertCategory({
      id: form.id,
      name: form.name.trim(),
      icon: form.icon.trim() || undefined,
      parentId: form.parentId,
    })
    ElMessage.success(isEdit.value ? '分类已更新' : '分类已添加')
    resetForm(form.parentId && !isEdit.value ? form.parentId : null)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

async function removeCategory(category: Category) {
  try {
    await confirmDeleteCategory(category.name, nav.childrenOf(category.id).length)
    await nav.removeCategory(category.id)
    if (form.id === category.id) resetForm()
    ElMessage.success('分类已删除')
  } catch {
    // cancelled
  }
}

function siteCount(id: string) {
  return siteCountByCategory.value.get(id) ?? 0
}

function categoryOf(id: string) {
  return categoryMap.value.get(id)
}

const listEl = ref<HTMLElement | null>(null)
let listSortable: Sortable | null = null
let binding = false
const INDENT = 28

const dragState = {
  id: '',
  startX: 0,
  startDepth: 0 as 0 | 1,
  depth: 0 as 0 | 1,
  /** 拖父级时暂存的子分类，松手后再拼回 */
  stickyKids: [] as string[],
  item: null as HTMLElement | null,
}

function childIdsOf(id: string) {
  return nav.categories
    .filter((c) => c.parentId === id)
    .sort((a, b) => a.order - b.order)
    .map((c) => c.id)
}

function readClientX(event: Event | null | undefined) {
  if (!event) return null
  if (event instanceof MouseEvent) return event.clientX
  if (typeof TouchEvent !== 'undefined' && event instanceof TouchEvent) {
    return event.touches[0]?.clientX ?? event.changedTouches[0]?.clientX ?? null
  }
  return null
}

function eventFromSortable(evt: object) {
  return (evt as { originalEvent?: Event }).originalEvent
}

function applyDragDepth(depth: 0 | 1) {
  const item = dragState.item
  if (!item) return
  dragState.depth = depth
  item.dataset.depth = String(depth)
  item.classList.toggle('is-child', depth === 1)
}

function updateDragDepth(clientX: number) {
  if (!dragState.item) return
  // 有子分类的父级不能降为二级
  if (dragState.stickyKids.length) {
    applyDragDepth(0)
    return
  }
  const shift = Math.round((clientX - dragState.startX) / INDENT)
  let depth = Math.min(1, Math.max(0, dragState.startDepth + shift)) as 0 | 1
  let prev = dragState.item.previousElementSibling
  while (prev instanceof HTMLElement && prev.classList.contains('is-collapsed')) {
    prev = prev.previousElementSibling
  }
  if (!(prev instanceof HTMLElement) || !prev.dataset.id) depth = 0
  applyDragDepth(depth)
}

function setCollapsed(ids: string[], collapsed: boolean) {
  const root = listEl.value
  if (!root) return
  for (const id of ids) {
    const el = root.querySelector<HTMLElement>(`:scope > .cat-mgr__row[data-id="${CSS.escape(id)}"]`)
    if (!el) continue
    el.classList.toggle('is-collapsed', collapsed)
  }
}

function destroySortable() {
  listSortable?.destroy()
  listSortable = null
}

/** depth0 = 一级；depth1 = 挂到最近的前一个一级 */
async function persistFlat(items: MgrRow[]) {
  lockRows = true
  rows.value = items
  try {
    let rootOrder = 0
    let childOrder = 0
    let currentRoot: string | null = null
    const patch: Array<{ id: string; parentId: string | null; order: number }> = []
    for (const item of items) {
      if (!categoryMap.value.has(item.id)) continue
      if (item.depth === 0 || !currentRoot) {
        currentRoot = item.id
        childOrder = 0
        patch.push({ id: item.id, parentId: null, order: rootOrder++ })
      } else {
        patch.push({
          id: item.id,
          parentId: currentRoot,
          order: childOrder++,
        })
      }
    }
    await nav.syncCategoryHierarchy(patch)
  } finally {
    lockRows = false
    syncRowsFromTree()
    await nextTick()
    void setupSortable()
  }
}

/** 非拖拽项保持原父子关系；拖拽项按 depth 升/降级；父级 sticky 子项跟随 */
function packByOwnership(
  orderedIds: string[],
  draggedId: string,
  draggedDepth: 0 | 1,
  stickyKids: string[],
): MgrRow[] {
  const storeParent = (id: string) => {
    const p = categoryMap.value.get(id)?.parentId
    return p == null || p === '' ? null : p
  }

  const parentOf = new Map<string, string | null>()
  for (const id of orderedIds) {
    if (id === draggedId) continue
    parentOf.set(id, storeParent(id))
  }

  if (draggedDepth === 0) {
    parentOf.set(draggedId, null)
  } else {
    const idx = orderedIds.indexOf(draggedId)
    let parent: string | null = null
    for (let i = idx - 1; i >= 0; i--) {
      const id = orderedIds[i]!
      const sp = storeParent(id)
      parent = sp == null ? id : sp
      break
    }
    parentOf.set(draggedId, parent)
  }

  for (const id of stickyKids) {
    parentOf.set(id, draggedDepth === 0 ? draggedId : (parentOf.get(draggedId) ?? draggedId))
  }

  const result: MgrRow[] = []
  const emitted = new Set<string>()

  function emitRoot(rootId: string) {
    if (emitted.has(rootId)) return
    emitted.add(rootId)
    result.push({ id: rootId, depth: 0 })
    for (const id of orderedIds) {
      if (parentOf.get(id) === rootId && !emitted.has(id)) {
        emitted.add(id)
        result.push({ id, depth: 1 })
      }
    }
    for (const id of stickyKids) {
      if (parentOf.get(id) === rootId && !emitted.has(id)) {
        emitted.add(id)
        result.push({ id, depth: 1 })
      }
    }
  }

  for (const id of orderedIds) {
    if (parentOf.get(id) == null) emitRoot(id)
  }
  for (const id of orderedIds) {
    if (emitted.has(id)) continue
    const p = parentOf.get(id)
    if (p) emitRoot(p)
    if (!emitted.has(id)) {
      result.push({ id, depth: p ? 1 : 0 })
      emitted.add(id)
    }
  }
  for (const id of stickyKids) {
    if (!emitted.has(id)) result.push({ id, depth: 1 })
  }

  if (result.length && result.every((r) => r.depth === 1)) {
    result[0] = { id: result[0]!.id, depth: 0 }
  }
  return result
}

function finishSort(evt: Sortable.SortableEvent) {
  const container = listEl.value ?? evt.to
  if (!(container instanceof HTMLElement)) {
    setCollapsed(dragState.stickyKids, false)
    dragState.stickyKids = []
    return
  }

  const stickyKids = dragState.stickyKids
  const depth: 0 | 1 = stickyKids.length ? 0 : dragState.depth
  const stickySet = new Set(stickyKids)

  const orderedIds = [...container.querySelectorAll<HTMLElement>(':scope > .cat-mgr__row')]
    .filter((el) => !el.classList.contains('is-collapsed'))
    .map((el) => el.dataset.id ?? '')
    .filter((id) => id && !stickySet.has(id))

  const normalized = packByOwnership(
    orderedIds,
    dragState.id,
    depth,
    stickyKids,
  )

  setCollapsed(stickyKids, false)
  dragState.item = null
  dragState.stickyKids = []
  void persistFlat(normalized)
}

async function setupSortable() {
  if (binding) return
  binding = true
  try {
    destroySortable()
    await nextTick()
    if (!props.active || lockRows) return
    const root = listEl.value
    if (!root || !rows.value.length) return

    listSortable = Sortable.create(root, {
      animation: 160,
      handle: '.cat-mgr__handle',
      draggable: '.cat-mgr__row',
      filter: '.cat-mgr__actions, .cat-mgr__actions *, .cat-mgr__row.is-collapsed',
      preventOnFilter: true,
      forceFallback: true,
      fallbackOnBody: true,
      fallbackTolerance: 4,
      ghostClass: 'nn-sortable-ghost',
      chosenClass: 'nn-sortable-chosen',
      dragClass: 'nn-sortable-drag',
      onStart: (evt) => {
        const item = evt.item
        const id = item.dataset.id ?? ''
        dragState.id = id
        dragState.item = item
        dragState.startDepth = item.dataset.depth === '1' ? 1 : 0
        dragState.depth = dragState.startDepth
        dragState.startX = readClientX(eventFromSortable(evt)) ?? 0
        dragState.stickyKids =
          dragState.startDepth === 0 ? childIdsOf(id) : []
        // 隐藏子项，父级整块拖；不改 rows，避免打断 Sortable
        if (dragState.stickyKids.length) setCollapsed(dragState.stickyKids, true)
        document.body.classList.add('cat-mgr-sorting')
      },
      onMove: (evt) => {
        if (evt.related?.classList.contains('is-collapsed')) return false
        const x = readClientX(eventFromSortable(evt))
        if (x != null) updateDragDepth(x)
        return true
      },
      onEnd: (evt) => {
        document.body.classList.remove('cat-mgr-sorting')
        const x = readClientX(eventFromSortable(evt))
        if (x != null) updateDragDepth(x)
        finishSort(evt)
      },
    })
  } finally {
    binding = false
  }
}

watch(
  () => [props.active, rows.value.map((r) => r.id).join('|')] as const,
  () => {
    if (lockRows) return
    void setupSortable()
  },
  { flush: 'post', immediate: true },
)

onBeforeUnmount(() => {
  document.body.classList.remove('cat-mgr-sorting')
  destroySortable()
})

defineExpose({ resetForm })
</script>

<template>
  <div class="cat-mgr">
    <form class="cat-mgr__toolbar" @submit.prevent="submit">
      <div class="cat-mgr__toolbar-fields">
        <div class="nn-field cat-mgr__name-field">
          <input
            v-model="form.name"
            class="nn-field__input"
            type="text"
            :placeholder="isEdit ? '分类名称' : '新分类名称'"
            autocomplete="off"
          />
        </div>

        <div class="nn-field nn-field--select cat-mgr__parent-field">
          <el-select
            v-model="form.parentId"
            clearable
            :disabled="isEdit && parentOptions.length === 0"
            placeholder="一级分类"
            teleported
            popper-class="nn-select-popper"
          >
            <el-option
              v-for="cat in parentOptions"
              :key="cat.id"
              :label="cat.name"
              :value="cat.id"
            >
              <span class="parent-option">
                <NavIcon :icon="cat.icon" :size="16" />
                {{ cat.name }}
              </span>
            </el-option>
          </el-select>
        </div>

        <IconPicker v-model="form.icon" compact />
      </div>

      <div class="cat-mgr__toolbar-actions">
        <button
          v-if="isEdit"
          type="button"
          class="nn-btn nn-btn--ghost"
          @click="resetForm()"
        >
          取消
        </button>
        <button type="submit" class="nn-btn nn-btn--primary">
          {{ submitLabel }}
        </button>
      </div>
    </form>

    <p class="cat-mgr__tip">拖拽排序；子分类向左拖可升为一级，一级向右拖可挂到上方分类下</p>

    <div v-if="!rows.length" class="cat-mgr__empty">
      暂无分类，在上方填写名称后添加
    </div>

    <div v-else ref="listEl" class="cat-mgr__list">
      <div
        v-for="row in rows"
        :key="row.id"
        class="cat-mgr__row"
        :class="{
          'is-child': row.depth === 1,
          'is-active': form.id === row.id,
        }"
        :data-id="row.id"
        :data-depth="row.depth"
      >
        <span
          class="cat-mgr__handle"
          title="拖拽排序，左右调整层级"
          aria-label="拖拽排序"
        >
          <el-icon :size="16"><Rank /></el-icon>
        </span>

        <NavIcon :icon="categoryOf(row.id)?.icon" :size="row.depth ? 16 : 18" />
        <span class="cat-mgr__name">{{ categoryOf(row.id)?.name }}</span>
        <span class="cat-mgr__meta">{{ siteCount(row.id) }}</span>

        <div class="cat-mgr__actions">
          <button
            v-if="row.depth === 0 && categoryOf(row.id)"
            type="button"
            class="cat-mgr__icon-btn"
            title="添加子分类"
            aria-label="添加子分类"
            @click="startAddChild(categoryOf(row.id)!)"
          >
            <el-icon :size="15"><Plus /></el-icon>
          </button>
          <button
            v-if="categoryOf(row.id)"
            type="button"
            class="cat-mgr__icon-btn"
            title="编辑"
            aria-label="编辑"
            @click="startEdit(categoryOf(row.id)!)"
          >
            <el-icon :size="15"><Edit /></el-icon>
          </button>
          <button
            v-if="categoryOf(row.id)"
            type="button"
            class="cat-mgr__icon-btn is-danger"
            title="删除"
            aria-label="删除"
            @click="removeCategory(categoryOf(row.id)!)"
          >
            <el-icon :size="15"><Delete /></el-icon>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.cat-mgr {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 360px;
}

.cat-mgr__toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.cat-mgr__toolbar-fields {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}

.cat-mgr__name-field {
  flex: 1 1 160px;
  min-width: 140px;
}

.cat-mgr__parent-field {
  flex: 0 1 160px;
  min-width: 120px;
}

.cat-mgr__toolbar-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.cat-mgr__tip {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--el-text-color-secondary);
}

.cat-mgr__empty {
  flex: 1;
  display: grid;
  place-items: center;
  min-height: 200px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  border-radius: var(--nn-item-radius, 8px);
  background: var(--nn-item-hover-bg, #f5f6f8);
}

.cat-mgr__list {
  display: flex;
  flex-direction: column;
  max-height: min(58vh, 480px);
  overflow: auto;
  padding: 6px 8px 6px 6px;
  border-radius: var(--nn-item-radius, 8px);
  background: var(--nn-item-hover-bg, #f5f6f8);
}

.cat-mgr__row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  margin-bottom: 4px;
  padding: 6px 10px 6px 4px;
  border-radius: var(--nn-item-radius, 8px);
  background: var(--nn-section-bg, #fff);
  box-sizing: border-box;
  overflow: visible;
  transition: background var(--nn-transition-fast, 0.15s ease);

  &:last-child {
    margin-bottom: 0;
  }

  &.is-active {
    outline: 1px solid color-mix(in srgb, var(--nn-primary) 35%, transparent);
    background: color-mix(in srgb, var(--nn-primary) 8%, var(--nn-section-bg, #fff));
  }

  &.is-child {
    min-height: 38px;
    padding-left: 32px;
  }

  &.is-collapsed {
    display: none !important;
  }
}

.cat-mgr__handle {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: var(--el-text-color-secondary);
  cursor: grab;
  touch-action: none;
  user-select: none;

  &:active {
    cursor: grabbing;
  }

  &:hover {
    color: var(--nn-primary);
    background: var(--nn-item-hover-bg, #f0f2f5);
  }
}

.cat-mgr__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 550;
  color: var(--el-text-color-primary);
}

.cat-mgr__meta {
  flex-shrink: 0;
  min-width: 1.5em;
  text-align: right;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-secondary);
}

.cat-mgr__actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0.55;
  transition: opacity var(--nn-transition-fast, 0.15s ease);

  .cat-mgr__row:hover &,
  .cat-mgr__row.is-active & {
    opacity: 1;
  }
}

.cat-mgr__icon-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 6px;
  padding: 0;
  color: var(--el-text-color-secondary);
  background: transparent;
  cursor: pointer;

  &:hover {
    color: var(--nn-primary);
    background: var(--nn-item-hover-bg, #f0f2f5);
  }

  &.is-danger:hover {
    color: var(--el-color-danger);
  }
}

.parent-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 640px) {
  .cat-mgr__toolbar-actions {
    margin-left: 0;
    width: 100%;
    justify-content: flex-end;
  }

  .cat-mgr__meta {
    display: none;
  }
}
</style>

<style lang="scss">
body.cat-mgr-sorting {
  cursor: grabbing !important;

  .sortable-fallback {
    z-index: 4000 !important;
    box-shadow: var(--nn-panel-shadow, 0 8px 24px rgba(0, 0, 0, 0.12));
    border-radius: var(--nn-item-radius, 8px);
    opacity: 0.95 !important;
  }
}
</style>
