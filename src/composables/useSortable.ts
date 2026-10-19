import {
  onBeforeUnmount,
  watch,
  nextTick,
  type Ref,
  type WatchSource,
} from 'vue'
import Sortable, { type Options } from 'sortablejs'

export type SortableFactory = () => Options | null | undefined

/**
 * 在容器上挂载 Sortable；source 变化或 enabled 关闭时销毁/重建。
 * options 返回 null 表示禁用。
 */
export function useSortable(
  container: Ref<HTMLElement | null | undefined>,
  optionsFactory: SortableFactory,
  deps: WatchSource[] = [],
) {
  let instance: Sortable | null = null

  async function recreate() {
    instance?.destroy()
    instance = null
    await nextTick()
    const el = container.value
    if (!el) return
    const opts = optionsFactory()
    if (!opts) return
    instance = Sortable.create(el, {
      animation: 160,
      easing: 'cubic-bezier(0.2, 0, 0, 1)',
      ghostClass: 'nn-sortable-ghost',
      chosenClass: 'nn-sortable-chosen',
      dragClass: 'nn-sortable-drag',
      ...opts,
    })
  }

  watch([container, ...deps], () => {
    void recreate()
  }, { flush: 'post', immediate: true })

  onBeforeUnmount(() => {
    instance?.destroy()
    instance = null
  })

  return { recreate }
}

/** 从容器子节点按 data 属性收集 id 顺序 */
export function collectSortIds(container: HTMLElement, attr = 'data-id') {
  return [...container.children]
    .map((el) => (el as HTMLElement).getAttribute(attr))
    .filter((id): id is string => Boolean(id))
}
