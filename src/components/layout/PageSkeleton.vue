<template>
  <div class="page-skel" aria-busy="true" aria-live="polite" aria-label="页面加载中">
    <div class="page-skel__top">
      <div class="page-skel__chrome">
        <span class="page-skel__bone page-skel__brand" />
        <span class="page-skel__bone page-skel__chrome-fill" />
      </div>
    </div>

    <div class="page-skel__hero">
      <span class="page-skel__bone page-skel__search" />
    </div>

    <div class="page-skel__mid">
      <aside class="page-skel__side">
        <span v-for="i in 6" :key="`s-${i}`" class="page-skel__bone page-skel__side-item" />
      </aside>

      <div class="page-skel__main">
        <section v-for="b in 2" :key="`b-${b}`" class="page-skel__block">
          <div class="page-skel__block-head">
            <span class="page-skel__bone page-skel__title" />
            <span class="page-skel__bone page-skel__tabs" />
          </div>
          <div class="page-skel__cards">
            <div v-for="c in 8" :key="`c-${b}-${c}`" class="page-skel__card">
              <span class="page-skel__bone page-skel__card-icon" />
              <div class="page-skel__card-text">
                <span class="page-skel__bone page-skel__line page-skel__line--title" />
                <span class="page-skel__bone page-skel__line page-skel__line--desc" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.page-skel {
  min-height: 100vh;
  background: var(--nn-page-bg, #f3f4f6);
  box-sizing: border-box;
  overflow: hidden;
}

.page-skel__bone {
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
  animation: page-skel-shimmer 1.2s ease-in-out infinite;
}

.page-skel__top {
  max-width: var(--nn-shell-max-width, 1600px);
  margin: 0 auto;
  padding: var(--nn-sidebar-gap, 24px) var(--nn-sidebar-gap, 24px) 0;
  box-sizing: border-box;
}

.page-skel__chrome {
  display: flex;
  align-items: center;
  gap: 12px;
  height: var(--nn-header-height, 64px);
  padding: 0 14px;
  border-radius: 12px;
  background: var(--nn-section-bg, #fff);
  box-sizing: border-box;
}

.page-skel__brand {
  width: 88px;
  height: 22px;
  flex-shrink: 0;
}

.page-skel__chrome-fill {
  flex: 1;
  height: 18px;
  opacity: 0.55;
}

.page-skel__hero {
  display: flex;
  justify-content: center;
  padding: 28px var(--nn-sidebar-gap, 24px) 24px;
  box-sizing: border-box;
}

.page-skel__search {
  width: min(880px, 100%);
  height: 54px;
  border-radius: 12px;
  background-color: var(--nn-section-bg, #fff);
}

.page-skel__mid {
  display: flex;
  align-items: flex-start;
  gap: var(--nn-sidebar-content-gap, 12px);
  max-width: var(--nn-shell-max-width, 1600px);
  margin: 0 auto;
  padding: 0 var(--nn-sidebar-gap, 24px) 48px;
  box-sizing: border-box;
}

.page-skel__side {
  flex-shrink: 0;
  width: var(--nn-sidebar-width, 120px);
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 8px;
  border-radius: 12px;
  background: var(--nn-section-bg, #fff);
  box-sizing: border-box;
}

.page-skel__side-item {
  height: 36px;
  width: 100%;
}

.page-skel__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.page-skel__block {
  padding: 12px 16px 14px;
  border-radius: 12px;
  background: var(--nn-cat-block-bg, var(--nn-section-bg, #fff));
  box-sizing: border-box;
}

.page-skel__block-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.page-skel__title {
  width: 96px;
  height: 18px;
  flex-shrink: 0;
}

.page-skel__tabs {
  width: 168px;
  height: 28px;
  border-radius: 10px;
  opacity: 0.7;
}

.page-skel__cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}

.page-skel__card {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--nn-card-bg, #f5f6f8);
  box-sizing: border-box;
}

.page-skel__card-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  flex-shrink: 0;
}

.page-skel__card-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.page-skel__line {
  height: 12px;

  &--title {
    width: 62%;
  }

  &--desc {
    width: 84%;
    height: 10px;
    opacity: 0.75;
  }
}

@keyframes page-skel-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

@media (max-width: 900px) {
  .page-skel__top {
    padding: 10px 10px 0;
  }

  .page-skel__chrome {
    height: 52px;
  }

  .page-skel__hero {
    padding: 18px 12px 16px;
  }

  .page-skel__search {
    height: 50px;
  }

  .page-skel__mid {
    display: block;
    padding: 0 10px 36px;
  }

  .page-skel__side {
    display: none;
  }

  .page-skel__cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .page-skel__tabs {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .page-skel__bone {
    animation: none;
  }
}
</style>
