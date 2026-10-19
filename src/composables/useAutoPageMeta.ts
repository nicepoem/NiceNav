import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { fetchPageMeta, normalizeSiteUrl, type PageMeta } from '@/utils/page-meta'

type MetaForm = {
  title: string
  description: string
  icon: string
}

/**
 * 链接输入 / 修改后自动填充标题与简介。
 * 用户手动改过的字段不会被覆盖；一旦链接变更会重新开放自动填充。
 */
export function useAutoPageMeta(options: {
  form: MetaForm
  urlProtocol: Ref<'https://' | 'http://'>
  getUrlHost: () => string
  /** 规范化后写回链接输入框（去掉协议前缀） */
  setUrlHost?: (hostPath: string) => void
}) {
  const fetchingMeta = ref(false)
  const titleTouched = ref(false)
  const descriptionTouched = ref(false)
  const iconTouched = ref(false)

  let timer: number | undefined
  let requestId = 0
  let hydrating = false
  let lastSeenUrl = ''

  function markTitleTouched() {
    titleTouched.value = true
  }

  function markDescriptionTouched() {
    descriptionTouched.value = true
  }

  function markIconTouched() {
    iconTouched.value = true
  }

  function resetMetaTouch() {
    titleTouched.value = false
    descriptionTouched.value = false
    iconTouched.value = false
  }

  function currentUrlKey() {
    return `${options.urlProtocol.value}${options.getUrlHost().trim()}`
  }

  /** 填充表单时调用，避免打开弹窗时误触发抓取 */
  function runHydrate(fn: () => void) {
    hydrating = true
    if (timer) window.clearTimeout(timer)
    requestId += 1
    fetchingMeta.value = false
    fn()
    resetMetaTouch()
    lastSeenUrl = currentUrlKey()
    queueMicrotask(() => {
      lastSeenUrl = currentUrlKey()
      hydrating = false
    })
  }

  function applyMeta(meta: PageMeta) {
    if (!titleTouched.value && meta.title) options.form.title = meta.title
    if (!descriptionTouched.value && meta.description) {
      options.form.description = meta.description
    }
    if (!iconTouched.value && meta.icon) {
      options.form.icon = meta.icon
    }
  }

  async function fetchNow() {
    if (hydrating) return

    const raw = options.getUrlHost().trim()
    if (!raw) return

    // 粘贴完整 https:// 链接时，纠正协议开关并回写输入框
    if (/^https:\/\//i.test(raw)) options.urlProtocol.value = 'https://'
    else if (/^http:\/\//i.test(raw)) options.urlProtocol.value = 'http://'

    const url = normalizeSiteUrl(options.urlProtocol.value, raw)
    if (!url) return

    try {
      const parsed = new URL(url)
      const hostPath = `${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname}${parsed.search}${parsed.hash}`
      if (options.getUrlHost().trim() !== hostPath) options.setUrlHost?.(hostPath)
    } catch {
      // ignore
    }

    const id = ++requestId
    fetchingMeta.value = true
    try {
      const meta = await fetchPageMeta(url)
      if (id !== requestId) return
      applyMeta(meta)
    } finally {
      if (id === requestId) fetchingMeta.value = false
    }
  }

  function scheduleFetch(delayMs = 400) {
    if (hydrating) return
    if (timer) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      void fetchNow()
    }, delayMs)
  }

  watch(
    () => currentUrlKey(),
    (next) => {
      if (hydrating) return
      if (!next || next === lastSeenUrl) return
      lastSeenUrl = next
      // 链接变更后，允许重新覆盖标题 / 简介 / 图标
      resetMetaTouch()
      scheduleFetch()
    },
  )

  onBeforeUnmount(() => {
    if (timer) window.clearTimeout(timer)
    requestId += 1
  })

  return {
    fetchingMeta,
    markTitleTouched,
    markDescriptionTouched,
    markIconTouched,
    resetMetaTouch,
    runHydrate,
    scheduleFetch,
    fetchNow,
  }
}
