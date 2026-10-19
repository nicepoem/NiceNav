<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { DEFAULT_CATEGORY_ICON, isIconifyName } from '@/constants/category-icons'

const props = withDefaults(
  defineProps<{
    icon?: string | null
    size?: number | string
  }>(),
  {
    size: 18,
  },
)

const kind = computed(() => {
  if (isIconifyName(props.icon)) return 'iconify' as const
  if (props.icon?.trim()) return 'text' as const
  return 'fallback' as const
})

const iconifyName = computed(() =>
  kind.value === 'iconify' ? props.icon!.trim() : DEFAULT_CATEGORY_ICON,
)
</script>

<template>
  <Icon
    v-if="kind === 'iconify' || kind === 'fallback'"
    class="nav-icon"
    :icon="iconifyName"
    :width="size"
    :height="size"
  />
  <span v-else class="nav-icon nav-icon--text" :style="{ fontSize: `${size}px` }">
    {{ icon }}
  </span>
</template>

<style scoped>
.nav-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 1;
  vertical-align: middle;
}

.nav-icon--text {
  font-style: normal;
}
</style>
