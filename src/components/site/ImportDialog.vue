<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { UploadFile } from 'element-plus'
import {
  Close,
  Download,
  Upload,
  DocumentCopy,
  FolderOpened,
  Delete,
} from '@element-plus/icons-vue'
import type { ImportMode } from '@nice-nav/core'
import { useNavStore } from '@/stores/nav'
import { confirmClearAllData } from '@/utils/confirm-delete'

type Panel = 'export' | 'import'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    defaultMode?: ImportMode
  }>(),
  { defaultMode: 'merge' },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const nav = useNavStore()
const panel = ref<Panel>('export')
const mode = ref<ImportMode>(props.defaultMode)
const raw = ref('')
const fileName = ref('')
const loading = ref(false)
const clearing = ref(false)
const showPaste = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    panel.value = 'export'
    mode.value = props.defaultMode
    raw.value = ''
    fileName.value = ''
    showPaste.value = false
  },
)

const stats = computed(() => ({
  categories: nav.categories.length,
  sites: nav.sites.length,
}))

const canImport = computed(() => raw.value.trim().length > 0)

async function exportData() {
  try {
    await nav.exportBackup()
  } catch {
    ElMessage.error('导出备份失败，请重试')
    return
  }
  ElMessage.success('已导出备份')
}

async function clearData() {
  if (stats.value.categories === 0 && stats.value.sites === 0) {
    ElMessage.info('当前没有可清空的数据')
    return
  }
  try {
    await confirmClearAllData(stats.value.categories, stats.value.sites)
  } catch {
    return
  }
  clearing.value = true
  try {
    await nav.clearAll()
    ElMessage.success('已清空全部分类与网址')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '清空失败')
  } finally {
    clearing.value = false
  }
}

function onUploadChange(uploadFile: UploadFile) {
  const file = uploadFile.raw
  if (!file) return
  if (!file.name.toLowerCase().endsWith('.json') && file.type && !file.type.includes('json')) {
    ElMessage.warning('请选择 JSON 备份文件')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    raw.value = String(reader.result ?? '').replace(/^\uFEFF/, '')
    fileName.value = file.name
    if (!raw.value.trim()) {
      ElMessage.warning('文件内容为空')
    }
  }
  reader.onerror = () => {
    ElMessage.error('读取文件失败')
  }
  reader.readAsText(file, 'utf-8')
}

async function submit() {
  if (!canImport.value) {
    ElMessage.warning('请先选择或粘贴 JSON 备份')
    return
  }
  loading.value = true
  try {
    const result = await nav.importBackup(raw.value, mode.value)
    if (result.mode === 'merge' && result.categories === 0 && result.sites === 0) {
      ElMessage.success('导入完成：无新增内容，重复项已跳过')
    } else {
      ElMessage.success(
        `导入成功：${result.categories} 个分类，${result.sites} 个网址（${result.mode === 'merge' ? '合并' : '覆盖'}）`,
      )
    }
    visible.value = false
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
    width="480px"
    align-center
    append-to-body
    destroy-on-close
    class="nn-dialog data-io-dialog"
    :show-close="false"
  >
    <template #header>
      <div class="io-hero">
        <div class="io-hero__text">
          <p class="io-hero__eyebrow">NiceNav</p>
          <h2 class="io-hero__title">数据备份</h2>
        </div>
        <button
          type="button"
          class="io-hero__close"
          aria-label="关闭"
          @click="visible = false"
        >
          <el-icon :size="16"><Close /></el-icon>
        </button>
      </div>
    </template>

    <div class="io-shell">
      <div class="io-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          class="io-tabs__btn"
          :class="{ active: panel === 'export' }"
          :aria-selected="panel === 'export'"
          @click="panel = 'export'"
        >
          <el-icon :size="15"><Download /></el-icon>
          导出
        </button>
        <button
          type="button"
          role="tab"
          class="io-tabs__btn"
          :class="{ active: panel === 'import' }"
          :aria-selected="panel === 'import'"
          @click="panel = 'import'"
        >
          <el-icon :size="15"><Upload /></el-icon>
          导入
        </button>
      </div>

      <div v-if="panel === 'export'" class="io-panel" role="tabpanel">
        <div class="io-stats">
          <div class="io-stat">
            <strong>{{ stats.categories }}</strong>
            <span>分类</span>
          </div>
          <div class="io-stat">
            <strong>{{ stats.sites }}</strong>
            <span>网址</span>
          </div>
        </div>
        <p class="io-copy">将当前导航导出为 JSON 文件，便于备份或迁移到其他设备。</p>
        <div class="io-actions">
          <button type="button" class="io-primary" @click="exportData">
            <el-icon :size="17"><Download /></el-icon>
            下载备份文件
          </button>
          <button
            type="button"
            class="io-danger"
            :disabled="clearing || (stats.categories === 0 && stats.sites === 0)"
            @click="clearData"
          >
            <el-icon :size="16"><Delete /></el-icon>
            {{ clearing ? '清空中…' : '一键清空数据' }}
          </button>
        </div>
      </div>

      <div v-else class="io-panel" role="tabpanel">
        <div class="io-modes">
          <button
            type="button"
            class="io-mode"
            :class="{ active: mode === 'merge' }"
            @click="mode = 'merge'"
          >
            <span class="io-mode__title">合并</span>
            <span class="io-mode__desc">保留现有数据，重复项跳过</span>
          </button>
          <button
            type="button"
            class="io-mode"
            :class="{ active: mode === 'replace' }"
            @click="mode = 'replace'"
          >
            <span class="io-mode__title">覆盖</span>
            <span class="io-mode__desc">清空后写入备份内容</span>
          </button>
        </div>

        <el-upload
          drag
          class="io-drop"
          :auto-upload="false"
          :show-file-list="false"
          accept="application/json,.json,text/json"
          :on-change="onUploadChange"
        >
          <div class="io-drop__inner">
            <el-icon class="io-drop__icon" :size="26">
              <FolderOpened v-if="fileName" />
              <Upload v-else />
            </el-icon>
            <p class="io-drop__title">
              {{ fileName || '拖入或选择 JSON 文件' }}
            </p>
            <p class="io-drop__hint">仅支持 NiceNav 备份格式</p>
          </div>
        </el-upload>

        <button
          type="button"
          class="io-paste-toggle"
          @click="showPaste = !showPaste"
        >
          <el-icon :size="14"><DocumentCopy /></el-icon>
          {{ showPaste ? '收起粘贴' : '改为粘贴 JSON' }}
        </button>

        <textarea
          v-if="showPaste"
          v-model="raw"
          class="io-paste"
          rows="5"
          placeholder="在此粘贴备份 JSON…"
          spellcheck="false"
        />

        <button
          type="button"
          class="io-primary"
          :disabled="loading || !canImport"
          @click="submit"
        >
          {{ loading ? '导入中…' : '开始导入' }}
        </button>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped lang="scss">
.io-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin: -8px -4px 0;
  padding: 4px 4px 2px;
}

.io-hero__eyebrow {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--nn-primary);
}

.io-hero__title {
  margin: 0;
  font-size: 20px;
  font-weight: 750;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
}

.io-hero__close {
  width: 32px;
  height: 32px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: var(--nn-tab-bg);
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition:
    color 0.2s ease,
    background 0.2s ease;

  &:hover {
    color: var(--nn-primary);
    background: var(--nn-item-hover-bg);
  }
}

.io-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.io-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  border-radius: 14px;
  background: var(--nn-tab-bg);
}

.io-tabs__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 38px;
  margin: 0;
  border: 0;
  border-radius: 11px;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
  transition:
    color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;

  &.active {
    color: var(--nn-primary);
    background: var(--nn-section-bg);
  }

  &:hover:not(.active) {
    color: var(--el-text-color-primary);
  }
}

.io-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 220px;
}

.io-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.io-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 16px 14px;
  border-radius: 14px;
  background:
    linear-gradient(
      160deg,
      color-mix(in srgb, var(--nn-primary) 12%, var(--nn-section-bg)) 0%,
      var(--nn-tab-bg) 100%
    );

  strong {
    font-size: 28px;
    font-weight: 750;
    letter-spacing: -0.03em;
    line-height: 1.1;
    color: var(--el-text-color-primary);
  }

  span {
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
  }
}

.io-copy {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--el-text-color-regular);
}

.io-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
}

.io-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 44px;
  margin-top: auto;
  border: 0;
  border-radius: 12px;
  background: var(--nn-primary);
  color: #fff;
  font-size: 14px;
  font-weight: 650;
  cursor: pointer;
  transition:
    filter 0.2s ease,
    transform 0.15s ease,
    opacity 0.2s ease;

  &:hover:not(:disabled) {
    filter: brightness(1.05);
  }

  &:active:not(:disabled) {
    transform: scale(0.985);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.io-actions .io-primary {
  margin-top: 0;
}

.io-danger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 40px;
  margin: 0;
  border: 0;
  border-radius: 12px;
  background: color-mix(in srgb, #f56c6c 10%, var(--nn-tab-bg, #f0f2f5));
  color: #c45656;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
  transition:
    color 0.2s ease,
    background 0.2s ease,
    opacity 0.2s ease;

  &:hover:not(:disabled) {
    color: #fff;
    background: #f56c6c;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.io-modes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.io-mode {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 12px;
  margin: 0;
  border: 1.5px solid transparent;
  border-radius: 12px;
  background: var(--nn-tab-bg);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;

  &.active {
    background: color-mix(in srgb, var(--nn-primary) 8%, var(--nn-section-bg));
  }

  &:hover:not(.active) {
    background: var(--nn-item-hover-bg);
  }
}

.io-mode__title {
  font-size: 13px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.io-mode__desc {
  font-size: 11px;
  line-height: 1.35;
  color: var(--el-text-color-secondary);
}

.io-drop {
  width: 100%;

  :deep(.el-upload) {
    width: 100%;
  }

  :deep(.el-upload-dragger) {
    width: 100%;
    padding: 0 !important;
    border: none !important;
    border-radius: 14px !important;
    background: transparent !important;
  }
}

.io-drop__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 120px;
  padding: 20px 16px;
  border-radius: 14px;
  background: var(--nn-tab-bg);
  box-shadow: none;
  transition:
    background 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    background: color-mix(in srgb, var(--nn-primary) 6%, var(--nn-tab-bg));
    box-shadow: none;
  }
}

.io-drop__icon {
  color: var(--nn-primary);
  margin-bottom: 2px;
}

.io-drop__title {
  margin: 0;
  font-size: 13px;
  font-weight: 650;
  color: var(--el-text-color-primary);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.io-drop__hint {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.io-paste-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  align-self: flex-start;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    color: var(--nn-primary);
  }
}

.io-paste {
  width: 100%;
  min-height: 110px;
  padding: 12px;
  border: 0;
  border-radius: 12px;
  background: var(--nn-tab-bg);
  color: var(--el-text-color-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.45;
  resize: vertical;
  box-sizing: border-box;

  &:focus {
    outline: 1.5px solid color-mix(in srgb, var(--nn-primary) 45%, transparent);
  }

  &::placeholder {
    color: var(--el-text-color-placeholder);
  }
}
</style>

<style lang="scss">
.data-io-dialog.nn-dialog.el-dialog {
  .el-dialog__footer {
    display: none;
  }
}
</style>
