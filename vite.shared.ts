import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import type { PluginOption } from 'vite'

/** 网页与扩展共用的 Vue / 自动导入 / 别名 */
export function createSharedVuePlugins(): PluginOption[] {
  return [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver({ importStyle: 'css' })],
      dts: 'src/types/auto-imports.d.ts',
    }),
    Components({
      resolvers: [ElementPlusResolver({ importStyle: 'css' })],
      dts: 'src/types/components.d.ts',
    }),
  ]
}

export const sharedResolveAlias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
  '@nice-nav/core': fileURLToPath(new URL('./src/core', import.meta.url)),
}
