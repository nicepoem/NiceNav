<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Edit, Delete, Link, Position } from '@element-plus/icons-vue'
import type { Site } from '@nice-nav/core'
import { useNavStore } from '@/stores/nav'
import {
  cancelSiteIcon,
  enqueueSiteIcon,
  invalidateSiteIcon,
  isSiteIconFailed,
  rememberSiteIcon,
} from '@/utils/site-icon'
import { observeIconTrigger, unobserveIconTrigger } from '@/utils/shared-icon-observer'

const props = defineProps<{
  site: Site
  /** 排序模式：可拖拽，并显示编辑/删除 */
  sortable?: boolean
}>()

const emit = defineEmits<{
  open: [site: Site]
  edit: [site: Site]
  remove: [site: Site]
}>()

const nav = useNavStore()
const rootEl = ref<HTMLElement | null>(null)
const iconFailed = ref(isSiteIconFailed(props.site.id))

const displayIcon = computed(() => {
  const map = nav.iconOverrides
  if (map.has(props.site.id)) return map.get(props.site.id) || ''
  return props.site.icon?.trim() || ''
})
const hasStoredIcon = computed(() => Boolean(displayIcon.value))
const showSkeleton = computed(() => !hasStoredIcon.value && !iconFailed.value)
const tip = computed(() => props.site.description?.trim() || '')

function enqueueIfNeeded(retry = false) {
  if (hasStoredIcon.value || !rootEl.value) return
  if (!retry && iconFailed.value) return
  const top = rootEl.value.getBoundingClientRect().top + window.scrollY
  enqueueSiteIcon({
    site: { ...props.site, icon: displayIcon.value || undefined },
    priority: top,
    retry,
    thirdParty: nav.settings.allowThirdPartyFavicon === true,
    persist: (iconUrl) => nav.patchSiteIcon(props.site.id, iconUrl),
    onFail: () => {
      iconFailed.value = true
    },
  })
}

function setupObserver() {
  if (!rootEl.value) return
  unobserveIconTrigger(rootEl.value)
  if (hasStoredIcon.value) return
  observeIconTrigger(rootEl.value, () => enqueueIfNeeded())
}

watch(
  () => [props.site.id, displayIcon.value, props.site.url] as const,
  () => {
    iconFailed.value = isSiteIconFailed(props.site.id)
    if (hasStoredIcon.value) {
      rememberSiteIcon(props.site.url, displayIcon.value)
      cancelSiteIcon(props.site.id)
      if (rootEl.value) unobserveIconTrigger(rootEl.value)
      return
    }
    setupObserver()
  },
)

onMounted(() => {
  if (hasStoredIcon.value) rememberSiteIcon(props.site.url, displayIcon.value)
  setupObserver()
})

onBeforeUnmount(() => {
  if (rootEl.value) unobserveIconTrigger(rootEl.value)
  cancelSiteIcon(props.site.id)
})

async function onStoredIconError() {
  iconFailed.value = false
  invalidateSiteIcon(props.site.url)
  await nav.patchSiteIcon(props.site.id, '', { overwrite: true })
  setupObserver()
  enqueueIfNeeded(true)
}

function onCardClick() {
  if (props.sortable) return
  emit('open', props.site)
}

function onCardKeydown(event: KeyboardEvent) {
  if (props.sortable) return
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    onCardClick()
  }
}

const iconFallbackTitle = computed(() => {
  if (hasStoredIcon.value || showSkeleton.value) return ''
  return '图标加载失败'
})
</script>

<template>
  <el-tooltip
    :content="tip"
    placement="top"
    :show-after="400"
    :disabled="!tip || sortable"
    popper-class="nn-site-tip"
  >
  <article
    ref="rootEl"
    class="url-card"
    :class="{ 'is-sortable': sortable }"
    :data-id="site.id"
    role="link"
    :tabindex="sortable ? -1 : 0"
    :aria-label="site.title"
    @click="onCardClick"
    @keydown="onCardKeydown"
  >
    <div class="url-card__icon" :title="iconFallbackTitle || undefined">
      <img
        v-if="hasStoredIcon"
        :src="displayIcon"
        :alt="site.title"
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        @error="onStoredIconError"
      />
      <span v-else-if="showSkeleton" class="url-card__skeleton" aria-hidden="true" />
      <el-icon v-else :size="22" aria-hidden="true"><Link /></el-icon>
    </div>

    <div class="url-card__body">
      <div class="url-card__title">{{ site.title }}</div>
      <div class="url-card__desc">{{ site.description || site.url }}</div>
    </div>

    <el-icon v-if="!sortable" class="url-card__go" :size="12" aria-hidden="true">
      <Position />
    </el-icon>

    <div v-else class="url-card__actions" @click.stop>
      <button
        type="button"
        class="url-card__action"
        title="编辑"
        aria-label="编辑"
        @click="emit('edit', site)"
      >
        <el-icon :size="14"><Edit /></el-icon>
      </button>
      <button
        type="button"
        class="url-card__action url-card__action--danger"
        title="删除"
        aria-label="删除"
        @click="emit('remove', site)"
      >
        <el-icon :size="14"><Delete /></el-icon>
      </button>
    </div>
  </article>
  </el-tooltip>
</template>

<style scoped lang="scss">
.url-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  padding-right: 28px;
  background: var(--nn-card-bg);
  border-radius: 12px;
  box-shadow: var(--nn-card-inset);
  border: none;
  cursor: pointer;
  /* 视口外跳过绘制，大列表更顺 */
  content-visibility: auto;
  contain-intrinsic-size: auto 64px;
  transition:
    box-shadow var(--nn-transition),
    transform var(--nn-transition),
    border-color var(--nn-transition);
  &:hover:not(.is-sortable) {
    box-shadow: var(--nn-card-inset-hover);
    transform: translateY(-2px);

    .url-card__title {
      color: var(--nn-primary);
    }

    .url-card__go {
      color: var(--nn-primary);
      opacity: 1;
      transform: translateY(-50%) translateX(0);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--nn-primary);
    outline-offset: 2px;
  }

  &.is-sortable {
    cursor: grab;
    padding-right: 14px;
    transition: padding-right 0.2s ease;

    &:active {
      cursor: grabbing;
    }

    /* 仅悬停当前卡片时展开右边距并显示编辑/删除 */
    &:hover,
    &:focus-within {
      padding-right: 52px;

      .url-card__actions {
        opacity: 1;
        pointer-events: auto;
      }
    }

    .url-card__actions {
      opacity: 0;
      pointer-events: none;
    }
  }
}

.url-card__icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--nn-card-icon-bg, color-mix(in srgb, #fff 55%, var(--nn-card-bg)));
  display: grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
  color: var(--el-text-color-secondary);

  img {
    width: 22px;
    height: 22px;
    object-fit: contain;
    border-radius: 50%;
  }
}

.url-card__skeleton {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--el-text-color-placeholder) 14%, transparent) 0%,
    color-mix(in srgb, var(--el-text-color-placeholder) 28%, transparent) 45%,
    color-mix(in srgb, var(--el-text-color-placeholder) 14%, transparent) 100%
  );
  background-size: 200% 100%;
  animation: nn-icon-shimmer 1.1s ease-in-out infinite;
}

@keyframes nn-icon-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

.url-card__body {
  min-width: 0;
  flex: 1;
}

.url-card__title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.url-card__desc {
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.3;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.url-card__go {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%) translateX(-4px);
  color: var(--el-text-color-placeholder);
  opacity: 0;
  transition:
    opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    color 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.url-card__actions {
  position: absolute;
  right: 4px;
  top: 4px;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--nn-transition-fast);
}

.url-card__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    color 0.18s ease;

  &:hover,
  &:focus-visible {
    /* 比卡片底更深一档，悬停才看得见 */
    background: color-mix(in srgb, #000 8%, var(--nn-card-bg, #f5f6f8));
    color: var(--el-text-color-primary);
  }

  &--danger:hover,
  &--danger:focus-visible {
    background: color-mix(in srgb, #000 8%, var(--nn-card-bg, #f5f6f8));
    color: var(--nn-primary, #f1404b);
  }
}

@media (max-width: 900px) {
  .url-card {
    padding: 10px 12px;
    padding-right: 24px;
  }

  .url-card__go {
    right: 6px;
  }
}
</style>
