<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Close, UploadFilled } from '@element-plus/icons-vue'
import type { ImportMode } from '@nice-nav/core'
import { useNavStore } from '@/stores/nav'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const nav = useNavStore()
const mode = ref<ImportMode>('merge')
const raw = ref('')
const loading = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const modeHint = computed(() =>
  mode.value === 'merge'
    ? '合并会生成新 ID，避免与现有数据冲突'
    : '覆盖会清空当前全部分类与网址后写入',
)

function onFileChange(file: File) {
  const reader = new FileReader()
  reader.onload = () => {
    raw.value = String(reader.result ?? '')
  }
  reader.readAsText(file)
  return false
}

async function submit() {
  if (!raw.value.trim()) {
    ElMessage.warning('请粘贴或选择 JSON 文件')
    return
  }
  loading.value = true
  try {
    const result = await nav.importBackup(raw.value, mode.value)
    ElMessage.success(
      `导入成功：${result.categories} 个分类，${result.sites} 个网址（${result.mode === 'merge' ? '合并' : '覆盖'}）`,
    )
    visible.value = false
    raw.value = ''
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '导入失败')
  } finally {
    loading.value = false
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
          <h2 class="nn-dlg-head__title">导入数据</h2>
          <p class="nn-dlg-head__hint">从 JSON 备份恢复或合并导航数据</p>
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
      <div class="nn-field-block">
        <span class="nn-field-label">导入模式</span>
        <div class="nn-seg">
          <button
            type="button"
            class="nn-seg__btn"
            :class="{ active: mode === 'merge' }"
            @click="mode = 'merge'"
          >
            合并导入
          </button>
          <button
            type="button"
            class="nn-seg__btn"
            :class="{ active: mode === 'replace' }"
            @click="mode = 'replace'"
          >
            全量覆盖
          </button>
        </div>
        <p class="mode-hint">{{ modeHint }}</p>
      </div>

      <el-upload
        drag
        class="import-upload"
        :auto-upload="false"
        :show-file-list="false"
        accept="application/json,.json"
        :before-upload="onFileChange"
      >
        <el-icon class="import-upload__icon" :size="28"><UploadFilled /></el-icon>
        <div class="import-upload__tip">拖拽 JSON 到此处，或点击选择文件</div>
      </el-upload>

      <label class="nn-field-block">
        <span class="nn-field-label">或粘贴 JSON</span>
        <div class="nn-field nn-field--area">
          <textarea
            v-model="raw"
            class="nn-field__input nn-field__textarea import-json"
            rows="8"
            placeholder="也可直接粘贴备份 JSON"
            spellcheck="false"
          />
        </div>
      </label>
    </div>

    <template #footer>
      <div class="nn-dlg-foot">
        <button type="button" class="nn-btn nn-btn--ghost" @click="visible = false">
          取消
        </button>
        <button
          type="button"
          class="nn-btn nn-btn--primary"
          :disabled="loading"
          @click="submit"
        >
          {{ loading ? '导入中…' : '导入' }}
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.mode-hint {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}

.import-upload {
  width: 100%;

  :deep(.el-upload) {
    width: 100%;
  }

  :deep(.el-upload-dragger) {
    width: 100%;
    padding: 28px 16px;
    border-radius: var(--nn-item-radius, 8px) !important;
    background: var(--nn-section-bg);
    box-shadow: var(--nn-card-inset);
    border: none !important;
  }
}

.import-upload__icon {
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.import-upload__tip {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.import-json {
  min-height: 160px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}
</style>
