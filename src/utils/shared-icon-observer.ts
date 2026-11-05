type IconObserveCallback = () => void

const observed = new Map<Element, IconObserveCallback>()

let shared: IntersectionObserver | null = null

function getObserver() {
  if (shared) return shared
  shared = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        observed.get(entry.target)?.()
      }
    },
    {
      root: null,
      rootMargin: '640px 0px',
      threshold: 0.01,
    },
  )
  return shared
}

/** 共享 IntersectionObserver，避免每张卡片各建一个 */
export function observeIconTrigger(el: Element, onVisible: IconObserveCallback) {
  observed.set(el, onVisible)
  getObserver().observe(el)
}

export function unobserveIconTrigger(el: Element) {
  observed.delete(el)
  shared?.unobserve(el)
  if (observed.size === 0 && shared) {
    shared.disconnect()
    shared = null
  }
}
