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
  line-height: 0;
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
  padding: 0;
  color: var(--nn-sidebar-logo-text, var(--el-text-color-primary));
  font-weight: 650;
  font-size: 15px;
  line-height: 1;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .sidebar-logo {
    justify-content: flex-start;
    gap: 6px;
    padding: 0 4px 0 10px;
  }

  .sidebar-logo__mark {
    width: 26px;
    height: 26px;
    border-radius: 7px;
  }

  .sidebar-logo__title {
    font-size: 14px;
  }
}
</style>

<!--
  不可用 scoped 里 :global(html.x) .child —— Vue 会编译成 html.x { … }，
  把 display:none 绑到整个 html，折叠侧栏时整页黑/白屏。
-->
<style lang="scss">
html.nn-sidebar-narrow .sidebar-logo {
  gap: 0;
  padding: 0;
}

html.nn-sidebar-narrow .sidebar-logo__title {
  display: none;
}
</style>
