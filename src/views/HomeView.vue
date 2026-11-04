<script setup lang="ts">
import { provide, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { Category, Site } from '@nice-nav/core'
import { useNavStore } from '@/stores/nav'
import ModuleHost from '@/modules/ModuleHost.vue'
import { NAV_HOST_KEY, NAV_MAIN_HANDLERS_KEY } from '@/modules/nav'
import SiteFormDialog from '@/components/site/SiteFormDialog.vue'
import CategoryFormDialog from '@/components/site/CategoryFormDialog.vue'
import CategoryManagerDialog from '@/components/site/CategoryManagerDialog.vue'
import CreateFormDialog from '@/components/site/CreateFormDialog.vue'
import ImportDialog from '@/components/site/ImportDialog.vue'
import FloatingDock from '@/components/layout/FloatingDock.vue'
import { confirmDeleteCategory, confirmDeleteSite } from '@/utils/confirm-delete'

const nav = useNavStore()
const mobileOpen = ref(false)
const createDialog = ref(false)
const siteDialog = ref(false)
const categoryDialog = ref(false)
const categoryManagerDialog = ref(false)
const settingsDialog = ref(false)
const editingSite = ref<Site | null>(null)
const editingCategory = ref<Category | null>(null)
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

function openEditCategory(category: Category) {
  editingCategory.value = category
  categoryDialog.value = true
}

async function removeCategory(category: Category) {
  try {
    await confirmDeleteCategory(category.name, nav.childrenOf(category.id).length)
    await nav.removeCategory(category.id)
    ElMessage.success('分类已删除')
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
  openEditCategory,
  removeCategory,
  openAddSite,
})
</script>

<template>
  <ModuleHost module-id="nav">
    <CreateFormDialog
      v-model="createDialog"
      :categories="nav.categories"
      :prefer-category-id="preferCategoryId"
    />
    <SiteFormDialog
      v-model="siteDialog"
      :site="editingSite"
      :categories="nav.categories"
      :prefer-category-id="preferCategoryId"
    />
    <CategoryFormDialog v-model="categoryDialog" :category="editingCategory" />
    <CategoryManagerDialog v-model="categoryManagerDialog" />
    <ImportDialog v-model="settingsDialog" />
    <FloatingDock
      @add-site="openAddSite()"
      @manage-categories="openManageCategories()"
      @open-settings="openSettings"
    />
  </ModuleHost>
</template>
