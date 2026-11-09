<script setup lang="ts">
import { inject } from 'vue'
import { useNavStore } from '@/stores/nav'
import SiteGrid from '@/components/site/SiteGrid.vue'
import { NAV_MAIN_HANDLERS_KEY } from '../host-context'

const nav = useNavStore()
const handlers = inject(NAV_MAIN_HANDLERS_KEY)
</script>

<template>
  <div v-if="!nav.ready" class="nav-main-skel" aria-busy="true" aria-label="内容加载中">
    <section v-for="b in 2" :key="b" class="nav-main-skel__block">
      <div class="nav-main-skel__head">
        <span class="nav-main-skel__bone nav-main-skel__title" />
        <span class="nav-main-skel__bone nav-main-skel__tabs" />
      </div>
      <div class="nav-main-skel__cards">
        <div v-for="c in 8" :key="c" class="nav-main-skel__card">
          <span class="nav-main-skel__bone nav-main-skel__icon" />
          <div class="nav-main-skel__text">
            <span class="nav-main-skel__bone nav-main-skel__line nav-main-skel__line--t" />
            <span class="nav-main-skel__bone nav-main-skel__line nav-main-skel__line--d" />
          </div>
        </div>
      </div>
    </section>
  </div>
  <SiteGrid
    v-else-if="handlers"
    @edit-site="handlers.openEditSite"
    @remove-site="handlers.removeSite"
  />
</template>

<style scoped lang="scss">
.nav-main-skel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 0 var(--nn-sidebar-gap) 48px 0;
  box-sizing: border-box;
}

.nav-main-skel__bone {
  display: block;
  border-radius: 8px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--el-text-color-placeholder, #9ca3af) 12%, var(--nn-section-bg, #fff))
      0%,
    color-mix(in srgb, var(--el-text-color-placeholder, #9ca3af) 22%, var(--nn-section-bg, #fff))
      45%,
    color-mix(in srgb, var(--el-text-color-placeholder, #9ca3af) 12%, var(--nn-section-bg, #fff))
      100%
  );
  background-size: 200% 100%;
  animation: nav-main-skel-shimmer 1.2s ease-in-out infinite;
}

.nav-main-skel__block {
  padding: 12px 16px 14px;
  border-radius: var(--nn-sidebar-radius, 12px);
  background: var(--nn-cat-block-bg, var(--nn-section-bg, #fff));
}

.nav-main-skel__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.nav-main-skel__title {
  width: 96px;
  height: 18px;
}

.nav-main-skel__tabs {
  width: 168px;
  height: 28px;
  border-radius: 10px;
  opacity: 0.7;
}

.nav-main-skel__cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}

.nav-main-skel__card {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--nn-card-bg, #f5f6f8);
  box-sizing: border-box;
}

.nav-main-skel__icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  flex-shrink: 0;
}

.nav-main-skel__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-main-skel__line {
  height: 12px;

  &--t {
    width: 62%;
  }

  &--d {
    width: 84%;
    height: 10px;
    opacity: 0.75;
  }
}

@keyframes nav-main-skel-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

@media (max-width: 900px) {
  .nav-main-skel {
    padding: 0 10px 36px;
    gap: 12px;
  }

  .nav-main-skel__cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .nav-main-skel__tabs {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .nav-main-skel__bone {
    animation: none;
  }
}
</style>
