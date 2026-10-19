<script setup lang="ts">
import { computed, inject } from 'vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import { NAV_HOST_KEY } from '../host-context'

const host = inject(NAV_HOST_KEY)
const mobileOpen = computed(() => host?.mobileOpen.value ?? false)

function setMobile(open: boolean) {
  if (host) host.mobileOpen.value = open
}
</script>

<template>
  <AppSidebar
    :mobile-open="mobileOpen"
    @open-mobile="setMobile(true)"
    @close-mobile="setMobile(false)"
  />
</template>
