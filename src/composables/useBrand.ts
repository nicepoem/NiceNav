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
    document.title = siteName.value
    const link = ensureFaviconLink()
    if (favicon.value) {
      link.href = favicon.value
    } else {
      link.href = '/favicon.svg'
    }
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
