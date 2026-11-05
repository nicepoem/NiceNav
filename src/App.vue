<script setup lang="ts">
import { onMounted } from 'vue'
import { useNavStore } from '@/stores/nav'
import { useTheme } from '@/composables/useTheme'
import PageSkeleton from '@/components/layout/PageSkeleton.vue'

const nav = useNavStore()
const { initTheme } = useTheme()

onMounted(async () => {
  await nav.init()
  initTheme()
})

function reload() {
  window.location.reload()
}
</script>

<template>
  <div v-if="nav.initError && !nav.ready" class="boot-error">
    <h1>无法启动 NiceNav</h1>
    <p>{{ nav.initError }}</p>
    <p class="boot-error__hint">请检查浏览器是否禁用了存储，或尝试关闭隐私模式后重试。</p>
    <button type="button" class="nn-btn nn-btn--primary" @click="reload">
      重新加载
    </button>
  </div>
  <PageSkeleton v-else-if="!nav.ready" />
  <template v-else>
    <div v-if="nav.usingMemoryFallback" class="boot-banner" role="status">
      本地数据库不可用，已使用内存模式；刷新页面后数据会丢失。
    </div>
    <RouterView />
  </template>
</template>

<style scoped lang="scss">
.boot-error {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
  text-align: center;
  background: var(--nn-page-bg, #f5f6f8);
  color: var(--el-text-color-primary, #303133);
  box-sizing: border-box;

  h1 {
    margin: 0;
    font-size: 22px;
    font-weight: 750;
  }

  p {
    margin: 0;
    max-width: 420px;
    font-size: 14px;
    line-height: 1.55;
    color: var(--el-text-color-regular, #606266);
  }
}

.boot-error__hint {
  font-size: 13px !important;
  color: var(--el-text-color-secondary, #909399) !important;
}

.boot-banner {
  position: sticky;
  top: 0;
  z-index: 1000;
  padding: 8px 16px;
  text-align: center;
  font-size: 13px;
  line-height: 1.4;
  color: #8a5a00;
  background: #fff6e0;
  border-bottom: 1px solid #f0d9a0;
}
</style>
