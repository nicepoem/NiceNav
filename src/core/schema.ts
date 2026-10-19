import { z } from 'zod'
import type { NavExportPayload } from './types'

const searchEngineSchema = z.object({
  name: z.string().min(1),
  urlTemplate: z.string().min(1),
})

const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().optional(),
  parentId: z.string().nullable().optional(),
  order: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const siteSchema = z.object({
  id: z.string().min(1),
  categoryId: z.string().min(1),
  title: z.string().min(1),
  url: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  order: z.number(),
  tags: z.array(z.string()).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const settingsSchema = z
  .object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    openInNewTab: z.boolean().optional(),
    searchEngines: z.array(searchEngineSchema).optional(),
    sidebarCollapsed: z.boolean().optional(),
    siteName: z.string().optional(),
    siteSlogan: z.string().optional(),
    logo: z.string().optional(),
    favicon: z.string().optional(),
    siteArticle: z.string().optional(),
    dockEnabled: z.boolean().optional(),
    dockBackTop: z.boolean().optional(),
    dockTheme: z.boolean().optional(),
    dockAddSite: z.boolean().optional(),
    dockSort: z.boolean().optional(),
    dockExport: z.boolean().optional(),
    dockImport: z.boolean().optional(),
    dockOrder: z
      .array(z.enum(['backTop', 'addSite', 'sort', 'theme', 'export', 'import']))
      .optional(),
    headerMenus: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          url: z.string().optional(),
          children: z
            .array(
              z.object({
                id: z.string(),
                label: z.string(),
                url: z.string(),
              }),
            )
            .optional(),
        }),
      )
      .optional(),
  })
  // 兼容旧版导出中的布局设置字段
  .passthrough()

export const navExportPayloadSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  categories: z.array(categorySchema),
  sites: z.array(siteSchema),
  settings: settingsSchema.optional(),
})

export function parseNavExportPayload(input: unknown): NavExportPayload {
  return navExportPayloadSchema.parse(input) as NavExportPayload
}

export function safeParseNavExportPayload(input: unknown) {
  return navExportPayloadSchema.safeParse(input)
}
