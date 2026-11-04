import { describe, expect, it } from 'vitest'
import {
  isAllowedHttpUrl,
  isValidSearchEngineTemplate,
  sanitizeHttpUrl,
  sanitizeIconUrl,
  siteDedupeKey,
} from '../url'

describe('url helpers', () => {
  it('accepts http(s) only', () => {
    expect(isAllowedHttpUrl('https://example.com')).toBe(true)
    expect(isAllowedHttpUrl('http://localhost:5173')).toBe(true)
    expect(isAllowedHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedHttpUrl('ftp://files.example')).toBe(false)
    expect(isAllowedHttpUrl('')).toBe(false)
  })

  it('sanitizes to href', () => {
    expect(sanitizeHttpUrl('https://example.com/path')).toBe('https://example.com/path')
    expect(sanitizeHttpUrl('javascript:void(0)')).toBeNull()
  })

  it('rejects non-http icons', () => {
    expect(sanitizeIconUrl('https://cdn.example/favicon.ico')).toBe(
      'https://cdn.example/favicon.ico',
    )
    expect(sanitizeIconUrl('data:image/png;base64,abc')).toBeNull()
    expect(sanitizeIconUrl('javascript:alert(1)')).toBeNull()
  })

  it('validates search engine templates', () => {
    expect(isValidSearchEngineTemplate('https://www.baidu.com/s?wd={q}')).toBe(true)
    expect(isValidSearchEngineTemplate('javascript:{q}')).toBe(false)
    expect(isValidSearchEngineTemplate('https://example.com/search')).toBe(false)
  })

  it('normalizes dedupe keys across www/http/trailing slash', () => {
    const a = siteDedupeKey('http://www.example.com/path/')
    const b = siteDedupeKey('https://example.com/path')
    expect(a).toBeTruthy()
    expect(a).toBe(b)
    expect(siteDedupeKey('https://example.com/#hash')).toBe(
      siteDedupeKey('https://example.com/'),
    )
  })
})
