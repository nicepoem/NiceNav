<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import type { Category } from '@nice-nav/core'
import { useNavStore } from '@/stores/nav'
import IconPicker from '@/components/site/IconPicker.vue'
import NavIcon from '@/components/common/NavIcon.vue'

const props = defineProps<{
  modelValue: boolean
  category?: Category | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const nav = useNavStore()
const form = reactive({
  id: '' as string | undefined,
  name: '',
  icon: '',
  parentId: null as string | null,
})

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const isEdit = computed(() => Boolean(props.category?.id))
const dialogTitle = computed(() => (isEdit.value ? '编辑分类' : '添加分类'))
const dialogHint = computed(() =>
  isEdit.value ? '调整名称、上级分类或图标' : '创建分类以组织你的网址',
)

/** 不能选自己或自己的子孙作为父级 */
const parentOptions = computed(() => {
  const selfId = form.id
  const blocked = new Set<string>()
  if (selfId) {
    const stack = [selfId]
    while (stack.length) {
      const id = stack.pop()!
      blocked.add(id)
      nav.categories
        .filter((c) => c.parentId === id)
        .forEach((c) => stack.push(c.id))
    }
  }
  return nav.rootCategories.filter((c) => !blocked.has(c.id))
})

watch(
  () => [props.modelValue, props.category] as const,
  ([open]) => {
    if (!open) return
    form.id = props.category?.id
    form.name = props.category?.name ?? ''
    form.icon = props.category?.icon ?? ''
    form.parentId = props.category?.parentId ?? null
  },
)

async function submit() {
  if (!form.name.trim()) {
    ElMessage.warning('请填写分类名称')
    return
  }
  await nav.upsertCategory({
    id: form.id,
    name: form.name.trim(),
    icon: form.icon.trim() || undefined,
    parentId: form.parentId,
  })
  ElMessage.success(isEdit.value ? '分类已更新' : '分类已添加')
  visible.value = false
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
        <span class="nn-field-label">名称 <em>*</em></span>
        <div class="nn-field">
          <input
            v-model="form.name"
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
            v-model="form.parentId"
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
              <span class="parent-option">
                <NavIcon :icon="cat.icon" :size="16" />
                {{ cat.name }}
              </span>
            </el-option>
          </el-select>
        </div>
      </label>

      <div class="nn-field-block">
        <span class="nn-field-label">图标</span>
        <IconPicker v-model="form.icon" />
      </div>
    </div>

    <template #footer>
      <div class="nn-dlg-foot">
        <button type="button" class="nn-btn nn-btn--ghost" @click="visible = false">
          取消
        </button>
        <button type="button" class="nn-btn nn-btn--primary" @click="submit">
          {{ isEdit ? '保存修改' : '添加分类' }}
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.parent-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
</style>
