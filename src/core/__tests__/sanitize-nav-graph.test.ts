import { describe, expect, it } from 'vitest'
import { sanitizeNavGraph } from '../import-export'
import type { Category, Site } from '../types'

function cat(
  id: string,
  parentId: string | null = null,
): Category {
  return {
    id,
    name: id,
    parentId,
    order: 0,
    createdAt: 1,
    updatedAt: 1,
  }
}

function site(id: string, categoryId: string, url: string): Site {
  return {
    id,
    categoryId,
    title: id,
    url,
    order: 0,
    createdAt: 1,
    updatedAt: 1,
  }
}

describe('sanitizeNavGraph', () => {
  it('drops orphan sites and invalid urls', () => {
    const { categories, sites } = sanitizeNavGraph(
      [cat('a')],
      [
        site('s1', 'a', 'https://ok.com'),
        site('s2', 'missing', 'https://x.com'),
        site('s3', 'a', 'javascript:alert(1)'),
      ],
    )
    expect(categories.map((c) => c.id)).toEqual(['a'])
    expect(sites.map((s) => s.id)).toEqual(['s1'])
  })

  it('breaks parent cycles', () => {
    const { categories } = sanitizeNavGraph(
      [cat('a', 'b'), cat('b', 'a')],
      [],
    )
    expect(categories.every((c) => c.parentId == null)).toBe(true)
  })

  it('clamps depth to two levels', () => {
    const { categories } = sanitizeNavGraph(
      [cat('root'), cat('child', 'root'), cat('grand', 'child')],
      [site('s', 'grand', 'https://example.com')],
    )
    const grand = categories.find((c) => c.id === 'grand')
    expect(grand?.parentId).toBe('root')
    expect(categories.find((c) => c.id === 'child')?.parentId).toBe('root')
  })
})
