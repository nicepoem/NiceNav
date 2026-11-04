import { describe, expect, it } from 'vitest'
import { applyImport, validateImportJson } from '../import-export'
import { DEFAULT_SETTINGS } from '../defaults'
import type { NavData } from '../types'

const sample = {
  version: 1 as const,
  exportedAt: '2026-01-01T00:00:00.000Z',
  categories: [
    {
      id: 'cat-1',
      name: '常用',
      parentId: null,
      order: 0,
      createdAt: 1,
      updatedAt: 1,
    },
  ],
  sites: [
    {
      id: 'site-1',
      categoryId: 'cat-1',
      title: 'Example',
      url: 'https://example.com',
      order: 0,
      createdAt: 1,
      updatedAt: 1,
    },
  ],
}

const emptyCurrent: NavData = {
  categories: [],
  sites: [],
  settings: { ...DEFAULT_SETTINGS },
}

describe('validateImportJson', () => {
  it('accepts a valid backup', () => {
    const result = validateImportJson(JSON.stringify(sample))
    expect(result.ok).toBe(true)
  })

  it('accepts coerced numeric fields', () => {
    const loose = {
      ...sample,
      categories: [{ ...sample.categories[0], order: '2', createdAt: '10' }],
      sites: [{ ...sample.sites[0], order: '1' }],
    }
    const result = validateImportJson(JSON.stringify(loose))
    expect(result.ok).toBe(true)
  })

  it('strips UTF-8 BOM', () => {
    const result = validateImportJson(`\uFEFF${JSON.stringify(sample)}`)
    expect(result.ok).toBe(true)
  })

  it('strips markdown fences', () => {
    const result = validateImportJson(`\`\`\`json\n${JSON.stringify(sample)}\n\`\`\``)
    expect(result.ok).toBe(true)
  })

  it('rejects empty export blob content', () => {
    const result = validateImportJson('undefined')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('旧版设置页')
  })
})

describe('applyImport', () => {
  it('replace writes cleaned graph', () => {
    const { data, result } = applyImport(emptyCurrent, sample, 'replace')
    expect(result.mode).toBe('replace')
    expect(data.categories).toHaveLength(1)
    expect(data.sites).toHaveLength(1)
    expect(data.sites[0]?.url).toBe('https://example.com/')
  })

  it('merge skips duplicate category name and site url', () => {
    const seeded: NavData = {
      categories: sample.categories,
      sites: sample.sites,
      settings: { ...DEFAULT_SETTINGS },
    }
    const { data, result } = applyImport(seeded, sample, 'merge')
    expect(result.categories).toBe(0)
    expect(result.sites).toBe(0)
    expect(data.categories).toHaveLength(1)
    expect(data.sites).toHaveLength(1)
    expect(data.categories[0]?.id).toBe('cat-1')
    expect(data.sites[0]?.id).toBe('site-1')
  })

  it('merge appends only new urls', () => {
    const seeded: NavData = {
      categories: sample.categories,
      sites: sample.sites,
      settings: { ...DEFAULT_SETTINGS },
    }
    const extra = {
      ...sample,
      sites: [
        ...sample.sites,
        {
          id: 'site-2',
          categoryId: 'cat-1',
          title: 'New',
          url: 'https://new.example.com',
          order: 1,
          createdAt: 2,
          updatedAt: 2,
        },
      ],
    }
    const { data, result } = applyImport(seeded, extra, 'merge')
    expect(result.categories).toBe(0)
    expect(result.sites).toBe(1)
    expect(data.sites).toHaveLength(2)
    expect(data.sites.some((s) => s.url.includes('new.example.com'))).toBe(true)
  })

  it('merge treats www/http variants as the same site', () => {
    const seeded: NavData = {
      categories: sample.categories,
      sites: sample.sites,
      settings: { ...DEFAULT_SETTINGS },
    }
    const variant = {
      ...sample,
      sites: [
        {
          ...sample.sites[0],
          id: 'site-www',
          url: 'http://www.example.com/',
        },
      ],
    }
    const { data, result } = applyImport(seeded, variant, 'merge')
    expect(result.sites).toBe(0)
    expect(data.sites).toHaveLength(1)
  })
})
