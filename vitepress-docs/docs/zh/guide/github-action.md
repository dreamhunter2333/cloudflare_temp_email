# 通过 Github Actions 部署

::: warning 注意
目前只支持 worker 和 pages 的部署，D1 数据库以及 Email 部分请参考 [UI/CLI 部署](/)。
有问题请通过 `Github Issues` 反馈，感谢。
自动更新不会执行 sql 文件，需要手动执行。
:::

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/dreamhunter2333/cloudflare_temp_email)

## 部署步骤

1. 点击按钮 fork 本仓库 或者直接 fork 本仓库

2. 打开仓库的 `Actions` 页面，找到 `Deploy Backend Production` 和 `Deploy Frontend`，点击 `enable workflow` 启用 `workflow`

3. 然后在仓库页面 `Settings` -> `Secrets and variables` -> `Actions` -> `Repository secrets`, 添加以下 `secrets`:

   - `CLOUDFLARE_ACCOUNT_ID`: Cloudflare 账户 ID, [参考文档](https://developers.cloudflare.com/workers/wrangler/ci-cd/#cloudflare-account-id)
   - `CLOUDFLARE_API_TOKEN`: Cloudflare API Token, [参考文档](https://developers.cloudflare.com/workers/wrangler/ci-cd/#api-token)
   - `BACKEND_TOML`: 后端配置文件，[参考此处](/zh/guide/cli/worker.html#修改-wrangler-toml-配置文件)
   - `FRONTEND_ENV`: 前端配置文件，请复制 `frontend/.env.example` 的内容，[并参考此处修改](/zh/guide/cli/pages.html)
   - `FRONTEND_NAME`: 你在 Cloudflare Pages 创建的项目名称，可通过 [用户界面](https://temp-mail-docs.awsl.uk/zh/guide/ui/pages.html) 或者 [命令行](https://temp-mail-docs.awsl.uk/zh/guide/cli/pages.html) 创建
   - `FRONTEND_BRANCH`: (可选) pages 部署的分支，可不配置，默认 `production`
   - `TG_FRONTEND_NAME`: (可选) 你在 Cloudflare Pages 创建的项目名称，同 `FRONTEND_NAME`，如果需要 Telegram Mini App 功能，请填写

4. 打开仓库的 `Actions` 页面，找到 `Deploy Backend Production` 和 `Deploy Frontend`，点击 `Run workflow` 选择分支手动部署

## 如何配置自动更新

1. 打开仓库的 `Actions` 页面，找到 `Upstream Sync`，点击 `enable workflow` 启用 `workflow`
2. 如果 `Upstream Sync` 运行失败，到仓库主页点击 `Sync` 手动同步即可
