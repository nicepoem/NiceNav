<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Link, Close } from '@element-plus/icons-vue'
import type { Category } from '@nice-nav/core'
import { useNavStore } from '@/stores/nav'
import IconPicker from '@/components/site/IconPicker.vue'
import NavIcon from '@/components/common/NavIcon.vue'

export type CreateTab = 'site' | 'category'

const props = defineProps<{
  modelValue: boolean
  /** 打开时默认选中的 tab */
  initialTab?: CreateTab
  categories: Category[]
  preferCategoryId?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const nav = useNavStore()
const activeTab = ref<CreateTab>('site')
const urlProtocol = ref<'https://' | 'http://'>('https://')

const siteForm = reactive({
  title: '',
  url: '',
  description: '',
  categoryId: '',
  icon: '',
  tags: '',
})

const categoryForm = reactive({
  name: '',
  icon: '',
  parentId: null as string | null,
})

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const dialogHint = computed(() =>
  activeTab.value === 'site'
    ? '填写站点信息，保存到本地导航'
    : '创建分类以组织你的网址',
)

const parentOptions = computed(() => nav.rootCategories)

function resetSiteForm() {
  siteForm.title = ''
  siteForm.url = ''
  siteForm.description = ''
  siteForm.categoryId =
    props.preferCategoryId ?? props.categories[0]?.id ?? ''
  siteForm.icon = ''
  siteForm.tags = ''
  urlProtocol.value = 'https://'
}

function resetCategoryForm() {
  categoryForm.name = ''
  categoryForm.icon = ''
  categoryForm.parentId = null
}

watch(
  () => [props.modelValue, props.initialTab, props.preferCategoryId] as const,
  ([open]) => {
    if (!open) return
    activeTab.value = props.initialTab === 'category' ? 'category' : 'site'
    resetSiteForm()
    resetCategoryForm()
    // preferCategoryId 可能在 open 后才写入，再同步一次
    if (props.preferCategoryId) {
      siteForm.categoryId = props.preferCategoryId
    }
  },
)

async function submitSite() {
  if (!props.categories.length) {
    ElMessage.warning('请先添加一个分类')
    activeTab.value = 'category'
    return
  }
  if (!siteForm.title.trim() || !siteForm.url.trim() || !siteForm.categoryId) {
    ElMessage.warning('请填写标题、链接和分类')
    return
  }
  try {
    const host = siteForm.url.trim().replace(/^https?:\/\//i, '')
    const url = `${urlProtocol.value}${host}`
    new URL(url)

    await nav.upsertSite({
      title: siteForm.title.trim(),
      url,
      description: siteForm.description.trim() || undefined,
      categoryId: siteForm.categoryId,
      icon: siteForm.icon.trim() || undefined,
      tags: siteForm.tags
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean),
    })
    ElMessage.success('已添加网址')
    visible.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

async function submitCategory() {
  if (!categoryForm.name.trim()) {
    ElMessage.warning('请填写分类名称')
    return
  }
  await nav.upsertCategory({
    name: categoryForm.name.trim(),
    icon: categoryForm.icon.trim() || undefined,
    parentId: categoryForm.parentId,
  })
  ElMessage.success('分类已添加')
  visible.value = false
}

function submit() {
  if (activeTab.value === 'site') void submitSite()
  else void submitCategory()
}
</script>

<template>
  <el-dialog
    v-model="visible"
    width="560px"
    align-center
    destroy-on-close
    class="nn-dialog"
    :show-close="false"
  >
    <template #header>
      <div class="nn-dlg-head">
        <div class="create-head">
          <div class="nn-seg create-tabs" role="tablist" aria-label="添加类型">
            <button
              type="button"
              role="tab"
              class="nn-seg__btn"
              :class="{ active: activeTab === 'site' }"
              :aria-selected="activeTab === 'site'"
              @click="activeTab = 'site'"
            >
              添加网址
            </button>
            <button
              type="button"
              role="tab"
              class="nn-seg__btn"
              :class="{ active: activeTab === 'category' }"
              :aria-selected="activeTab === 'category'"
              @click="activeTab = 'category'"
            >
              添加分类
            </button>
          </div>
          <p class="nn-dlg-head__hint">{{ dialogHint }}</p>
        </div>
        <button
          type="button"
          class="nn-dlg-head__close"
          aria-label="关闭"
          @click="visible = false"
        >
          <el-icon :size="16"><Close /></el-icon>
        </button>
      </div>
    </template>

    <!-- 添加网址 -->
    <div v-show="activeTab === 'site'" class="nn-dlg-body">
      <label class="nn-field-block">
        <span class="nn-field-label">标题 <em>*</em></span>
        <div class="nn-field">
          <input
            v-model="siteForm.title"
            class="nn-field__input"
            type="text"
            placeholder="例如 GitHub"
            autocomplete="off"
          />
        </div>
      </label>

      <label class="nn-field-block">
        <span class="nn-field-label">链接 <em>*</em></span>
        <div class="nn-field nn-field--url">
          <el-icon class="nn-field__icon" :size="16"><Link /></el-icon>
          <div class="nn-seg" role="group" aria-label="协议">
            <button
              type="button"
              class="nn-seg__btn"
              :class="{ active: urlProtocol === 'https://' }"
              @click="urlProtocol = 'https://'"
            >
              Https
            </button>
            <button
              type="button"
              class="nn-seg__btn"
              :class="{ active: urlProtocol === 'http://' }"
              @click="urlProtocol = 'http://'"
            >
              Http
            </button>
          </div>
          <input
            v-model="siteForm.url"
            class="nn-field__input"
            type="text"
            placeholder="example.com/path"
            autocomplete="off"
            spellcheck="false"
          />
        </div>
      </label>

      <label class="nn-field-block">
        <span class="nn-field-label">分类 <em>*</em></span>
        <div class="nn-field nn-field--select">
          <el-select
            v-model="siteForm.categoryId"
            placeholder="选择分类"
            teleported
            popper-class="nn-select-popper"
          >
            <el-option
              v-for="cat in categories"
              :key="cat.id"
              :label="cat.name"
              :value="cat.id"
            >
              <span class="option-row">
                <NavIcon :icon="cat.icon" :size="16" />
                {{ cat.name }}
              </span>
            </el-option>
          </el-select>
        </div>
      </label>

      <label class="nn-field-block">
        <span class="nn-field-label">简介</span>
        <div class="nn-field nn-field--area">
          <textarea
            v-model="siteForm.description"
            class="nn-field__input nn-field__textarea"
            rows="2"
            placeholder="一句话介绍这个站点（可选）"
          />
        </div>
      </label>

      <div class="dlg-row">
        <label class="nn-field-block">
          <span class="nn-field-label">图标 URL</span>
          <div class="nn-field">
            <input
              v-model="siteForm.icon"
              class="nn-field__input"
              type="url"
              placeholder="留空自动获取 favicon"
              autocomplete="off"
              spellcheck="false"
            />
          </div>
        </label>

        <label class="nn-field-block">
          <span class="nn-field-label">标签</span>
          <div class="nn-field">
            <input
              v-model="siteForm.tags"
              class="nn-field__input"
              type="text"
              placeholder="逗号分隔"
              autocomplete="off"
            />
          </div>
        </label>
      </div>
    </div>

    <!-- 添加分类 -->
    <div v-show="activeTab === 'category'" class="nn-dlg-body">
      <label class="nn-field-block">
        <span class="nn-field-label">名称 <em>*</em></span>
        <div class="nn-field">
          <input
            v-model="categoryForm.name"
            class="nn-field__input"
            type="text"
            placeholder="例如 在线配色"
            autocomplete="off"
          />
        </div>
      </label>

      <label class="nn-field-block">
        <span class="nn-field-label">上级分类</span>
        <div class="nn-field nn-field--select">
          <el-select
            v-model="categoryForm.parentId"
            clearable
            placeholder="不选则为一级分类"
            teleported
            popper-class="nn-select-popper"
          >
            <el-option
              v-for="cat in parentOptions"
              :key="cat.id"
              :label="cat.name"
              :value="cat.id"
            >
              <span class="option-row">
                <NavIcon :icon="cat.icon" :size="16" />
                {{ cat.name }}
              </span>
            </el-option>
          </el-select>
        </div>
      </label>

      <div class="nn-field-block">
        <span class="nn-field-label">图标</span>
        <IconPicker v-model="categoryForm.icon" />
      </div>
    </div>

    <template #footer>
      <div class="nn-dlg-foot">
        <button type="button" class="nn-btn nn-btn--ghost" @click="visible = false">
          取消
        </button>
        <button type="button" class="nn-btn nn-btn--primary" @click="submit">
          {{ activeTab === 'site' ? '添加网址' : '添加分类' }}
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.create-head {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.create-tabs {
  align-self: flex-start;
}

.nn-field--url {
  padding-right: 6px;
}

.dlg-row {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 12px;

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
}

.option-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
</style>
