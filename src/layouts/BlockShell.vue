<script setup lang="ts">
import { computed, useSlots } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 是否渲染左侧栏区域（仍需提供 leftSidebar 插槽） */
    showLeft?: boolean
    /** 是否渲染右侧栏区域 */
    showRight?: boolean
    /** 侧栏折叠：收窄顶栏 brand 与内容左边距 */
    collapsed?: boolean
    /** 开发时显示区域轮廓 */
    debugOutline?: boolean
  }>(),
  {
    showLeft: true,
    showRight: true,
    collapsed: false,
    debugOutline: false,
  },
)

const slots = useSlots()

const has = (name: string) => Boolean(slots[name])

const showLeftCol = computed(() => props.showLeft && has('leftSidebar'))
const showRightCol = computed(() => props.showRight && has('rightSidebar'))
const showTopFull = computed(() => has('topFull'))
const showMainTop = computed(() => has('mainTop'))
const showMainBottom = computed(() => has('mainBottom'))
const showBottomFull = computed(() => has('bottomFull'))
const showFooter = computed(() => has('footer'))
</script>

<template>
  <div
    class="block-shell"
    :class="{
      'is-collapsed': collapsed,
      'has-left': showLeftCol,
      'has-right': showRightCol,
      'is-debug': debugOutline,
    }"
  >
    <header v-if="has('topNav')" class="block-shell__top-nav">
      <slot name="topNav" />
    </header>

    <!-- 顶栏下：主搜索栏（无背景） -->
    <div
      v-if="has('topNav') || showTopFull"
      class="block-shell__hero"
      :class="{ 'has-search': showTopFull }"
    >
      <div v-if="showTopFull" class="block-shell__hero-search">
        <slot name="topFull" />
      </div>
    </div>

    <div class="block-shell__mid">
      <aside v-if="showLeftCol" class="block-shell__left">
        <slot name="leftSidebar" />
      </aside>

      <div class="block-shell__main-col">
        <div v-if="showMainTop" class="block-shell__main-top">
          <slot name="mainTop" />
        </div>
        <main class="block-shell__main nn-scroll">
          <slot name="main" />
        </main>
        <div v-if="showMainBottom" class="block-shell__main-bottom">
          <slot name="mainBottom" />
        </div>
      </div>

      <aside v-if="showRightCol" class="block-shell__right">
        <slot name="rightSidebar" />
      </aside>
    </div>

    <div v-if="showBottomFull" class="block-shell__bottom-full">
      <slot name="bottomFull" />
    </div>

    <footer v-if="showFooter" class="block-shell__footer">
      <slot name="footer" />
    </footer>

    <slot />
  </div>
</template>

<style scoped lang="scss">
.block-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: transparent;
  /* 顶栏品牌区 = 侧栏卡片宽 + 内容间距，使顶栏右段与分类块左缘对齐 */
  --nn-top-brand-width: calc(
    var(--nn-sidebar-width) + var(--nn-sidebar-content-gap)
  );
  /* 顶栏下方英雄区（搜索栏）——留白更足 */
  --nn-glass-band: 148px;
  --nn-sidebar-sticky-top: calc(
    var(--nn-sidebar-gap) + var(--nn-header-height) + var(--nn-glass-band)
  );
  --block-right-width: 280px;

  &.is-collapsed {
    --nn-top-brand-width: calc(
      var(--nn-sidebar-collapsed) + var(--nn-sidebar-content-gap)
    );
  }

  &.is-debug {
    .block-shell__top-nav,
    .block-shell__hero,
    .block-shell__left,
    .block-shell__main-top,
    .block-shell__main,
    .block-shell__main-bottom,
    .block-shell__right,
    .block-shell__bottom-full,
    .block-shell__footer {
      outline: 1px dashed color-mix(in srgb, var(--nn-primary) 45%, transparent);
    }
  }
}

.block-shell__top-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  flex-shrink: 0;
  width: 100%;
}

.block-shell__hero {
  position: relative;
  flex-shrink: 0;
  min-height: var(--nn-glass-band, 148px);
  /* 玻璃区全宽；搜索内容用内边距对齐顶栏 */
  margin: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px var(--nn-sidebar-gap) 32px;
  box-sizing: border-box;
  isolation: isolate;
  z-index: 1;

  &.has-search {
    min-height: var(--nn-glass-band, 148px);
  }
}

.block-shell__hero-search {
  position: relative;
  z-index: 1;
  width: min(880px, 100%);
  pointer-events: auto;
}

.block-shell__mid {
  display: flex;
  align-items: stretch;
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: var(--nn-shell-max-width, 1600px);
  margin-inline: auto;
  box-sizing: border-box;
}

.block-shell__left {
  flex-shrink: 0;
}

.block-shell__main-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.block-shell__main-top,
.block-shell__main-bottom {
  flex-shrink: 0;
  padding: 0 var(--nn-sidebar-gap);
  box-sizing: border-box;
}

.block-shell__main {
  flex: 1;
  min-width: 0;
  min-height: calc(100vh - var(--nn-header-height));
}

.block-shell__right {
  flex-shrink: 0;
  width: var(--block-right-width);
  padding: var(--nn-sidebar-gap);
  padding-left: 0;
  box-sizing: border-box;
}

.block-shell__bottom-full {
  width: 100%;
  max-width: var(--nn-shell-max-width, 1600px);
  margin-inline: auto;
  padding: 0 var(--nn-sidebar-gap);
  box-sizing: border-box;
}

.block-shell__footer {
  flex-shrink: 0;
  width: 100%;
  max-width: var(--nn-shell-max-width, 1600px);
  margin-inline: auto;
  padding: 16px var(--nn-sidebar-gap) 24px;
  box-sizing: border-box;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

@media (max-width: 900px) {
  .block-shell {
    --nn-glass-band: 120px;
    --nn-shell-max-width: 100%;
  }

  .block-shell__hero {
    margin: 0;
    padding: 18px 12px 20px;
  }

  .block-shell__hero-search {
    width: 100%;
  }

  .block-shell__mid {
    display: block;
  }

  .block-shell__right {
    width: 100%;
    padding: 12px 8px;
  }
}
</style>
