<script setup lang="ts">
import { defineAsyncComponent, provide, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { Category, Site } from '@nice-nav/core'
import { useNavStore } from '@/stores/nav'
import ModuleHost from '@/modules/ModuleHost.vue'
import { NAV_HOST_KEY, NAV_MAIN_HANDLERS_KEY } from '@/modules/nav'
import FloatingDock from '@/components/layout/FloatingDock.vue'
import { confirmDeleteSite } from '@/utils/confirm-delete'

const SiteFormDialog = defineAsyncComponent(() => import('@/components/site/SiteFormDialog.vue'))
const CategoryManagerDialog = defineAsyncComponent(
  () => import('@/components/site/CategoryManagerDialog.vue'),
)
const CreateFormDialog = defineAsyncComponent(() => import('@/components/site/CreateFormDialog.vue'))
const ImportDialog = defineAsyncComponent(() => import('@/components/site/ImportDialog.vue'))

const nav = useNavStore()
const mobileOpen = ref(false)
const createDialog = ref(false)
const siteDialog = ref(false)
const categoryManagerDialog = ref(false)
const settingsDialog = ref(false)
const editingSite = ref<Site | null>(null)
const preferCategoryId = ref<string | undefined>()

function openAddSite(category?: Category) {
  preferCategoryId.value = category?.id ?? nav.activeCategoryId ?? undefined
  if (!nav.categories.length) {
    ElMessage.warning('请先在分类管理中添加一个分类')
    categoryManagerDialog.value = true
    return
  }
  createDialog.value = true
}

function openEditSite(site: Site) {
  editingSite.value = site
  preferCategoryId.value = undefined
  siteDialog.value = true
}

async function removeSite(site: Site) {
  try {
    await confirmDeleteSite(site.title)
    await nav.removeSite(site.id)
    ElMessage.success('已删除')
  } catch {
    // cancelled
  }
}

function openManageCategories() {
  categoryManagerDialog.value = true
}

function openSettings() {
  settingsDialog.value = true
}

provide(NAV_HOST_KEY, {
  mobileOpen,
  openAddSite: () => openAddSite(),
  openManageCategories,
  openSettings,
})

provide(NAV_MAIN_HANDLERS_KEY, {
  openEditSite,
  removeSite,
})
</script>

<template>
  <ModuleHost module-id="nav">
    <CreateFormDialog
      v-if="createDialog"
      v-model="createDialog"
      :categories="nav.categories"
      :prefer-category-id="preferCategoryId"
    />
    <SiteFormDialog
      v-if="siteDialog"
      v-model="siteDialog"
      :site="editingSite"
      :categories="nav.categories"
      :prefer-category-id="preferCategoryId"
    />
    <CategoryManagerDialog v-if="categoryManagerDialog" v-model="categoryManagerDialog" />
    <ImportDialog v-if="settingsDialog" v-model="settingsDialog" />
    <FloatingDock
      @add-site="openAddSite()"
      @manage-categories="openManageCategories()"
      @open-settings="openSettings"
    />
  </ModuleHost>
</template>
