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
        @manage-categories="host?.openManageCategories()"
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
  align-items: center;
  height: var(--nn-header-height);
  border-radius: var(--nn-header-radius, var(--nn-sidebar-radius, 12px));
  background: var(--nn-chrome-bg, var(--nn-elevated-bg));
  border: none;
  box-shadow: var(--nn-chrome-shadow, var(--nn-elevated-shadow));
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-sizing: border-box;
  overflow: hidden;
  color: var(--nn-sidebar-text, var(--el-text-color-regular));
}

.nav-top-nav__brand {
  flex-shrink: 0;
  align-self: stretch;
  display: flex;
  width: var(--nn-top-brand-width, var(--nn-sidebar-width));
  transition: width 0.32s var(--nn-drawer-ease, cubic-bezier(0.32, 0.72, 0, 1));
}

.nav-top-nav__header {
  flex: 1;
  align-self: stretch;
  min-width: 0;
  min-height: 0;
  box-shadow: none !important;
}

@media (max-width: 900px) {
  .nav-top-nav {
    padding: 10px 10px 0;
  }

  .nav-top-nav__brand {
    width: auto;
    min-width: 44px;
  }

  .nav-top-nav__chrome {
    height: 52px;
    border-radius: 12px;
  }
}
</style>
