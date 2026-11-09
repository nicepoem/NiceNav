<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import type { Site } from '@nice-nav/core'
import { useNavStore } from '@/stores/nav'
import CategorySection from './CategorySection.vue'

const emit = defineEmits<{
  editSite: [site: Site]
  removeSite: [site: Site]
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
    // 等待 DOM patch 完成后再收集 .cat-block，否则会拿到旧节点
    await nextTick()
    setupObserver()
  },
)

onUnmounted(() => observer?.disconnect())
</script>

<template>
  <div class="grid-wrap">
    <CategorySection
      v-for="(node, i) in sections"
      :key="node.id"
      :node="node"
      :style="{ '--cat-enter-delay': `${Math.min(i * 60, 420)}ms` }"
      @edit-site="emit('editSite', $event)"
      @remove-site="emit('removeSite', $event)"
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
  /* 顶距由玻璃带承担；左右与顶栏 chrome 对齐 */
  padding: 0 var(--nn-sidebar-gap) 48px 0;
  box-sizing: border-box;
}

@media (max-width: 900px) {
  .grid-wrap {
    padding: 0 6px 36px;
    gap: 12px;
  }
}
</style>
