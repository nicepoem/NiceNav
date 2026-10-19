import { copyFileSync, cpSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

const rootDir = fileURLToPath(new URL('.', import.meta.url))
const outDir = resolve(rootDir, 'extension/dist')

/** 扩展页面不发送 CORS 头，带 crossorigin 的模块脚本会被浏览器拒绝加载 */
function stripCrossOrigin(): Plugin {
  return {
    name: 'strip-crossorigin',
    transformIndexHtml(html) {
      return html.replace(/\s+crossorigin(?:="[^"]*")?/g, '')
    },
  }
}

function copyExtensionAssets(): Plugin {
  return {
    name: 'copy-extension-assets',
    closeBundle() {
      mkdirSync(resolve(outDir, 'icons'), { recursive: true })
      copyFileSync(
        resolve(rootDir, 'extension/manifest.json'),
        resolve(outDir, 'manifest.json'),
      )
      copyFileSync(
        resolve(rootDir, 'extension/background.js'),
        resolve(outDir, 'background.js'),
      )
      cpSync(resolve(rootDir, 'extension/icons'), resolve(outDir, 'icons'), {
        recursive: true,
      })
    },
  }
}

export default defineConfig({
  base: './',
  define: {
    'import.meta.env.VITE_APP_TARGET': JSON.stringify('extension'),
  },
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      dts: 'src/types/auto-imports.d.ts',
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'src/types/components.d.ts',
    }),
    stripCrossOrigin(),
    copyExtensionAssets(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@nice-nav/core': fileURLToPath(new URL('./src/core', import.meta.url)),
    },
  },
  build: {
    outDir,
    emptyOutDir: true,
    sourcemap: false,
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
