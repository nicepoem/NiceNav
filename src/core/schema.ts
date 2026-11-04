import { z } from 'zod'
import type { NavExportPayload } from './types'

const searchEngineSchema = z.object({
  name: z.string().min(1),
  urlTemplate: z.string().min(1),
})

const num = z.coerce.number()

const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().optional().nullable().transform((v) => v ?? undefined),
  parentId: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (!v ? null : v)),
  order: num.default(0),
  createdAt: num.default(0),
  updatedAt: num.default(0),
})

const siteSchema = z.object({
  id: z.string().min(1),
  categoryId: z.string().min(1),
  title: z.string().min(1),
  // 非法协议在 sanitizeNavGraph 中剔除，避免单条坏数据导致整包失败
  url: z.string().min(1),
  description: z.string().optional().nullable().transform((v) => v ?? undefined),
  icon: z.string().optional().nullable().transform((v) => v ?? undefined),
  order: num.default(0),
  tags: z.array(z.string()).optional(),
  createdAt: num.default(0),
  updatedAt: num.default(0),
})

const settingsSchema = z
  .object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    openInNewTab: z.boolean().optional(),
    searchEngines: z.array(searchEngineSchema).optional(),
    sidebarCollapsed: z.boolean().optional(),
    allowThirdPartyMeta: z.boolean().optional(),
    allowThirdPartyFavicon: z.boolean().optional(),
    dockEnabled: z.boolean().optional(),
    dockBackTop: z.boolean().optional(),
    dockTheme: z.boolean().optional(),
    dockAddSite: z.boolean().optional(),
    dockManageCategories: z.boolean().optional(),
    dockSort: z.boolean().optional(),
    // 字符串数组即可，非法 id 由 normalizeDockOrder 过滤，避免旧备份直接失败
    dockOrder: z.array(z.string()).optional(),
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
  version: z.preprocess((val) => {
    if (val === '1' || val === 1) return 1
    return val
  }, z.literal(1, { errorMap: () => ({ message: '仅支持 version = 1 的备份文件' }) })),
  exportedAt: z.union([z.string(), z.number()]).transform((v) => String(v)),
  categories: z.array(categorySchema).default([]),
  sites: z.array(siteSchema).default([]),
  settings: settingsSchema.optional(),
})

export function parseNavExportPayload(input: unknown): NavExportPayload {
  return navExportPayloadSchema.parse(input) as NavExportPayload
}

export function safeParseNavExportPayload(input: unknown) {
  return navExportPayloadSchema.safeParse(input)
}
