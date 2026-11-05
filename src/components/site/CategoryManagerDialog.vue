<script setup lang="ts">
import { computed } from 'vue'
import { Close } from '@element-plus/icons-vue'
import CategoryManagerPanel from '@/components/site/CategoryManagerPanel.vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})
</script>

<template>
  <el-dialog
    v-model="visible"
    width="640px"
    align-center
    destroy-on-close
    class="nn-dialog nn-dialog--cat-mgr"
    :show-close="false"
  >
    <template #header>
      <div class="nn-dlg-head">
        <div>
          <h2 class="nn-dlg-head__title">分类管理</h2>
          <p class="nn-dlg-head__hint nn-dlg-head__hint--desktop">
            拖拽排序；左右拖可调整父子层级
          </p>
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

    <CategoryManagerPanel :active="visible" />
  </el-dialog>
</template>
