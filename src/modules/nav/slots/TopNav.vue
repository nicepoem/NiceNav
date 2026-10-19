<script setup lang="ts">
import { inject } from 'vue'
import SidebarBrand from '@/components/layout/SidebarBrand.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import { NAV_HOST_KEY } from '../host-context'

const host = inject(NAV_HOST_KEY)
</script>

<template>
  <div class="nav-top-nav">
    <div class="nav-top-nav__chrome">
      <SidebarBrand class="nav-top-nav__brand" />
      <AppHeader
        class="nav-top-nav__header"
        @open-mobile="host && (host.mobileOpen.value = true)"
        @add-site="host?.openAddSite()"
        @import-data="host?.openImportData()"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.nav-top-nav {
  padding: var(--nn-sidebar-gap) var(--nn-sidebar-gap) 0;
  box-sizing: border-box;
  background: transparent;
}

.nav-top-nav__chrome {
  display: flex;
  align-items: stretch;
  height: var(--nn-header-height);
  border-radius: var(--nn-header-radius, 12px);
  background-color: var(--nn-header-glass-bg);
  border: 0.666667px solid var(--nn-header-glass-border);
  box-shadow: var(--nn-header-shadow);
  backdrop-filter: blur(var(--nn-header-blur, 6px));
  -webkit-backdrop-filter: blur(var(--nn-header-blur, 6px));
  box-sizing: border-box;
  overflow: hidden;
  color: var(--el-text-color-regular);
}

.nav-top-nav__brand {
  flex-shrink: 0;
  width: var(--nn-sidebar-width);
}

.nav-top-nav__header {
  flex: 1;
  min-width: 0;
  box-shadow: none !important;
}

@media (max-width: 900px) {
  .nav-top-nav__brand {
    display: none;
  }

  .nav-top-nav {
    padding: 8px 6px 0;
  }
}
</style>
