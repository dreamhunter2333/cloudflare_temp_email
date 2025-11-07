# 通过 Github Actions 部署

::: warning 注意
目前只支持 worker 和 pages 的部署。
有问题请通过 `Github Issues` 反馈，感谢。

`worker.dev` 域名在中国无法访问，请自定义域名
:::

## 部署步骤

### Fork 仓库并启用 Actions

- 在 GitHub fork 本仓库
- 打开仓库的 `Actions` 页面
- 找到 `Deploy Backend` 点击 `enable workflow` 启用 `workflow`
- 如果需要前后端分离部署, 找到`Deploy Frontend` 点击 `enable workflow` 启用 `workflow`

### 配置 Secrets

然后在仓库页面 `Settings` -> `Secrets and variables` -> `Actions` -> `Repository secrets`, 添加以下 `secrets`:

- 公共 `secrets`

   | 名称                    | 说明                                                                                                            |
   | ----------------------- | --------------------------------------------------------------------------------------------------------------- |
   | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID, [参考文档](https://developers.cloudflare.com/workers/wrangler/ci-cd/#cloudflare-account-id) |
   | `CLOUDFLARE_API_TOKEN`  | Cloudflare API Token, [参考文档](https://developers.cloudflare.com/workers/wrangler/ci-cd/#api-token)           |

- worker 后端 `secrets`

   | 名称                           | 说明                                                                                                                                    |
   | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
   | `BACKEND_TOML`                 | 后端配置文件，[参考此处](/zh/guide/cli/worker.html#修改-wrangler-toml-配置文件)                                                         |
   | `DEBUG_MODE`                   | (可选) 是否开启调试模式，配置为 `true` 开启, 默认 worker 部署日志不会输出到 Github Actions 页面，开启后会输出                           |
   | `BACKEND_USE_MAIL_WASM_PARSER` | (可选) 是否使用 wasm 解析邮件，配置为 `true` 开启, 功能参考 [配置 worker 使用 wasm 解析邮件](/zh/guide/feature/mail_parser_wasm_worker) |
   | `USE_WORKER_ASSETS`            | (可选) 部署带有前端资源的 Worker, 配置为 `true` 开启                                                                                    |

- pages 前端 `secrets`

   > [!warning] 注意
   > 如果选择部署带有前端资源的 Worker, 则无须配置这些 `secrets`

   | 名称               | 说明                                                                                                                                                                                      |
   | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `FRONTEND_ENV`     | 前端配置文件，请复制 `frontend/.env.example` 的内容，[并参考此处修改](/zh/guide/cli/pages.html)                                                                                           |
   | `FRONTEND_NAME`    | 你在 Cloudflare Pages 创建的项目名称，可通过 [用户界面](https://temp-mail-docs.awsl.uk/zh/guide/ui/pages.html) 或者 [命令行](https://temp-mail-docs.awsl.uk/zh/guide/cli/pages.html) 创建 |
   | `FRONTEND_BRANCH`  | (可选) pages 部署的分支，可不配置，默认 `production`                                                                                                                                      |
   | `PAGE_TOML`        | (可选) 使用 page functions 转发后端请求时需要配置，请复制 `pages/wrangler.toml` 的内容，并根据实际情况修改 `service` 字段为你的 worker 后端名称                                             |
   | `TG_FRONTEND_NAME` | (可选) 你在 Cloudflare Pages 创建的项目名称，同 `FRONTEND_NAME`，如果需要 Telegram Mini App 功能，请填写                                                                                  |

### 部署

- 打开仓库的 `Actions` 页面
- 找到 `Deploy Backend` 点击 `Run workflow` 选择分支手动部署
- 如果需要前后端分离部署, 找到 `Deploy Frontend`, 点击 `Run workflow` 选择分支手动部署

## 如何配置自动更新

1. 打开仓库的 `Actions` 页面，找到 `Upstream Sync`，点击 `enable workflow` 启用 `workflow`
2. 如果 `Upstream Sync` 运行失败，到仓库主页点击 `Sync` 手动同步即可
