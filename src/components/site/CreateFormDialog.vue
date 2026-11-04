<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Link, Close, Loading } from '@element-plus/icons-vue'
import type { Category } from '@nice-nav/core'
import { useNavStore } from '@/stores/nav'
import { useAutoPageMeta } from '@/composables/useAutoPageMeta'
import {
  defaultSiteCategoryId,
  resolveSiteCategoryId,
} from '@/utils/category-select'
import CategoryTreeSelect from '@/components/site/CategoryTreeSelect.vue'

const props = defineProps<{
  modelValue: boolean
  categories: Category[]
  preferCategoryId?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const nav = useNavStore()
const urlProtocol = ref<'https://' | 'http://'>('https://')

const siteForm = reactive({
  title: '',
  url: '',
  description: '',
  categoryId: '',
  icon: '',
})

const {
  fetchingMeta,
  markTitleTouched,
  markDescriptionTouched,
  markIconTouched,
  runHydrate,
  scheduleFetch,
  fetchNow,
} = useAutoPageMeta({
  form: siteForm,
  urlProtocol,
  getUrlHost: () => siteForm.url,
  setUrlHost: (hostPath) => {
    siteForm.url = hostPath
  },
})

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

function resetSiteForm() {
  runHydrate(() => {
    siteForm.title = ''
    siteForm.url = ''
    siteForm.description = ''
    siteForm.categoryId = defaultSiteCategoryId(
      props.categories,
      props.preferCategoryId,
    )
    siteForm.icon = ''
    urlProtocol.value = 'https://'
  })
}

watch(
  () => [props.modelValue, props.preferCategoryId] as const,
  ([open]) => {
    if (!open) return
    resetSiteForm()
    if (props.preferCategoryId) {
      siteForm.categoryId = defaultSiteCategoryId(
        props.categories,
        props.preferCategoryId,
      )
    }
  },
)

async function submit() {
  if (!props.categories.length) {
    ElMessage.warning('请先添加一个分类（可在分类管理中创建）')
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

    const categoryId = resolveSiteCategoryId(
      siteForm.categoryId,
      props.categories,
    )
    if (!categoryId) {
      ElMessage.warning('请选择分类')
      return
    }

    await nav.upsertSite({
      title: siteForm.title.trim(),
      url,
      description: siteForm.description.trim() || undefined,
      categoryId,
      icon: siteForm.icon.trim() || undefined,
      tags: [],
    })
    nav.activeCategoryId = categoryId
    ElMessage.success('已添加网址')
    visible.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    width="520px"
    align-center
    destroy-on-close
    class="nn-dialog"
    :show-close="false"
  >
    <template #header>
      <div class="nn-dlg-head">
        <h2 class="nn-dlg-head__title">添加网址</h2>
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

    <div class="nn-dlg-body">
      <label class="nn-field-block">
        <span class="nn-field-label">
          链接 <em>*</em>
          <span v-if="fetchingMeta" class="meta-fetching">
            <el-icon class="is-loading" :size="12"><Loading /></el-icon>
            识别中…
          </span>
        </span>
        <div class="nn-field nn-field--url">
          <el-icon class="nn-field__icon" :size="16"><Link /></el-icon>
          <div class="nn-seg" role="group" aria-label="协议">
            <button
              type="button"
              class="nn-seg__btn"
              :class="{ active: urlProtocol === 'https://' }"
              @click="urlProtocol = 'https://'; scheduleFetch(120)"
            >
              Https
            </button>
            <button
              type="button"
              class="nn-seg__btn"
              :class="{ active: urlProtocol === 'http://' }"
              @click="urlProtocol = 'http://'; scheduleFetch(120)"
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
            @input="scheduleFetch()"
            @blur="fetchNow()"
          />
        </div>
      </label>

      <label class="nn-field-block">
        <span class="nn-field-label">标题 <em>*</em></span>
        <div class="nn-field">
          <input
            v-model="siteForm.title"
            class="nn-field__input"
            type="text"
            placeholder="网站标题"
            autocomplete="off"
            @input="markTitleTouched"
          />
        </div>
      </label>

      <label class="nn-field-block">
        <span class="nn-field-label">分类 <em>*</em></span>
        <div class="nn-field nn-field--select">
          <CategoryTreeSelect
            v-model="siteForm.categoryId"
            :tree="nav.categoryTree"
            placeholder="选择分类"
          />
        </div>
      </label>

      <label class="nn-field-block">
        <span class="nn-field-label">简介</span>
        <div class="nn-field nn-field--area">
          <textarea
            v-model="siteForm.description"
            class="nn-field__input nn-field__textarea"
            rows="3"
            placeholder="可选"
            @input="markDescriptionTouched"
          />
        </div>
      </label>

      <label class="nn-field-block">
        <span class="nn-field-label">图标</span>
        <div class="nn-field">
          <input
            v-model="siteForm.icon"
            class="nn-field__input"
            type="url"
            placeholder="留空自动获取"
            autocomplete="off"
            spellcheck="false"
            @input="markIconTouched"
          />
        </div>
      </label>
    </div>

    <template #footer>
      <div class="nn-dlg-foot">
        <button type="button" class="nn-btn nn-btn--ghost" @click="visible = false">
          取消
        </button>
        <button type="button" class="nn-btn nn-btn--primary" @click="submit">
          添加
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.nn-field--url {
  padding-right: 6px;
}

.meta-fetching {
  margin-left: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--nn-primary);
  font-style: normal;
}
</style>
