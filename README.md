# Nice Nav

本地优先的个人导航起始页。纯前端 Vue 3 + TypeScript + Vite。

## 开发

```bash
pnpm install
pnpm dev
```

## 脚本

- `pnpm dev` — 开发服务器
- `pnpm build` — 生产构建
- `pnpm build:extension` — 打包 Chrome / Edge 新标签页扩展（输出到 `extension/dist`）
- `pnpm preview` — 预览构建产物
- `pnpm typecheck` — 类型检查

Chrome 扩展说明见 [`extension/README.md`](extension/README.md)。

## 积木式模块布局

布局壳 [`src/layouts/BlockShell.vue`](src/layouts/BlockShell.vue) 只负责格子；功能在 [`src/modules/`](src/modules/) 里向具名插槽填内容。

区域：`topNav` / `topFull` / `leftSidebar` / `mainTop` / `main` / `mainBottom` / `rightSidebar` / `bottomFull` / `footer`。空插槽不占位。

### 如何新增功能模块

1. 新建目录 `src/modules/<id>/`，实现需要的 slot 组件（不必填满）。
2. 在 `src/modules/<id>/index.ts` 导出 `AppModule`（`id` / `title` / `routePath` / `slots`）。
3. 在 [`src/modules/registry.ts`](src/modules/registry.ts) 中 `registerModule` 或加入初始列表。
4. 在 [`src/router/index.ts`](src/router/index.ts) 增加路由，`meta.moduleId` 指向该 id；页面用 `<ModuleHost />`（或自带 `module-id`）。
5. 在顶栏/菜单增加入口链到新路由。

参考实现：[`src/modules/nav/`](src/modules/nav/)（网址导航）。
