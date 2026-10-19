<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { UploadFile } from 'element-plus'
import {
  ArrowLeft,
  Plus,
  Delete,
  Brush,
  Monitor,
  FolderOpened,
  InfoFilled,
  Rank,
} from '@element-plus/icons-vue'
import type { DockButtonId, HeaderMenuItem, ThemeMode } from '@nice-nav/core'
import { createId, normalizeDockOrder, normalizeHeaderMenus } from '@nice-nav/core'
import { useNavStore } from '@/stores/nav'
import { useTheme } from '@/composables/useTheme'
import { collectSortIds, useSortable } from '@/composables/useSortable'
import { pickImageAsDataUrl } from '@/utils/image-upload'
import ImportDialog from '@/components/site/ImportDialog.vue'

type SettingsTab = 'brand' | 'appearance' | 'data' | 'about'

/** 设置页编辑用的顶栏菜单草稿 */
type HeaderMenuDraft = {
  id: string
  label: string
  kind: 'link' | 'dropdown'
  url: string
  /** 下拉子项，每行：名称|URL */
  childrenText: string
}

function menusToDrafts(menus: HeaderMenuItem[]): HeaderMenuDraft[] {
  return normalizeHeaderMenus(menus).map((m) => ({
    id: m.id,
    label: m.label,
    kind: m.children?.length ? 'dropdown' : 'link',
    url: m.url ?? '',
    childrenText: (m.children ?? []).map((c) => `${c.label}|${c.url}`).join('\n'),
  }))
}

function draftsToMenus(drafts: HeaderMenuDraft[]): HeaderMenuItem[] {
  return normalizeHeaderMenus(
    drafts.map((d) => {
      if (d.kind === 'dropdown') {
        const children = d.childrenText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [label, ...rest] = line.split('|')
            return {
              id: createId('hml'),
              label: (label ?? '').trim(),
              url: rest.join('|').trim(),
            }
          })
        return {
          id: d.id || createId('hm'),
          label: d.label.trim(),
          children,
        }
      }
      return {
        id: d.id || createId('hm'),
        label: d.label.trim(),
        url: d.url.trim(),
      }
    }),
  )
}

const nav = useNavStore()
const router = useRouter()
const { setTheme } = useTheme()
const importDialog = ref(false)
const activeTab = ref<SettingsTab>('brand')

const menus: { id: SettingsTab; label: string; desc: string; icon: typeof Brush }[] = [
  { id: 'brand', label: '站点品牌', desc: '名称、口号与图标', icon: Brush },
  { id: 'appearance', label: '外观与行为', desc: '主题、浮动栏与搜索', icon: Monitor },
  { id: 'data', label: '数据管理', desc: '导入导出与重置', icon: FolderOpened },
  { id: 'about', label: '关于', desc: '插件与架构说明', icon: InfoFilled },
]

const activeMenu = computed(() => menus.find((m) => m.id === activeTab.value) ?? menus[0])

const form = reactive({
  theme: 'system' as ThemeMode,
  openInNewTab: true,
  enginesText: '',
  siteName: 'Nice Nav',
  siteSlogan: '',
  logo: '',
  favicon: '',
  siteArticle: '',
  dockEnabled: true,
  dockBackTop: true,
  dockTheme: true,
  dockAddSite: true,
  dockSort: true,
  dockOrder: normalizeDockOrder() as DockButtonId[],
  headerMenus: [] as HeaderMenuDraft[],
})

const dockLabels: Record<DockButtonId, string> = {
  backTop: '返回顶部',
  addSite: '添加网址',
  sort: '排序',
  theme: '主题切换',
}

const dockFlagKey: Record<
  DockButtonId,
  'dockBackTop' | 'dockAddSite' | 'dockSort' | 'dockTheme'
> = {
  backTop: 'dockBackTop',
  addSite: 'dockAddSite',
  sort: 'dockSort',
  theme: 'dockTheme',
}

const dockListEl = ref<HTMLElement | null>(null)

useSortable(
  dockListEl,
  () => {
    if (!form.dockEnabled) return null
    return {
      draggable: '.dock-sort-item',
      handle: '.dock-sort-item__handle',
      direction: 'vertical',
      onEnd: (evt) => {
        const el = evt.to
        if (!el) return
        const ids = collectSortIds(el) as DockButtonId[]
        if (ids.length) form.dockOrder = normalizeDockOrder(ids)
      },
    }
  },
  [() => form.dockEnabled, () => form.dockOrder.join(',')],
)

watch(
  () => nav.settings,
  (s) => {
    form.theme = s.theme
    form.openInNewTab = s.openInNewTab
    form.enginesText = s.searchEngines.map((e) => `${e.name}|${e.urlTemplate}`).join('\n')
    form.siteName = s.siteName || 'Nice Nav'
    form.siteSlogan = s.siteSlogan || ''
    form.logo = s.logo || ''
    form.favicon = s.favicon || ''
    form.siteArticle = s.siteArticle || ''
    form.dockEnabled = s.dockEnabled !== false
    form.dockBackTop = s.dockBackTop !== false
    form.dockTheme = s.dockTheme !== false
    form.dockAddSite = s.dockAddSite !== false
    form.dockSort = s.dockSort !== false
    form.dockOrder = normalizeDockOrder(s.dockOrder)
    form.headerMenus = menusToDrafts(s.headerMenus ?? [])
  },
  { immediate: true, deep: true },
)

function addHeaderMenu() {
  form.headerMenus.push({
    id: createId('hm'),
    label: '',
    kind: 'link',
    url: '',
    childrenText: '',
  })
}

function removeHeaderMenu(index: number) {
  form.headerMenus.splice(index, 1)
}

async function onLogoChange(uploadFile: UploadFile) {
  const file = uploadFile.raw
  if (!file) return
  const dataUrl = await pickImageAsDataUrl(file)
  if (dataUrl) form.logo = dataUrl
}

async function onFaviconChange(uploadFile: UploadFile) {
  const file = uploadFile.raw
  if (!file) return
  const dataUrl = await pickImageAsDataUrl(file)
  if (dataUrl) form.favicon = dataUrl
}

async function save() {
  const searchEngines = form.enginesText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...rest] = line.split('|')
      return { name: name.trim(), urlTemplate: rest.join('|').trim() }
    })
    .filter((e) => e.name && e.urlTemplate.includes('{q}'))

  if (!searchEngines.length) {
    ElMessage.warning('至少保留一个含 {q} 占位符的搜索引擎')
    return
  }

  const siteName = form.siteName.trim() || 'Nice Nav'

  await nav.updateSettings({
    openInNewTab: form.openInNewTab,
    searchEngines,
    siteName,
    siteSlogan: form.siteSlogan.trim(),
    logo: form.logo,
    favicon: form.favicon,
    siteArticle: form.siteArticle,
    dockEnabled: form.dockEnabled,
    dockBackTop: form.dockBackTop,
    dockTheme: form.dockTheme,
    dockAddSite: form.dockAddSite,
    dockSort: form.dockSort,
    dockOrder: normalizeDockOrder(form.dockOrder),
    headerMenus: draftsToMenus(form.headerMenus),
  })
  await setTheme(form.theme)
  ElMessage.success('设置已保存')
}

async function resetSeed() {
  try {
    await ElMessageBox.confirm('将恢复为示例数据，当前数据会被覆盖。继续？', '恢复示例数据', {
      type: 'warning',
    })
    await nav.resetToSeed()
    ElMessage.success('已恢复示例数据')
  } catch {
    // cancelled
  }
}

async function clearData() {
  try {
    await ElMessageBox.confirm('将清空全部分类与网址，此操作不可撤销。继续？', '清空数据', {
      type: 'warning',
      confirmButtonText: '清空',
    })
    await nav.clearAll()
    ElMessage.success('已清空')
  } catch {
    // cancelled
  }
}
</script>

<template>
  <div class="settings-shell">
    <aside class="settings-nav">
      <div class="settings-nav__head">
        <button type="button" class="back-btn" @click="router.push('/')">
          <el-icon :size="16"><ArrowLeft /></el-icon>
          <span>返回首页</span>
        </button>
        <h1 class="settings-nav__title">系统设置</h1>
        <p class="settings-nav__hint">管理站点与本地数据</p>
      </div>

      <nav class="settings-menu" aria-label="设置菜单">
        <button
          v-for="item in menus"
          :key="item.id"
          type="button"
          class="settings-menu__item"
          :class="{ active: activeTab === item.id }"
          @click="activeTab = item.id"
        >
          <el-icon class="settings-menu__icon" :size="18">
            <component :is="item.icon" />
          </el-icon>
          <span class="settings-menu__text">
            <span class="settings-menu__label">{{ item.label }}</span>
            <span class="settings-menu__desc">{{ item.desc }}</span>
          </span>
        </button>
      </nav>
    </aside>

    <main class="settings-main nn-scroll">
      <header class="settings-main__head">
        <h2 class="settings-main__title">{{ activeMenu.label }}</h2>
        <p class="settings-main__hint">{{ activeMenu.desc }}</p>
      </header>

      <div class="settings-main__body">
        <!-- 站点品牌 -->
        <section v-show="activeTab === 'brand'" class="panel-stack">
          <label class="nn-field-block">
            <span class="nn-field-label">站点名称</span>
            <div class="nn-field">
              <input
                v-model="form.siteName"
                class="nn-field__input"
                type="text"
                maxlength="32"
                placeholder="Nice Nav"
                autocomplete="off"
              />
            </div>
          </label>

          <label class="nn-field-block">
            <span class="nn-field-label">站点口号</span>
            <div class="nn-field">
              <input
                v-model="form.siteSlogan"
                class="nn-field__input"
                type="text"
                maxlength="64"
                placeholder="本地导航起始页"
                autocomplete="off"
              />
            </div>
          </label>

          <div class="brand-uploads">
            <div class="nn-field-block">
              <span class="nn-field-label">Logo（侧栏展示）</span>
              <div class="upload-box">
                <el-upload
                  :show-file-list="false"
                  :auto-upload="false"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,.ico"
                  :on-change="onLogoChange"
                >
                  <div v-if="form.logo" class="preview">
                    <img :src="form.logo" alt="Logo" />
                  </div>
                  <div v-else class="upload-placeholder">
                    <el-icon :size="22"><Plus /></el-icon>
                    <span>上传 Logo</span>
                  </div>
                </el-upload>
                <button
                  v-if="form.logo"
                  type="button"
                  class="clear-link"
                  @click="form.logo = ''"
                >
                  <el-icon :size="14"><Delete /></el-icon>
                  清除
                </button>
              </div>
            </div>

            <div class="nn-field-block">
              <span class="nn-field-label">站点图标（浏览器标签）</span>
              <div class="upload-box">
                <el-upload
                  :show-file-list="false"
                  :auto-upload="false"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,.ico"
                  :on-change="onFaviconChange"
                >
                  <div v-if="form.favicon" class="preview preview--sm">
                    <img :src="form.favicon" alt="Favicon" />
                  </div>
                  <div v-else class="upload-placeholder upload-placeholder--sm">
                    <el-icon :size="18"><Plus /></el-icon>
                    <span>上传图标</span>
                  </div>
                </el-upload>
                <button
                  v-if="form.favicon"
                  type="button"
                  class="clear-link"
                  @click="form.favicon = ''"
                >
                  <el-icon :size="14"><Delete /></el-icon>
                  清除
                </button>
              </div>
            </div>
          </div>

          <label class="nn-field-block">
            <span class="nn-field-label">站点文章 / 公告</span>
            <div class="nn-field nn-field--area">
              <textarea
                v-model="form.siteArticle"
                class="nn-field__input nn-field__textarea article-area"
                rows="8"
                maxlength="5000"
                placeholder="可填写站点介绍、使用说明或公告，将显示在首页顶部"
              />
            </div>
          </label>

          <div class="action-bar">
            <button type="button" class="nn-btn nn-btn--primary" @click="save">
              保存设置
            </button>
          </div>
        </section>

        <!-- 外观与行为 -->
        <section v-show="activeTab === 'appearance'" class="panel-stack">
          <div class="nn-field-block">
            <span class="nn-field-label">主题</span>
            <div class="nn-seg">
              <button
                type="button"
                class="nn-seg__btn"
                :class="{ active: form.theme === 'light' }"
                @click="form.theme = 'light'"
              >
                浅色
              </button>
              <button
                type="button"
                class="nn-seg__btn"
                :class="{ active: form.theme === 'dark' }"
                @click="form.theme = 'dark'"
              >
                深色
              </button>
              <button
                type="button"
                class="nn-seg__btn"
                :class="{ active: form.theme === 'system' }"
                @click="form.theme = 'system'"
              >
                跟随系统
              </button>
            </div>
          </div>

          <div class="nn-field-block">
            <span class="nn-field-label">打开方式</span>
            <div class="nn-seg">
              <button
                type="button"
                class="nn-seg__btn"
                :class="{ active: form.openInNewTab }"
                @click="form.openInNewTab = true"
              >
                新标签页
              </button>
              <button
                type="button"
                class="nn-seg__btn"
                :class="{ active: !form.openInNewTab }"
                @click="form.openInNewTab = false"
              >
                当前页
              </button>
            </div>
          </div>

          <div class="nn-field-block">
            <span class="nn-field-label">顶部导航菜单</span>
            <p class="field-hint">
              显示在顶栏左侧。可选「链接」或「下拉」；下拉子项每行填写：名称|URL
            </p>
            <div class="header-menu-editor">
              <div
                v-for="(item, index) in form.headerMenus"
                :key="item.id"
                class="header-menu-card"
              >
                <div class="header-menu-card__row">
                  <div class="nn-field header-menu-card__grow">
                    <input
                      v-model="item.label"
                      class="nn-field__input"
                      type="text"
                      placeholder="菜单名称"
                      autocomplete="off"
                    />
                  </div>
                  <div class="nn-seg">
                    <button
                      type="button"
                      class="nn-seg__btn"
                      :class="{ active: item.kind === 'link' }"
                      @click="item.kind = 'link'"
                    >
                      链接
                    </button>
                    <button
                      type="button"
                      class="nn-seg__btn"
                      :class="{ active: item.kind === 'dropdown' }"
                      @click="item.kind = 'dropdown'"
                    >
                      下拉
                    </button>
                  </div>
                  <button
                    type="button"
                    class="nn-btn nn-btn--ghost header-menu-card__del"
                    title="删除"
                    @click="removeHeaderMenu(index)"
                  >
                    <el-icon :size="14"><Delete /></el-icon>
                  </button>
                </div>
                <div v-if="item.kind === 'link'" class="nn-field">
                  <input
                    v-model="item.url"
                    class="nn-field__input"
                    type="url"
                    placeholder="https://example.com"
                    autocomplete="off"
                    spellcheck="false"
                  />
                </div>
                <div v-else class="nn-field nn-field--area">
                  <textarea
                    v-model="item.childrenText"
                    class="nn-field__input nn-field__textarea"
                    rows="3"
                    placeholder="子项每行：名称|URL&#10;例如：GitHub|https://github.com"
                    spellcheck="false"
                  />
                </div>
              </div>
              <button type="button" class="nn-btn nn-btn--ghost" @click="addHeaderMenu">
                <el-icon :size="14"><Plus /></el-icon>
                添加菜单
              </button>
            </div>
          </div>

          <div class="nn-field-block">
            <span class="nn-field-label">右侧浮动工具栏</span>
            <div class="nn-seg">
              <button
                type="button"
                class="nn-seg__btn"
                :class="{ active: form.dockEnabled }"
                @click="form.dockEnabled = true"
              >
                开启
              </button>
              <button
                type="button"
                class="nn-seg__btn"
                :class="{ active: !form.dockEnabled }"
                @click="form.dockEnabled = false"
              >
                关闭
              </button>
            </div>
            <p class="field-hint">开启后，对应功能会出现在页面右侧；关闭则回到顶栏按钮。</p>
          </div>

          <div v-if="form.dockEnabled" class="nn-field-block">
            <span class="nn-field-label">浮动栏按钮（拖拽排序）</span>
            <div ref="dockListEl" class="dock-sort-list">
              <div
                v-for="id in form.dockOrder"
                :key="id"
                class="dock-sort-item"
                :data-id="id"
              >
                <button
                  type="button"
                  class="dock-sort-item__handle"
                  title="拖拽排序"
                  aria-label="拖拽排序"
                >
                  <el-icon :size="14"><Rank /></el-icon>
                </button>
                <label class="dock-sort-item__label">
                  <input v-model="form[dockFlagKey[id]]" type="checkbox" />
                  <span>{{ dockLabels[id] }}</span>
                </label>
              </div>
            </div>
            <p class="field-hint">勾选显示，拖动手柄调整上下顺序。</p>
          </div>

          <label class="nn-field-block">
            <span class="nn-field-label">搜索引擎（每行：名称|URL，URL 需含 {'{q}'}）</span>
            <div class="nn-field nn-field--area">
              <textarea
                v-model="form.enginesText"
                class="nn-field__input nn-field__textarea engines-area"
                rows="5"
                spellcheck="false"
              />
            </div>
          </label>

          <div class="action-bar">
            <button type="button" class="nn-btn nn-btn--primary" @click="save">
              保存设置
            </button>
          </div>
        </section>

        <!-- 数据管理 -->
        <section v-show="activeTab === 'data'" class="panel-stack">
          <p class="data-hint">
            数据保存在浏览器 IndexedDB，可通过 JSON 备份迁移到其他设备或未来的浏览器插件。
          </p>
          <div class="btn-row">
            <button type="button" class="nn-btn nn-btn--primary" @click="nav.exportBackup()">
              导出 JSON
            </button>
            <button type="button" class="nn-btn nn-btn--ghost" @click="importDialog = true">
              导入 JSON
            </button>
            <button type="button" class="nn-btn nn-btn--ghost" @click="resetSeed">
              恢复示例数据
            </button>
            <button type="button" class="nn-btn nn-btn--danger" @click="clearData">
              清空全部数据
            </button>
          </div>
        </section>

        <!-- 关于 -->
        <section v-show="activeTab === 'about'" class="panel-stack">
          <p class="data-hint">
            业务通过 <code>NavStorage</code> 接口读写数据。Web 端使用
            <code>IndexedDbStorage</code>；后续 Chrome/Edge 插件可另实现同一接口，
            复用 UI 与 <code>@nice-nav/core</code>。
          </p>
        </section>
      </div>
    </main>

    <ImportDialog v-model="importDialog" />
  </div>
</template>

<style scoped lang="scss">
.settings-shell {
  display: flex;
  min-height: 100vh;
  background: var(--nn-page-bg);
  box-sizing: border-box;
}

.settings-nav {
  flex-shrink: 0;
  width: 240px;
  padding: 20px 12px;
  box-sizing: border-box;
  border-right: 1px solid color-mix(in srgb, var(--el-border-color) 70%, transparent);
  background: var(--nn-section-bg);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.settings-nav__head {
  padding: 0 8px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  margin-bottom: 16px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--nn-item-radius);
  background: var(--nn-tab-bg);
  color: var(--el-text-color-regular);
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
  transition:
    background var(--nn-transition-fast),
    color var(--nn-transition-fast);

  &:hover {
    background: var(--nn-item-hover-bg);
    color: var(--nn-primary);
  }
}

.settings-nav__title {
  margin: 0;
  font-size: 18px;
  font-weight: 750;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
  line-height: 1.3;
}

.settings-nav__hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.settings-menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings-menu__item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 10px 10px;
  border: 0;
  border-radius: var(--nn-item-radius);
  background: transparent;
  color: var(--el-text-color-regular);
  text-align: left;
  cursor: pointer;
  transition:
    background var(--nn-transition-fast),
    color var(--nn-transition-fast);

  &:hover:not(.active) {
    background: var(--nn-item-hover-bg);
    color: var(--nn-primary);
  }

  &.active {
    background: var(--nn-item-hover-bg);
    color: var(--nn-primary);
  }
}

.settings-menu__icon {
  flex-shrink: 0;
  margin-top: 1px;
}

.settings-menu__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.settings-menu__label {
  font-size: 13px;
  font-weight: 650;
  line-height: 1.3;
}

.settings-menu__desc {
  font-size: 11px;
  line-height: 1.35;
  color: var(--el-text-color-secondary);
  font-weight: 400;
}

.settings-menu__item.active .settings-menu__desc {
  color: color-mix(in srgb, var(--nn-primary) 72%, var(--el-text-color-secondary));
}

.settings-main {
  flex: 1;
  min-width: 0;
  padding: 28px 32px 48px;
  box-sizing: border-box;
  overflow: auto;
}

.settings-main__head {
  margin-bottom: 22px;
  max-width: 640px;
}

.settings-main__title {
  margin: 0;
  font-size: 22px;
  font-weight: 750;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
  line-height: 1.25;
}

.settings-main__hint {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.settings-main__body {
  max-width: 640px;
}

.panel-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.brand-uploads {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
}

.upload-box {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.preview {
  width: 96px;
  height: 96px;
  border-radius: var(--nn-item-radius, 8px);
  overflow: hidden;
  background: var(--nn-section-bg);
  box-shadow: var(--nn-card-inset);
  display: grid;
  place-items: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  &--sm {
    width: 56px;
    height: 56px;
  }
}

.upload-placeholder {
  width: 96px;
  height: 96px;
  border-radius: var(--nn-item-radius, 8px);
  background: var(--nn-section-bg);
  box-shadow: var(--nn-card-inset);
  color: var(--el-text-color-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: color var(--nn-transition-fast);

  &:hover {
    color: var(--nn-primary);
  }

  &--sm {
    width: 56px;
    height: 56px;
    gap: 2px;
  }
}

.clear-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 0;
  background: transparent;
  color: var(--el-color-danger);
  font-size: 12px;
  cursor: pointer;
  padding: 0;
}

.article-area {
  min-height: 140px;
}

.engines-area {
  min-height: 110px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.field-hint {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}

.header-menu-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}

.header-menu-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: var(--nn-item-radius, 8px);
  background: var(--nn-tab-bg, #eef0f3);
}

.header-menu-card__row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.header-menu-card__grow {
  flex: 1 1 140px;
  min-width: 120px;
}

.header-menu-card__del {
  min-width: 36px !important;
  width: 36px;
  padding: 0 !important;
}

.dock-sort-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 320px;
}

.dock-sort-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--nn-item-radius, 8px);
  background: var(--nn-tab-bg, #eef0f3);
  user-select: none;
}

.dock-sort-item__handle {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: grab;

  &:active {
    cursor: grabbing;
  }

  &:hover {
    color: var(--nn-primary);
    background: var(--nn-section-bg, #fff);
  }
}

.dock-sort-item__label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--el-text-color-regular);
  cursor: pointer;

  input {
    width: 14px;
    height: 14px;
    accent-color: var(--nn-primary);
  }
}

.data-hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--el-text-color-secondary);

  code {
    font-size: 12px;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--nn-tab-bg);
    color: var(--el-text-color-regular);
  }
}

.btn-row,
.action-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 900px) {
  .settings-shell {
    flex-direction: column;
  }

  .settings-nav {
    width: 100%;
    border-right: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 70%, transparent);
    padding-bottom: 12px;
  }

  .settings-menu {
    flex-direction: row;
    overflow-x: auto;
    gap: 6px;
  }

  .settings-menu__item {
    flex: 0 0 auto;
    min-width: 140px;
  }

  .settings-menu__desc {
    display: none;
  }

  .settings-main {
    padding: 20px 16px 40px;
  }
}
</style>
