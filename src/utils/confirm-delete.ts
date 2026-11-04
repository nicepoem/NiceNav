import { ElMessageBox } from 'element-plus'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const baseOptions = {
  type: 'warning' as const,
  confirmButtonText: '删除',
  cancelButtonText: '取消',
  confirmButtonClass: 'el-button--danger',
  appendTo: document.body,
  customClass: 'nn-message-box',
  autofocus: false,
  closeOnClickModal: false,
}

/** 删除确认：统一样式与文案强调 */
export function confirmDelete(title: string, messageHtml: string) {
  return ElMessageBox.confirm(messageHtml, title, {
    ...baseOptions,
    dangerouslyUseHTMLString: true,
  })
}

export function confirmDeleteCategory(name: string, childCount = 0) {
  const safe = escapeHtml(name)
  const tip =
    childCount > 0
      ? `删除 <strong class="nn-msg-name">「${safe}」</strong> 将同时删除其 ${childCount} 个子分类及下属网址，此操作不可撤销。`
      : `删除分类 <strong class="nn-msg-name">「${safe}」</strong> 将同时删除其下所有网址，此操作不可撤销。`
  return confirmDelete('删除分类', tip)
}

export function confirmDeleteSite(title: string) {
  const safe = escapeHtml(title)
  return confirmDelete(
    '删除网址',
    `确定删除 <strong class="nn-msg-name">「${safe}」</strong>？删除后不可恢复。`,
  )
}

/** 一键清空全部分类与网址 */
export function confirmClearAllData(categoryCount: number, siteCount: number) {
  return ElMessageBox.confirm(
    `将清空全部 <strong class="nn-msg-name">${categoryCount}</strong> 个分类与 <strong class="nn-msg-name">${siteCount}</strong> 个网址，此操作不可撤销。建议先导出备份。`,
    '清空数据',
    {
      ...baseOptions,
      confirmButtonText: '清空',
      dangerouslyUseHTMLString: true,
    },
  )
}
