<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Link, Close, Loading } from '@element-plus/icons-vue'
import type { Category, Site } from '@nice-nav/core'
import { useNavStore } from '@/stores/nav'
import { useAutoPageMeta } from '@/composables/useAutoPageMeta'
import {
  defaultSiteCategoryId,
  resolveSiteCategoryId,
} from '@/utils/category-select'
import CategoryTreeSelect from '@/components/site/CategoryTreeSelect.vue'

const props = defineProps<{
  modelValue: boolean
  site?: Site | null
  categories: Category[]
  preferCategoryId?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const nav = useNavStore()
const urlProtocol = ref<'https://' | 'http://'>('https://')
const form = reactive({
  id: '' as string | undefined,
  title: '',
  url: '',
  description: '',
  categoryId: '',
  icon: '',
  tags: '',
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
  form,
  urlProtocol,
  getUrlHost: () => form.url,
  setUrlHost: (hostPath) => {
    form.url = hostPath
  },
})

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const isEdit = computed(() => Boolean(props.site?.id))
const dialogTitle = computed(() => (isEdit.value ? '编辑网址' : '添加网址'))
const dialogHint = computed(() =>
  isEdit.value
    ? '修改链接后自动识别标题与简介'
    : '粘贴链接后自动识别标题与简介',
)

function splitUrl(raw: string) {
  const value = raw.trim()
  if (/^https:\/\//i.test(value)) {
    urlProtocol.value = 'https://'
    return value.replace(/^https:\/\//i, '')
  }
  if (/^http:\/\//i.test(value)) {
    urlProtocol.value = 'http://'
    return value.replace(/^http:\/\//i, '')
  }
  urlProtocol.value = 'https://'
  return value
}

watch(
  () => [props.modelValue, props.site, props.preferCategoryId] as const,
  ([open]) => {
    if (!open) return
    runHydrate(() => {
      const site = props.site
      form.id = site?.id
      form.title = site?.title ?? ''
      form.url = site?.url ? splitUrl(site.url) : ''
      if (!site?.url) urlProtocol.value = 'https://'
      form.description = site?.description ?? ''
      form.categoryId = site?.categoryId
        ? resolveSiteCategoryId(site.categoryId, props.categories)
        : defaultSiteCategoryId(props.categories, props.preferCategoryId)
      form.icon = site?.icon ?? ''
      form.tags = site?.tags?.join(', ') ?? ''
    })
  },
)

async function submit() {
  if (!form.title.trim() || !form.url.trim() || !form.categoryId) {
    ElMessage.warning('请填写标题、链接和分类')
    return
  }
  try {
    const host = form.url.trim().replace(/^https?:\/\//i, '')
    const url = `${urlProtocol.value}${host}`
    new URL(url)

    const categoryId = resolveSiteCategoryId(form.categoryId, props.categories)
    if (!categoryId) {
      ElMessage.warning('请选择分类')
      return
    }

    await nav.upsertSite({
      id: form.id,
      title: form.title.trim(),
      url,
      description: form.description.trim() || undefined,
      categoryId,
      icon: form.icon.trim() || undefined,
      tags: form.tags
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean),
    })
    nav.activeCategoryId = categoryId
    ElMessage.success(isEdit.value ? '已更新网址' : '已添加网址')
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
        <div>
          <h2 class="nn-dlg-head__title">{{ dialogTitle }}</h2>
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

    <div class="nn-dlg-body">
      <label class="nn-field-block">
        <span class="nn-field-label">
          链接 <em>*</em>
          <span v-if="fetchingMeta" class="meta-fetching">
            <el-icon class="is-loading" :size="12"><Loading /></el-icon>
            正在识别…
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
            v-model="form.url"
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
            v-model="form.title"
            class="nn-field__input"
            type="text"
            placeholder="粘贴链接后自动填写"
            autocomplete="off"
            @input="markTitleTouched"
          />
        </div>
      </label>

      <label class="nn-field-block">
        <span class="nn-field-label">分类 <em>*</em></span>
        <div class="nn-field nn-field--select">
          <CategoryTreeSelect
            v-model="form.categoryId"
            :tree="nav.categoryTree"
            placeholder="选择分类"
          />
        </div>
      </label>

      <label class="nn-field-block">
        <span class="nn-field-label">简介</span>
        <div class="nn-field nn-field--area">
          <textarea
            v-model="form.description"
            class="nn-field__input nn-field__textarea"
            rows="2"
            placeholder="粘贴链接后自动填写（可改）"
            @input="markDescriptionTouched"
          />
        </div>
      </label>

      <div class="dlg-row">
        <label class="nn-field-block">
          <span class="nn-field-label">图标 URL</span>
          <div class="nn-field">
            <input
              v-model="form.icon"
              class="nn-field__input"
              type="url"
              placeholder="留空自动获取 favicon"
              autocomplete="off"
              spellcheck="false"
              @input="markIconTouched"
            />
          </div>
        </label>

        <label class="nn-field-block">
          <span class="nn-field-label">标签</span>
          <div class="nn-field">
            <input
              v-model="form.tags"
              class="nn-field__input"
              type="text"
              placeholder="逗号分隔"
              autocomplete="off"
            />
          </div>
        </label>
      </div>
    </div>

    <template #footer>
      <div class="nn-dlg-foot">
        <button type="button" class="nn-btn nn-btn--ghost" @click="visible = false">
          取消
        </button>
        <button type="button" class="nn-btn nn-btn--primary" @click="submit">
          {{ isEdit ? '保存修改' : '添加网址' }}
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
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
