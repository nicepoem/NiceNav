import { defineConfig, type Plugin } from 'vite'
import { createMetaApiMiddleware } from './server/meta-api.mjs'
import { createSharedVuePlugins, sharedResolveAlias } from './vite.shared.ts'

/** 开发 / preview 同源代抓页面元数据与图标探测 */
function pageMetaProxy(): Plugin {
  const attach = (server: { middlewares: { use: (fn: unknown) => void } }) => {
    server.middlewares.use(createMetaApiMiddleware())
  }
  return {
    name: 'page-meta-proxy',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}

export default defineConfig({
  plugins: [pageMetaProxy(), ...createSharedVuePlugins()],
  resolve: {
    alias: sharedResolveAlias,
  },
  server: {
    // true：同时监听 IPv4/IPv6，避免 localhost 与 127.0.0.1 表现不一致
    host: true,
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('element-plus') || id.includes('@element-plus')) return 'element-plus'
          if (id.includes('vue-router') || id.includes('pinia') || id.includes('/vue/')) {
            return 'vue-vendor'
          }
          if (id.includes('dexie')) return 'dexie'
          if (id.includes('zod')) return 'zod'
          if (id.includes('sortablejs')) return 'sortable'
          if (id.includes('@iconify')) return 'iconify'
        },
      },
    },
  },
})
