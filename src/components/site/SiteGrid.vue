<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import type { Category, Site } from '@nice-nav/core'
import { useNavStore } from '@/stores/nav'
import CategorySection from './CategorySection.vue'

const emit = defineEmits<{
  editSite: [site: Site]
  removeSite: [site: Site]
  editCategory: [category: Category]
  removeCategory: [category: Category]
}>()

const nav = useNavStore()

/** 内容区只展示一级分类块；搜索时仍按树过滤 */
const sections = computed(() => {
  if (!nav.searchQuery.trim()) return nav.categoryTree
  return nav.categoryTree.filter((node) => {
    const ids = [node.id, ...node.children.map((c) => c.id)]
    return ids.some((id) => (nav.sitesByCategory.get(id)?.length ?? 0) > 0)
  })
})

let observer: IntersectionObserver | null = null

function setupObserver() {
  observer?.disconnect()
  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      const first = visible[0]
      if (first?.target.id.startsWith('category-')) {
        nav.activeCategoryId = first.target.id.replace('category-', '')
      }
    },
    {
      rootMargin: '-15% 0px -65% 0px',
      threshold: [0, 0.2, 0.5],
    },
  )
  // 只观察一级分类块，避免子分类 tab 的 id 干扰滚动定位
  document.querySelectorAll('.cat-block[id^="category-"]').forEach((el) => observer?.observe(el))
}

onMounted(() => setupObserver())

watch(
  () => sections.value.map((n) => n.id).join(','),
  async () => {
    await Promise.resolve()
    setupObserver()
  },
)

onUnmounted(() => observer?.disconnect())
</script>

<template>
  <div class="grid-wrap">
    <CategorySection
      v-for="node in sections"
      :key="node.id"
      :node="node"
      @edit-site="emit('editSite', $event)"
      @remove-site="emit('removeSite', $event)"
      @edit-category="emit('editCategory', $event)"
      @remove-category="emit('removeCategory', $event)"
    />

    <el-empty
      v-if="!sections.length"
      description="暂无分类，点击右上角添加"
      :image-size="96"
    />
  </div>
</template>

<style scoped lang="scss">
.grid-wrap {
  display: flex;
  flex-direction: column;
  gap: 18px;
  /* 收紧边距，让内容更贴近参考图的紧凑布局 */
  padding: 12px 12px 48px 8px;
}

@media (max-width: 900px) {
  .grid-wrap {
    padding: 8px 6px 36px;
    gap: 12px;
  }
}
</style>
