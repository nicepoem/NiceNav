<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Search, Close, ArrowDown } from '@element-plus/icons-vue'
import { useNavStore } from '@/stores/nav'

const nav = useNavStore()

/** 站内 -1；外部引擎为 settings 下标 */
const activeEngine = ref(-1)
const webQuery = ref('')

const engines = computed(() => nav.settings.searchEngines ?? [])

const query = computed({
  get: () => (activeEngine.value < 0 ? nav.searchQuery : webQuery.value),
  set: (v: string) => {
    if (activeEngine.value < 0) nav.searchQuery = v
    else webQuery.value = v
  },
})

const hasQuery = computed(() => query.value.trim().length > 0)

const activeLabel = computed(() => {
  if (activeEngine.value < 0) return '站内'
  return engines.value[activeEngine.value]?.name ?? '搜索'
})

const placeholder = computed(() => {
  if (activeEngine.value < 0) return '搜索站内网址、标题或标签…'
  return `使用 ${activeLabel.value} 搜索…`
})

watch(activeEngine, (idx, prev) => {
  if (idx < 0 && prev >= 0) {
    nav.searchQuery = webQuery.value
  } else if (idx >= 0 && prev < 0) {
    webQuery.value = nav.searchQuery
    nav.searchQuery = ''
  }
})

function selectEngine(index: number) {
  activeEngine.value = index
}

function clearQuery() {
  query.value = ''
}

function onSubmit() {
  const q = query.value.trim()
  if (!q) return
  if (activeEngine.value < 0) {
    nav.searchQuery = q
    return
  }
  nav.openExternalSearch(q, activeEngine.value)
}
</script>

<template>
  <form class="cmd-search" @submit.prevent="onSubmit">
    <el-dropdown
      trigger="click"
      placement="bottom-start"
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

    <el-icon class="cmd-search__icon" :size="18"><Search /></el-icon>

    <input
      v-model="query"
      class="cmd-search__input"
      type="search"
      enterkeyhint="search"
      autocomplete="off"
      :placeholder="placeholder"
    />

    <button
      v-if="hasQuery"
      type="button"
      class="cmd-search__clear"
      aria-label="清除"
      @click="clearQuery"
    >
      <el-icon :size="14"><Close /></el-icon>
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
  background: var(--nn-section-bg);
  border-radius: var(--nn-sidebar-radius, 16px);
  box-shadow: var(--nn-card-inset);
  transition: box-shadow var(--nn-transition-fast);

  &:focus-within {
    box-shadow:
      var(--nn-card-inset),
      0 0 0 1px color-mix(in srgb, var(--nn-primary) 35%, transparent);
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

@media (max-width: 720px) {
  .cmd-search {
    gap: 8px;
    padding: 8px;
  }
}
</style>

<style lang="scss">
.nn-search-engine-popper.el-popper,
.nn-search-engine-popper {
  --nn-engine-menu-radius: calc(var(--nn-item-radius) + 4px);
  border-radius: var(--nn-engine-menu-radius) !important;
  background: var(--nn-section-bg, #fff) !important;
  border: none !important;
  box-shadow: var(--nn-shadow, 0 2px 12px rgba(0, 0, 0, 0.1)) !important;

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
