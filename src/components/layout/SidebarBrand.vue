<script setup lang="ts">
import brandLogo from '@/assets/brand/logo.png'
</script>

<template>
  <div class="sidebar-logo" title="NiceNav">
    <img
      class="sidebar-logo__mark"
      :src="brandLogo"
      alt=""
      width="28"
      height="28"
      decoding="async"
    />
    <h1 class="sidebar-logo__title">NiceNav</h1>
  </div>
</template>

<style scoped lang="scss">
.sidebar-logo {
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 10px;
  background: transparent;
  flex-shrink: 0;
  box-sizing: border-box;
}

.sidebar-logo__mark {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
  display: block;
}

.sidebar-logo__title {
  margin: 0;
  color: var(--nn-sidebar-logo-text, var(--el-text-color-primary));
  font-weight: 650;
  font-size: 15px;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

/* 侧栏折叠时顶栏品牌区变窄，只保留图标 */
:global(html.nn-sidebar-narrow) .sidebar-logo {
  gap: 0;
  padding: 0;
}

:global(html.nn-sidebar-narrow) .sidebar-logo__title {
  display: none;
}
</style>
