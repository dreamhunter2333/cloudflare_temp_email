# Cloudflare Pages 前端

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
# 根据提示创建 pages
pnpm run deploy
```

部署完成之后你可以在 Cloudflare 控制台看到你的项目, 可以为 `pages` 配置自定义域名

![pages](/readme_assets/pages.png)
