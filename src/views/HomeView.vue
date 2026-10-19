<script setup lang="ts">
import { provide, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Category, Site } from '@nice-nav/core'
import { useNavStore } from '@/stores/nav'
import ModuleHost from '@/modules/ModuleHost.vue'
import { NAV_HOST_KEY, NAV_MAIN_HANDLERS_KEY } from '@/modules/nav'
import SiteFormDialog from '@/components/site/SiteFormDialog.vue'
import CategoryFormDialog from '@/components/site/CategoryFormDialog.vue'
import CategoryManagerDialog from '@/components/site/CategoryManagerDialog.vue'
import CreateFormDialog, {
  type CreateTab,
} from '@/components/site/CreateFormDialog.vue'
import ImportDialog from '@/components/site/ImportDialog.vue'
import FloatingDock from '@/components/layout/FloatingDock.vue'

const nav = useNavStore()
const mobileOpen = ref(false)
const createDialog = ref(false)
const createTab = ref<CreateTab>('site')
const siteDialog = ref(false)
const categoryDialog = ref(false)
const categoryManagerDialog = ref(false)
const importDialog = ref(false)
const editingSite = ref<Site | null>(null)
const editingCategory = ref<Category | null>(null)
const preferCategoryId = ref<string | undefined>()

function openCreate(tab: CreateTab = 'site', category?: Category) {
  createTab.value = tab
  // 有子分类的一级会在选择器里落到子级；优先用当前激活分类
  preferCategoryId.value = category?.id ?? nav.activeCategoryId ?? undefined
  if (tab === 'site' && !nav.categories.length) {
    ElMessage.warning('请先添加一个分类')
    createTab.value = 'category'
  }
  createDialog.value = true
}

function openAddSite(category?: Category) {
  openCreate('site', category)
}

function openEditSite(site: Site) {
  editingSite.value = site
  preferCategoryId.value = undefined
  siteDialog.value = true
}

async function removeSite(site: Site) {
  try {
    await ElMessageBox.confirm(`确定删除「${site.title}」？`, '删除网址', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
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
  const childCount = nav.childrenOf(category.id).length
  const tip =
    childCount > 0
      ? `删除「${category.name}」将同时删除其 ${childCount} 个子分类及下属网址，是否继续？`
      : `删除分类「${category.name}」将同时删除其下所有网址，是否继续？`
  try {
    await ElMessageBox.confirm(tip, '删除分类', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await nav.removeCategory(category.id)
    ElMessage.success('分类已删除')
  } catch {
    // cancelled
  }
}

function openManageCategories() {
  categoryManagerDialog.value = true
}

provide(NAV_HOST_KEY, {
  mobileOpen,
  openAddSite: () => openAddSite(),
  openManageCategories,
  openImportData: () => {
    importDialog.value = true
  },
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
      :initial-tab="createTab"
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
    <ImportDialog v-model="importDialog" />
    <FloatingDock
      @add-site="openAddSite()"
      @manage-categories="openManageCategories()"
    />
  </ModuleHost>
</template>
