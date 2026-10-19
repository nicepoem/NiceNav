# Nice Nav · Chrome 扩展

将 Nice Nav 打包为 Chrome / Edge 新标签页扩展。数据仍保存在浏览器 IndexedDB 中。

## 构建

在项目根目录执行：

```bash
pnpm build:extension
```

产物输出到 [`dist/`](./dist/)，可直接作为未打包扩展加载。

## 安装（开发者模式）

1. 打开 Chrome：`chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本目录下的 `dist` 文件夹（即 `NiceNav/extension/dist`）

Edge 同理：`edge://extensions/`。

## 说明

- 扩展会覆盖浏览器「新标签页」
- 使用 hash 路由（`#/settings`），兼容 `chrome-extension://` 协议
- 构建使用相对资源路径，可离线加载
- 添加网址时，扩展后台会请求目标页面以自动识别标题与简介（需 `host_permissions`）
