import { addCollection } from '@iconify/vue'
import { icons as mdiIcons } from '@iconify-json/mdi'
import { CATEGORY_ICON_OPTIONS, DEFAULT_CATEGORY_ICON } from '@/constants/category-icons'

/** 仅打包分类用到的 mdi 图标，避免运行时请求 CDN */
export function registerCategoryIcons() {
  const needed = new Set<string>()
  for (const option of CATEGORY_ICON_OPTIONS) {
    if (option.name.startsWith('mdi:')) needed.add(option.name.slice(4))
  }
  if (DEFAULT_CATEGORY_ICON.startsWith('mdi:')) {
    needed.add(DEFAULT_CATEGORY_ICON.slice(4))
  }

  const body: Record<string, (typeof mdiIcons.icons)[string]> = {}
  for (const name of needed) {
    const data = mdiIcons.icons[name]
    if (data) body[name] = data
  }

  addCollection({
    prefix: 'mdi',
    icons: body,
    width: mdiIcons.width,
    height: mdiIcons.height,
  })
}
