<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Search, Close, ArrowDown } from '@element-plus/icons-vue'
import { useNavStore } from '@/stores/nav'
import { useSearchHotkey } from '@/composables/useSearchHotkey'

const props = withDefaults(
  defineProps<{
    /** 紧凑样式，用于顶栏内嵌 */
    compact?: boolean
    /** 主视觉搜索栏：站内下拉 + 红色搜索按钮 */
    variant?: 'default' | 'hero' | 'compact'
    /** 是否注册全局快捷键（弹窗外层统一处理时关闭） */
    enableHotkey?: boolean
  }>(),
  { compact: false, variant: 'default', enableHotkey: true },
)

const isHero = computed(() => props.variant === 'hero')
const isCompact = computed(() => props.compact || props.variant === 'compact')

const nav = useNavStore()

/** 站内 -1；外部引擎为 settings 下标 */
const activeEngine = ref(-1)
const webQuery = ref('')
/** 站内输入本地缓冲，防抖后再写 store，避免每键全表过滤 */
const localSiteQuery = ref(nav.searchQuery)
let searchDebounce: ReturnType<typeof setTimeout> | null = null

useSearchHotkey({
  enabled: () => props.enableHotkey,
  clearLocalQuery: () => {
    webQuery.value = ''
    localSiteQuery.value = ''
    if (searchDebounce) clearTimeout(searchDebounce)
    nav.searchQuery = ''
  },
})

const engines = computed(() => nav.settings.searchEngines ?? [])

onBeforeUnmount(() => {
  // 卸载后不再回写 store，避免悬挂定时器触发状态更新
  if (searchDebounce) {
    clearTimeout(searchDebounce)
    searchDebounce = null
  }
})

watch(
  () => nav.searchQuery,
  (v) => {
    if (activeEngine.value < 0 && v !== localSiteQuery.value) localSiteQuery.value = v
  },
)

const query = computed({
  get: () => (activeEngine.value < 0 ? localSiteQuery.value : webQuery.value),
  set: (v: string) => {
    if (activeEngine.value < 0) {
      localSiteQuery.value = v
      if (searchDebounce) clearTimeout(searchDebounce)
      searchDebounce = setTimeout(() => {
        searchDebounce = null
        nav.searchQuery = localSiteQuery.value
      }, 180)
    } else {
      webQuery.value = v
    }
  },
})

const hasQuery = computed(() => query.value.trim().length > 0)

const activeLabel = computed(() => {
  if (activeEngine.value < 0) return '站内'
  return engines.value[activeEngine.value]?.name ?? '搜索'
})

const placeholder = computed(() => {
  if (isHero.value && activeEngine.value < 0) return '搜索主页内容...'
  if (activeEngine.value < 0) return '搜索站内网址、标题或标签…'
  return `使用 ${activeLabel.value} 搜索…`
})

watch(activeEngine, (idx, prev) => {
  if (idx < 0 && prev >= 0) {
    localSiteQuery.value = webQuery.value
    nav.searchQuery = webQuery.value
  } else if (idx >= 0 && prev < 0) {
    if (searchDebounce) clearTimeout(searchDebounce)
    webQuery.value = localSiteQuery.value || nav.searchQuery
    localSiteQuery.value = ''
    nav.searchQuery = ''
  }
})

function selectEngine(index: number) {
  activeEngine.value = index
}

function clearQuery() {
  if (searchDebounce) clearTimeout(searchDebounce)
  query.value = ''
  if (activeEngine.value < 0) nav.searchQuery = ''
}

function onSubmit() {
  const q = query.value.trim()
  if (!q) return
  if (activeEngine.value < 0) {
    if (searchDebounce) clearTimeout(searchDebounce)
    localSiteQuery.value = q
    nav.searchQuery = q
    return
  }
  nav.openExternalSearch(q, activeEngine.value)
}
</script>

<template>
  <form
    class="cmd-search"
    :class="{
      'cmd-search--compact': isCompact,
      'cmd-search--hero': isHero,
    }"
    @submit.prevent="onSubmit"
  >
    <el-dropdown
      trigger="click"
      placement="bottom-start"
      teleported
      :popper-options="{ strategy: 'fixed' }"
      popper-class="nn-search-engine-popper"
      @command="selectEngine"
    >
      <button type="button" class="cmd-search__engine" aria-label="选择搜索引擎">
        <span>{{ activeLabel }}</span>
        <el-icon :size="12" class="cmd-search__caret"><ArrowDown /></el-icon>
      </button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item :command="-1" :class="{ 'is-active': activeEngine < 0 }">
            站内
          </el-dropdown-item>
          <el-dropdown-item
            v-for="(engine, index) in engines"
            :key="engine.name + index"
            :command="index"
            :class="{ 'is-active': activeEngine === index }"
          >
            {{ engine.name }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <el-icon
      v-if="!isHero"
      class="cmd-search__icon"
      :size="isCompact ? 16 : 18"
    >
      <Search />
    </el-icon>

    <input
      v-model="query"
      class="cmd-search__input"
      type="search"
      enterkeyhint="search"
      autocomplete="off"
      :placeholder="placeholder"
    />

    <button
      v-if="hasQuery && !isHero"
      type="button"
      class="cmd-search__clear"
      aria-label="清除"
      @click="clearQuery"
    >
      <el-icon :size="14"><Close /></el-icon>
    </button>

    <button
      v-if="isHero"
      type="submit"
      class="cmd-search__submit"
      aria-label="搜索"
    >
      <el-icon :size="18"><Search /></el-icon>
    </button>
  </form>
</template>

<style scoped lang="scss">
.cmd-search {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 48px;
  padding: 6px 6px 6px 8px;
  box-sizing: border-box;
  background: var(--nn-elevated-bg, var(--nn-section-bg));
  border: none;
  border-radius: var(--nn-sidebar-radius, 12px);
  box-shadow: var(--nn-elevated-shadow);
  transition: box-shadow var(--nn-transition-fast);

  &:focus-within {
    box-shadow: none;
  }

  &--compact {
    min-height: 36px;
    height: 36px;
    gap: 8px;
    padding: 2px 4px 2px 6px;
    border-radius: var(--nn-item-radius);
    background: var(--nn-tab-bg);
    box-shadow: none;

    &:focus-within {
      background: var(--nn-section-bg);
    }

    .cmd-search__engine {
      height: 28px;
      padding: 0 8px;
      font-size: 12px;
      background: var(--nn-section-bg);
    }

    .cmd-search__icon {
      font-size: 16px;
    }

    .cmd-search__input {
      font-size: 13px;
    }

    .cmd-search__clear {
      width: 26px;
      height: 26px;
      margin-right: 2px;
    }
  }
}

.cmd-search__engine {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  height: 32px;
  margin: 0;
  padding: 0 10px;
  border: 0;
  border-radius: var(--nn-item-radius);
  background: var(--nn-tab-bg);
  color: var(--el-text-color-regular);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition:
    color var(--nn-transition-fast),
    background var(--nn-transition-fast);

  &:hover {
    color: var(--nn-primary);
    background: var(--nn-item-hover-bg, var(--nn-tab-bg));
  }
}

.cmd-search__caret {
  opacity: 0.65;
}

.cmd-search__icon {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
}

.cmd-search__input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  font-size: 14px;
  line-height: 1.4;
  color: var(--el-text-color-primary);

  &::placeholder {
    color: var(--el-text-color-placeholder);
  }

  &::-webkit-search-decoration,
  &::-webkit-search-cancel-button {
    -webkit-appearance: none;
  }
}

.cmd-search__clear {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  margin-right: 4px;
  border: 0;
  border-radius: var(--nn-item-radius);
  background: transparent;
  color: var(--el-text-color-secondary);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition:
    background var(--nn-transition-fast),
    color var(--nn-transition-fast);

  &:hover {
    background: var(--nn-item-hover-bg);
    color: var(--nn-primary);
  }
}

.cmd-search--hero {
  min-height: 54px;
  gap: 12px;
  padding: 7px 8px 7px 10px;
  border-radius: 12px;
  background: var(--nn-chrome-bg, var(--nn-elevated-bg));
  border: none;
  box-shadow: var(--nn-chrome-shadow, var(--nn-elevated-shadow));
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  transition: box-shadow var(--nn-transition-fast);

  &:focus-within {
    box-shadow:
      var(--nn-chrome-shadow, var(--nn-elevated-shadow)),
      0 0 0 1px color-mix(in srgb, var(--nn-primary) 28%, transparent);
  }

  .cmd-search__engine {
    height: 36px;
    padding: 0 12px;
    border-radius: 11px;
    background: var(--nn-hero-engine-bg);
    font-size: 13px;
  }

  .cmd-search__input {
    font-size: 15px;
  }
}

.cmd-search__submit {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 12px;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: #fff;
  background: var(--nn-accent, #f1404b);
  transition:
    filter var(--nn-transition-fast),
    transform 0.15s ease;

  &:hover {
    filter: brightness(1.05);
  }

  &:active {
    transform: scale(0.96);
  }
}

@media (max-width: 720px) {
  .cmd-search {
    gap: 8px;
    padding: 8px;
  }

  .cmd-search--hero {
    min-height: 50px;
    padding: 6px 6px 6px 8px;
    border-radius: 12px;

    .cmd-search__engine {
      height: 34px;
      padding: 0 10px;
      border-radius: 10px;
    }

    .cmd-search__input {
      font-size: 14px;
    }

    .cmd-search__submit {
      width: 36px;
      height: 36px;
      border-radius: 10px;
    }
  }
}
</style>

<style lang="scss">
.nn-search-engine-popper.el-popper,
.nn-search-engine-popper {
  /* 需高于搜索弹窗（4000），否则下拉被遮罩挡住 */
  z-index: 5200 !important;
  --nn-engine-menu-radius: 12px;
  border-radius: var(--nn-engine-menu-radius) !important;
  background: var(--nn-elevated-bg, var(--nn-section-bg, #fff)) !important;
  border: none !important;
  box-shadow: var(--nn-elevated-shadow, var(--nn-shadow)) !important;

  .el-dropdown-menu {
    border-radius: var(--nn-engine-menu-radius) !important;
    padding: 4px 0 !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
  }

  .el-dropdown-menu__item {
    margin: 2px 6px !important;
    border-radius: var(--nn-item-radius) !important;
  }

  .el-dropdown-menu__item.is-active {
    color: var(--nn-primary);
    font-weight: 600;
    background-color: var(--nn-item-hover-bg) !important;
  }

  .el-popper__arrow::before {
    background: var(--nn-section-bg, #fff) !important;
    border: none !important;
  }
}
</style>
