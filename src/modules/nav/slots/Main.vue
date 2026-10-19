<script setup lang="ts">
import { inject } from 'vue'
import { useNavStore } from '@/stores/nav'
import SiteGrid from '@/components/site/SiteGrid.vue'
import { NAV_MAIN_HANDLERS_KEY } from '../host-context'

const nav = useNavStore()
const handlers = inject(NAV_MAIN_HANDLERS_KEY)
</script>

<template>
  <div v-if="!nav.ready" class="nav-main-loading">
    <el-skeleton :rows="8" animated />
  </div>
  <SiteGrid
    v-else-if="handlers"
    @edit-site="handlers.openEditSite"
    @remove-site="handlers.removeSite"
    @edit-category="handlers.openEditCategory"
    @remove-category="handlers.removeCategory"
  />
</template>

<style scoped lang="scss">
.nav-main-loading {
  padding: 24px;
}
</style>
