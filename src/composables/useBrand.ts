import { computed, watch } from 'vue'
import { useNavStore } from '@/stores/nav'

function ensureFaviconLink() {
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']")
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  return link
}

export function useBrand() {
  const nav = useNavStore()

  const siteName = computed(() => nav.settings.siteName?.trim() || 'Nice Nav')
  const siteSlogan = computed(() => nav.settings.siteSlogan?.trim() || '本地导航起始页')
  const logo = computed(() => nav.settings.logo?.trim() || '')
  const favicon = computed(() => nav.settings.favicon?.trim() || logo.value)
  const siteArticle = computed(() => nav.settings.siteArticle?.trim() || '')

  function applyDocumentBrand() {
    document.title = 'NiceNav'
    document
      .querySelectorAll("link[rel='icon'], link[rel='shortcut icon']")
      .forEach((el, index) => {
        if (index > 0) el.remove()
      })
    const link = ensureFaviconLink()
    link.type = 'image/png'
    link.sizes = 'any'
    // 固定使用 public/favicon.png，避免旧的站点 Logo 覆盖标签图标
    link.href = `/favicon.png?v=2`
  }

  function watchBrand() {
    watch([siteName, favicon], () => applyDocumentBrand(), { immediate: true })
  }

  return {
    siteName,
    siteSlogan,
    logo,
    favicon,
    siteArticle,
    applyDocumentBrand,
    watchBrand,
  }
}
