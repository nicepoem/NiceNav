<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Edit, Delete, Link, Position } from '@element-plus/icons-vue'
import type { Site } from '@nice-nav/core'
import { useNavStore } from '@/stores/nav'
import {
  cancelSiteIcon,
  enqueueSiteIcon,
  isSiteIconFailed,
} from '@/utils/site-icon'

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
let observer: IntersectionObserver | null = null

const hasStoredIcon = computed(() => Boolean(props.site.icon?.trim()))
const showSkeleton = computed(() => !hasStoredIcon.value && !iconFailed.value)

function enqueueIfNeeded(retry = false) {
  if (hasStoredIcon.value || !rootEl.value) return
  if (!retry && iconFailed.value) return
  const top = rootEl.value.getBoundingClientRect().top + window.scrollY
  enqueueSiteIcon({
    site: props.site,
    priority: top,
    retry,
    persist: (iconUrl) => nav.patchSiteIcon(props.site.id, iconUrl),
    onFail: () => {
      iconFailed.value = true
    },
  })
}

function setupObserver() {
  observer?.disconnect()
  if (hasStoredIcon.value || !rootEl.value) return

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        enqueueIfNeeded()
      }
    },
    {
      // 视口下方约 200px 预加载带
      root: null,
      rootMargin: '200px 0px',
      threshold: 0.01,
    },
  )
  observer.observe(rootEl.value)
}

watch(
  () => [props.site.id, props.site.icon, props.site.url] as const,
  () => {
    iconFailed.value = isSiteIconFailed(props.site.id)
    if (hasStoredIcon.value) {
      cancelSiteIcon(props.site.id)
      observer?.disconnect()
      return
    }
    setupObserver()
  },
)

onMounted(() => {
  setupObserver()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  cancelSiteIcon(props.site.id)
})

async function onStoredIconError() {
  // 已落库地址失效：清空后重新走自动探测
  iconFailed.value = false
  await nav.patchSiteIcon(props.site.id, '', { overwrite: true })
  setupObserver()
  enqueueIfNeeded(true)
}

function onCardClick() {
  if (props.sortable) return
  emit('open', props.site)
}
</script>

<template>
  <article
    ref="rootEl"
    class="url-card"
    :class="{ 'is-sortable': sortable }"
    :data-id="site.id"
    @click="onCardClick"
  >
    <div class="url-card__icon">
      <img
        v-if="hasStoredIcon"
        :src="site.icon"
        :alt="site.title"
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        @error="onStoredIconError"
      />
      <span v-else-if="showSkeleton" class="url-card__skeleton" aria-hidden="true" />
      <el-icon v-else :size="22"><Link /></el-icon>
    </div>

    <div class="url-card__body">
      <div class="url-card__title">{{ site.title }}</div>
      <div class="url-card__desc">{{ site.description || site.url }}</div>
    </div>

    <el-icon v-if="!sortable" class="url-card__go" :size="12" aria-hidden="true">
      <Position />
    </el-icon>

    <div v-else class="url-card__actions" @click.stop>
      <el-button :icon="Edit" text circle size="small" title="编辑" @click="emit('edit', site)" />
      <el-button :icon="Delete" text circle size="small" type="danger" title="删除" @click="emit('remove', site)" />
    </div>
  </article>
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
  border-radius: 10px;
  box-shadow: var(--nn-card-inset);
  border: none;
  cursor: pointer;
  transition:
    transform var(--nn-transition),
    background-color var(--nn-transition),
    box-shadow var(--nn-transition);

  &:hover {
    transform: translateY(-1px);
    background: var(--nn-card-bg-hover, color-mix(in srgb, var(--nn-primary) 6%, var(--nn-card-bg)));
    box-shadow: var(--nn-card-inset-hover);

    .url-card__title {
      color: var(--nn-primary);
    }

    .url-card__go {
      color: var(--nn-primary);
      opacity: 1;
    }
  }

  &.is-sortable {
    cursor: grab;
    padding-right: 14px;

    &:active {
      cursor: grabbing;
    }

    &:hover {
      transform: none;

      .url-card__actions {
        opacity: 1;
      }
    }
  }
}

.url-card__icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: color-mix(in srgb, #fff 55%, var(--nn-card-bg));
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
  font-weight: 650;
  line-height: 1.35;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--nn-transition-fast);
}

.url-card__desc {
  margin-top: 2px;
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.url-card__go {
  position: absolute;
  top: 8px;
  right: 8px;
  color: var(--el-text-color-placeholder);
  opacity: 0;
  transition:
    color var(--nn-transition-fast),
    opacity var(--nn-transition-fast);
  pointer-events: none;
}

.url-card__actions {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--nn-transition-fast);
  padding: 2px;
  background: color-mix(in srgb, var(--el-bg-color) 92%, transparent);
  border-radius: var(--nn-item-radius);
}

@media (max-width: 900px) {
  .url-card {
    flex-direction: row;
    align-items: center;
    flex-wrap: nowrap;
    gap: 8px;
    padding: 10px;
    padding-right: 24px;
    border-radius: var(--nn-item-radius, 8px);
    min-width: 0;
  }

  .url-card__icon {
    width: 34px;
    height: 34px;
    flex-shrink: 0;

    img {
      width: 20px;
      height: 20px;
    }
  }

  .url-card__body {
    min-width: 0;
    flex: 1 1 auto;
    overflow: hidden;
  }

  .url-card__title {
    font-size: 13px;
  }

  .url-card__desc {
    margin-top: 2px;
    font-size: 11px;
  }

  .url-card__go {
    top: 6px;
    right: 6px;
  }

  .url-card.is-sortable {
    padding-right: 10px;
  }

  .url-card.is-sortable .url-card__actions {
    opacity: 1;
  }
}
</style>
