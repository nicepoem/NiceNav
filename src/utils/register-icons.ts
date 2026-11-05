import { addCollection } from '@iconify/vue'
import mdiSubset from '@/assets/icons/mdi-subset.json'

/** 仅注册分类用到的 mdi 子集（构建产物），避免打入完整 @iconify-json/mdi */
export function registerCategoryIcons() {
  addCollection(mdiSubset as Parameters<typeof addCollection>[0])
}
