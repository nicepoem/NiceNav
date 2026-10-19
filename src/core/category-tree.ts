import type { Category } from './types'

export type CategoryTreeNode = Category & {
  children: CategoryTreeNode[]
}

function isRoot(cat: Category) {
  return cat.parentId == null || cat.parentId === ''
}

export function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  const sorted = [...categories].sort((a, b) => a.order - b.order)
  const map = new Map<string, CategoryTreeNode>()
  for (const cat of sorted) {
    map.set(cat.id, { ...cat, children: [] })
  }

  const roots: CategoryTreeNode[] = []
  for (const node of map.values()) {
    if (!isRoot(node) && node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortNodes = (nodes: CategoryTreeNode[]) => {
    nodes.sort((a, b) => a.order - b.order)
    nodes.forEach((n) => sortNodes(n.children))
  }
  sortNodes(roots)
  return roots
}

/** 内容区展示顺序：父分类后紧跟其子分类 */
export function flattenCategoryTree(tree: CategoryTreeNode[]): Category[] {
  const list: Category[] = []
  const walk = (nodes: CategoryTreeNode[]) => {
    for (const node of nodes) {
      const { children, ...cat } = node
      list.push(cat)
      walk(children)
    }
  }
  walk(tree)
  return list
}

export function getChildCategoryIds(categories: Category[], rootId: string): string[] {
  const result: string[] = []
  const walk = (parentId: string) => {
    for (const cat of categories) {
      if (cat.parentId === parentId) {
        result.push(cat.id)
        walk(cat.id)
      }
    }
  }
  walk(rootId)
  return result
}

export function getDescendantIds(categories: Category[], rootId: string): string[] {
  return [rootId, ...getChildCategoryIds(categories, rootId)]
}
