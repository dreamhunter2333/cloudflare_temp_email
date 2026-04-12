# Cloudflare Pages 前端

> [!warning] 注意
> 下面几种方式选择一种即可

## 部署带有前端资源的 Worker

参考 [部署 Worker](/zh/guide/cli/worker#部署带有前端页面的-worker-可选)

## 前后端分离部署

> [!warning] 重要：SPA 模式
> 本项目是单页应用（SPA）。如果你通过 Cloudflare 控制台手动上传部署，**必须在高级选项中将「未找到处理」设置为 `Single-page application (SPA)`**，否则刷新页面或直接访问 `/admin` 等子路径时会返回 404。
> 通过 CLI（`wrangler pages deploy`）部署时会自动处理，无需额外配置。
>
> ![pages spa setting](/ui_install/pages-spa-setting.jpg)

第一次部署会提示创建项目, `production` 分支请填写 `production`

```bash
cd frontend
pnpm install
cp .env.example .env.prod
```

修改 `.env.prod` 文件

将 `VITE_API_BASE` 修改为上一步创建的 `worker` 的 `url`, 不要在末尾加 `/`

例如: `VITE_API_BASE=https://xxx.xxx.workers.dev`

```bash
pnpm build --emptyOutDir
# 第一次部署会提示创建项目, production 分支请填写 production
pnpm run deploy
```

部署完成之后你可以在 Cloudflare 控制台看到你的项目, 可以为 `pages` 配置自定义域名

![pages](/readme_assets/pages.png)

## 通过 page functions 转发后端请求

从 page functions 转发请求到 worker 后端, 可以获取更快的响应速度

第一次部署会提示创建项目, `production` 分支请填写 `production`

如果你的 worker 后端 名称不为 `cloudflare_temp_email` 请修改 `pages/wrangler.toml`

```bash
cd frontend
pnpm install
# 如果你要启用 Cloudflare Zero Trust, 需要使用 pnpm build:pages:nopwa 来禁用缓存
pnpm build:pages
cd ../pages
pnpm run deploy
```
