<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useNavStore } from '@/stores/nav'
import BlockShell from '@/layouts/BlockShell.vue'
import { getModule } from './registry'

const props = defineProps<{
  /** 覆盖路由 meta.moduleId */
  moduleId?: string
  debugOutline?: boolean
}>()

const route = useRoute()
const nav = useNavStore()

const mod = computed(() => {
  const id = props.moduleId || route.meta.moduleId
  return id ? getModule(id) : undefined
})

const slots = computed(() => mod.value?.slots ?? {})
const showLeft = computed(() => mod.value?.showLeft !== false)
const showRight = computed(() => Boolean(mod.value?.showRight && slots.value.rightSidebar))
const collapsed = computed(() => nav.settings.sidebarCollapsed)
</script>

<template>
  <BlockShell
    v-if="mod"
    :show-left="showLeft"
    :show-right="showRight"
    :collapsed="collapsed"
    :debug-outline="debugOutline"
  >
    <template v-if="slots.topNav" #topNav>
      <component :is="slots.topNav" />
    </template>
    <template v-if="slots.topFull" #topFull>
      <component :is="slots.topFull" />
    </template>
    <template v-if="slots.leftSidebar" #leftSidebar>
      <component :is="slots.leftSidebar" />
    </template>
    <template v-if="slots.mainTop" #mainTop>
      <component :is="slots.mainTop" />
    </template>
    <template v-if="slots.main" #main>
      <component :is="slots.main" />
    </template>
    <template v-if="slots.mainBottom" #mainBottom>
      <component :is="slots.mainBottom" />
    </template>
    <template v-if="slots.rightSidebar" #rightSidebar>
      <component :is="slots.rightSidebar" />
    </template>
    <template v-if="slots.bottomFull" #bottomFull>
      <component :is="slots.bottomFull" />
    </template>
    <template v-if="slots.footer" #footer>
      <component :is="slots.footer" />
    </template>

    <slot />
  </BlockShell>
  <div v-else class="module-missing">
    未找到模块「{{ moduleId || route.meta.moduleId || '?' }}」
  </div>
</template>

<style scoped lang="scss">
.module-missing {
  padding: 48px 24px;
  text-align: center;
  color: var(--el-text-color-secondary);
}
</style>
