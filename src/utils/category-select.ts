import type { Category, CategoryTreeNode } from '@nice-nav/core'
import { buildCategoryTree } from '@nice-nav/core'

/** 有子分类的一级不可作为网址归属，改用其第一个子分类 */
export function resolveSiteCategoryId(
  categoryId: string | undefined | null,
  categories: Category[],
): string {
  if (!categoryId) return ''
  const tree = buildCategoryTree(categories)
  return resolveSiteCategoryIdFromTree(categoryId, tree)
}

export function resolveSiteCategoryIdFromTree(
  categoryId: string | undefined | null,
  tree: CategoryTreeNode[],
): string {
  if (!categoryId) return ''
  for (const root of tree) {
    if (root.id === categoryId) {
      return root.children.length ? root.children[0]!.id : root.id
    }
    if (root.children.some((c) => c.id === categoryId)) return categoryId
  }
  return categoryId
}

/** 默认可选分类：优先 prefer，否则第一个可选叶子/一级 */
export function defaultSiteCategoryId(
  categories: Category[],
  preferCategoryId?: string,
): string {
  const tree = buildCategoryTree(categories)
  if (preferCategoryId) {
    const resolved = resolveSiteCategoryIdFromTree(preferCategoryId, tree)
    if (resolved) return resolved
  }
  for (const root of tree) {
    if (root.children.length) return root.children[0]!.id
    return root.id
  }
  return ''
}
