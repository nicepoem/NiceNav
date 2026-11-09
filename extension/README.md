# Nice Nav · Chrome 扩展

将 Nice Nav 打包为 Chrome / Edge 新标签页扩展。数据仍保存在浏览器 IndexedDB 中。

与 `pnpm dev` / `pnpm start` **共用同一套 UI**；抓取能力通过扩展后台对齐同源 API（无需按站点弹窗）。

## 构建

在项目根目录执行：

```bash
pnpm build:extension
```

会先更新 MDI 图标子集（与网页 `build` 一致），产物输出到 [`dist/`](./dist/)，可直接作为未打包扩展加载。

## 安装（开发者模式）

1. 打开 Chrome：`chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本目录下的 `dist` 文件夹（即 `NiceNav/extension/dist`）

Edge 同理：`edge://extensions/`。

修改代码后重新 `pnpm build:extension`，再在扩展页点击「重新加载」。

## 三端对齐说明

| 能力 | `pnpm dev` / `pnpm start` | 扩展包 |
| --- | --- | --- |
| 界面 / 主题 | 同源样式 | 同源样式 |
| 页面元数据 | `/api/page-meta` | background `FETCH_PAGE_META`（`host_permissions`） |
| 图标探测 | `/api/icon-probe` | background `PROBE_ICON` |
| 第三方兜底 | 仅设置开启时 | 仅设置开启时 |

对比效果前请先**导出再导入同一份导航数据**：IndexedDB 按源隔离（`localhost` ≠ `chrome-extension://…`），数据不同会造成「看起来不一样」。

## 其它说明

- 扩展会覆盖浏览器「新标签页」
- 使用 hash 路由，兼容 `chrome-extension://` 协议
- 构建使用相对资源路径，可离线加载
- `host_permissions` 在安装/加载时一次性授权，添加网址时不再按站点弹窗
