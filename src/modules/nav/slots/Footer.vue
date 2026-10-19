<script setup lang="ts">
import { useBrand } from '@/composables/useBrand'

const { siteName } = useBrand()
</script>

<template>
  <p class="nav-footer">{{ siteName }} · 本地导航</p>
</template>

<style scoped lang="scss">
.nav-footer {
  margin: 0;
}
</style>
