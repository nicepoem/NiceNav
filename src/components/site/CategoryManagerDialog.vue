<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  reactive,
  ref,
  watch,
} from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Close,
  Delete,
  Edit,
  Plus,
  Rank,
} from '@element-plus/icons-vue'
import Sortable from 'sortablejs'
import type { Category } from '@nice-nav/core'
import { useNavStore } from '@/stores/nav'
import { collectSortIds } from '@/composables/useSortable'
import IconPicker from '@/components/site/IconPicker.vue'
import NavIcon from '@/components/common/NavIcon.vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const nav = useNavStore()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const form = reactive({
  id: '' as string | undefined,
  name: '',
  icon: '',
  parentId: null as string | null,
})

const isEdit = computed(() => Boolean(form.id))
const formTitle = computed(() => (isEdit.value ? '编辑分类' : '添加分类'))

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
  return nav.rootCategories.filter((c) => !blocked.has(c.id))
})

const tree = computed(() => nav.categoryTree)
const categoryMap = computed(
  () => new Map(nav.categories.map((c) => [c.id, c])),
)

type MgrRow = { id: string; depth: 0 | 1 }
const rows = ref<MgrRow[]>([])
let sorting = false

function syncRows() {
  if (sorting) return
  const next: MgrRow[] = []
  for (const node of tree.value) {
    next.push({ id: node.id, depth: 0 })
    for (const child of node.children) next.push({ id: child.id, depth: 1 })
  }
  rows.value = next
}

watch(tree, () => syncRows(), { immediate: true })
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
  () => props.modelValue,
  (open) => {
    if (open) resetForm()
  },
)

async function submit() {
  if (!form.name.trim()) {
    ElMessage.warning('请填写分类名称')
    return
  }
  await nav.upsertCategory({
    id: form.id,
    name: form.name.trim(),
    icon: form.icon.trim() || undefined,
    parentId: form.parentId,
  })
  ElMessage.success(isEdit.value ? '分类已更新' : '分类已添加')
  resetForm(form.parentId && !isEdit.value ? form.parentId : null)
}

async function removeCategory(category: Category) {
  const childCount = nav.childrenOf(category.id).length
  const tip =
    childCount > 0
      ? `删除「${category.name}」将同时删除其 ${childCount} 个子分类及下属网址，是否继续？`
      : `删除分类「${category.name}」将同时删除其下所有网址，是否继续？`
  try {
    await ElMessageBox.confirm(tip, '删除分类', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await nav.removeCategory(category.id)
    if (form.id === category.id) resetForm()
    ElMessage.success('分类已删除')
  } catch {
    // cancelled
  }
}

const listEl = ref<HTMLElement | null>(null)
let listSortable: Sortable | null = null
const INDENT = 36

const dragState = {
  id: '',
  startX: 0,
  startDepth: 0 as 0 | 1,
  depth: 0 as 0 | 1,
  childIds: [] as string[],
  item: null as HTMLElement | null,
}

function destroySortables() {
  listSortable?.destroy()
  listSortable = null
}

function childIdsOf(id: string) {
  return nav.categories.filter((c) => c.parentId === id).map((c) => c.id)
}

function readClientX(event: Event | null | undefined) {
  if (!event) return null
  if (event instanceof MouseEvent) return event.clientX
  if (typeof TouchEvent !== 'undefined' && event instanceof TouchEvent) {
    return event.touches[0]?.clientX ?? event.changedTouches[0]?.clientX ?? null
  }
  return null
}

/** Sortable 运行时有 originalEvent，官方类型未声明 */
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
  const shift = Math.round((clientX - dragState.startX) / INDENT)
  let depth = Math.min(1, Math.max(0, dragState.startDepth + shift)) as 0 | 1
  const prev = dragState.item.previousElementSibling
  if (!(prev instanceof HTMLElement) || !prev.dataset.id) depth = 0
  applyDragDepth(depth)
}

/**
 * 带子分类一起移动。
 * 仍是一级时，子分类继续挂在它下面；被缩进成二级时，原子分类改为同级。
 */
function keepChildrenWithParent(
  items: MgrRow[],
  parentId: string,
  childIds: string[],
  parentDepth: 0 | 1,
) {
  if (!childIds.length) return items
  const childSet = new Set(childIds)
  const rest = items.filter((item) => !childSet.has(item.id))
  const index = rest.findIndex((item) => item.id === parentId)
  if (index < 0) return items
  rest[index] = { id: parentId, depth: parentDepth }
  const childDepth: 0 | 1 = 1
  rest.splice(
    index + 1,
    0,
    ...childIds
      .filter((id) => items.some((item) => item.id === id))
      .map((id) => ({ id, depth: childDepth })),
  )
  return rest
}

function normalizeRows(items: MgrRow[]) {
  const out: MgrRow[] = []
  let hasRoot = false
  for (const item of items) {
    const depth: 0 | 1 = !hasRoot || item.depth === 0 ? 0 : 1
    if (depth === 0) hasRoot = true
    out.push({ id: item.id, depth })
  }
  return out
}

async function persistRows(items: MgrRow[]) {
  sorting = true
  rows.value = items
  try {
    let rootOrder = 0
    let childOrder = 0
    let currentRoot: string | null = null
    for (const item of items) {
      const cat = categoryMap.value.get(item.id)
      if (!cat) continue
      const parentId = item.depth === 0 ? null : currentRoot
      const order = item.depth === 0 ? rootOrder++ : childOrder++
      if (item.depth === 0) {
        currentRoot = item.id
        childOrder = 0
      }
      const sameParent = (cat.parentId ?? null) === parentId
      if (sameParent && cat.order === order) continue
      await nav.upsertCategory({
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        parentId,
        order,
      })
    }
  } finally {
    sorting = false
    syncRows()
  }
}

function onSortEnd(container: HTMLElement) {
  const ids = collectSortIds(container, 'data-id')
  const depthOf = new Map(
    [...container.querySelectorAll<HTMLElement>(':scope > .cat-mgr__row')].map((el) => [
      el.dataset.id ?? '',
      (el.dataset.depth === '1' ? 1 : 0) as 0 | 1,
    ]),
  )
  let items: MgrRow[] = ids.map((id) => ({
    id,
    depth: id === dragState.id ? dragState.depth : (depthOf.get(id) ?? 0),
  }))
  items = keepChildrenWithParent(
    items,
    dragState.id,
    dragState.childIds,
    dragState.depth,
  )
  items = normalizeRows(items)
  dragState.item = null
  void persistRows(items)
}

async function setupSortables() {
  destroySortables()
  await nextTick()
  if (!visible.value) return
  const root = listEl.value
  if (!root) return

  listSortable = Sortable.create(root, {
    animation: 160,
    handle: '.cat-mgr__handle',
    draggable: '.cat-mgr__row',
    forceFallback: true,
    fallbackOnBody: true,
    fallbackTolerance: 3,
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
      dragState.childIds = dragState.startDepth === 0 ? childIdsOf(id) : []
      dragState.startX = readClientX(eventFromSortable(evt)) ?? 0
    },
    onMove: (evt) => {
      const x = readClientX(eventFromSortable(evt))
      if (x != null) updateDragDepth(x)
      return true
    },
    onEnd: (evt) => {
      const x = readClientX(eventFromSortable(evt))
      if (x != null) updateDragDepth(x)
      const container = listEl.value ?? evt.to
      if (container) onSortEnd(container)
    },
  })
}

watch(
  () => [visible.value, rows.value.map((row) => `${row.id}:${row.depth}`).join('|')] as const,
  () => {
    void setupSortables()
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  destroySortables()
})

function siteCount(id: string) {
  return siteCountByCategory.value.get(id) ?? 0
}

function categoryOf(id: string) {
  return categoryMap.value.get(id)
}
</script>

<template>
  <el-dialog
    v-model="visible"
    width="860px"
    align-center
    destroy-on-close
    class="nn-dialog nn-dialog--wide"
    :show-close="false"
  >
    <template #header>
      <div class="nn-dlg-head">
        <div>
          <h2 class="nn-dlg-head__title">分类管理</h2>
          <p class="nn-dlg-head__hint">左侧添加或编辑，右侧拖拽调整顺序和层级</p>
        </div>
        <button
          type="button"
          class="nn-dlg-head__close"
          aria-label="关闭"
          @click="visible = false"
        >
          <el-icon :size="16"><Close /></el-icon>
        </button>
      </div>
    </template>

    <div class="cat-mgr">
      <aside class="cat-mgr__form">
        <div class="cat-mgr__form-head">
          <h3 class="cat-mgr__form-title">{{ formTitle }}</h3>
          <button
            v-if="isEdit"
            type="button"
            class="cat-mgr__link"
            @click="resetForm()"
          >
            新建
          </button>
        </div>

        <label class="nn-field-block">
          <span class="nn-field-label">名称 <em>*</em></span>
          <div class="nn-field">
            <input
              v-model="form.name"
              class="nn-field__input"
              type="text"
              placeholder="例如 技术文档"
              autocomplete="off"
            />
          </div>
        </label>

        <label class="nn-field-block">
          <span class="nn-field-label">上级分类</span>
          <div class="nn-field nn-field--select">
            <el-select
              v-model="form.parentId"
              clearable
              placeholder="不选则为一级分类"
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
        </label>

        <div class="nn-field-block">
          <span class="nn-field-label">图标</span>
          <IconPicker v-model="form.icon" />
        </div>

        <div class="cat-mgr__form-actions">
          <button type="button" class="nn-btn nn-btn--primary" @click="submit">
            {{ isEdit ? '保存修改' : '添加分类' }}
          </button>
        </div>
      </aside>

      <section class="cat-mgr__list-wrap">
        <div class="cat-mgr__list-head">
          <h3 class="cat-mgr__form-title">分类结构</h3>
          <span class="cat-mgr__hint">上下排序，向右缩进为二级，向左拉出为一级</span>
        </div>

        <div v-if="!rows.length" class="cat-mgr__empty">
          暂无分类，请先在左侧添加
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
            <button
              type="button"
              class="cat-mgr__handle"
              title="拖拽：上下排序，左右调整层级"
              aria-label="拖拽排序"
            >
              <el-icon :size="16"><Rank /></el-icon>
            </button>
            <NavIcon :icon="categoryOf(row.id)?.icon" :size="row.depth ? 16 : 18" />
            <span class="cat-mgr__name">{{ categoryOf(row.id)?.name }}</span>
            <span class="cat-mgr__meta">{{ siteCount(row.id) }} 个网址</span>
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
      </section>
    </div>
  </el-dialog>
</template>

<style scoped lang="scss">
.cat-mgr {
  display: grid;
  grid-template-columns: minmax(240px, 280px) minmax(0, 1fr);
  gap: 16px;
  min-height: 420px;
}

.cat-mgr__form,
.cat-mgr__list-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  border-radius: var(--nn-sidebar-radius, 12px);
  background: var(--nn-item-hover-bg, #f0f2f5);
}

.cat-mgr__form-head,
.cat-mgr__list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.cat-mgr__form-title {
  margin: 0;
  font-size: 14px;
  font-weight: 650;
  color: var(--el-text-color-primary);
}

.cat-mgr__link {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--nn-primary);
  font-size: 13px;
  cursor: pointer;
}

.cat-mgr__hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.cat-mgr__form-actions {
  margin-top: 4px;
}

.cat-mgr__empty {
  flex: 1;
  display: grid;
  place-items: center;
  padding: 32px 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.cat-mgr__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: min(56vh, 520px);
  overflow: auto;
  padding-right: 2px;
}

.cat-mgr__row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 6px 8px;
  border-radius: var(--nn-item-radius, 8px);
  background: var(--nn-section-bg, #fff);
  transition:
    background var(--nn-transition-fast, 0.15s ease),
    margin-left 0.12s ease;

  &.is-active {
    outline: 1px solid color-mix(in srgb, var(--nn-primary) 35%, transparent);
    background: color-mix(in srgb, var(--nn-primary) 8%, var(--nn-section-bg, #fff));
  }

  &.is-child {
    min-height: 36px;
    margin-left: 36px;
  }
}

.cat-mgr__handle {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 6px;
  padding: 0;
  color: var(--el-text-color-secondary);
  background: transparent;
  cursor: grab;

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
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.cat-mgr__actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
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

@media (max-width: 760px) {
  .cat-mgr {
    grid-template-columns: 1fr;
    min-height: 0;
  }

  .cat-mgr__list {
    max-height: 42vh;
  }

  .cat-mgr__meta {
    display: none;
  }
}
</style>
