<script setup lang="ts">
import { onMounted } from 'vue'
import { useNavStore } from '@/stores/nav'
import { useTheme } from '@/composables/useTheme'
import { useBrand } from '@/composables/useBrand'

const nav = useNavStore()
const { initTheme } = useTheme()
const { watchBrand } = useBrand()

watchBrand()

onMounted(async () => {
  await nav.init()
  initTheme()
})
</script>

<template>
  <RouterView />
</template>
