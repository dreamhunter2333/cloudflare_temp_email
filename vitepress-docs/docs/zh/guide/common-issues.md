# 常见问题 (FAQ)

> [!NOTE] 注意
> 如果你的问题没有在这里找到解决方案，请到 `Github Issues` 中搜索或者提问, 或者到 Telegram 群组中提问。

## 通用

| 问题                                               | 解决方案                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| 使用 Cloudflare Workers 给已认证的转发邮箱发送邮件 | 使用 cf 的 API 进行发送，只支持绑定到 CF 上的收件地址，即 CF EMAIL 转发目的地址 |
| 绑定多个域名                                       | 每个域名都需要设置 email 转发到 worker                                          |
| 子域名收不到邮件                                   | 子域名需要在 CF 上**单独启用** Email Routing 并配置 DNS 与 Catch-all 规则，仅在一级域开启不会自动覆盖子域，详见 [Email Routing](/zh/guide/email-routing) |

## Worker 相关

| 问题                                                               | 解决方案                                                                    |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `Uncaught Error: No such module "path". imported from "worker.js"` | [参考](/zh/guide/ui/worker)                                                 |
| `No such module "node:stream". imported from "worker.js"`          | [参考](/zh/guide/ui/worker)                                                 |
| `二级域名无法发送邮件`                                             | [参考](https://github.com/dreamhunter2333/cloudflare_temp_email/issues/515) |
| `Failed to send verify code: No balance`                           | admin 后台设置无限制邮件或者发件权限页面增加额度                            |
| `Github OAuth 无法获取到邮箱` / `[400]: 从 Oauth2 提供商获取用户邮箱失败` | GitHub 模板会从 `https://api.github.com/user` 的 `email` 字段读取邮箱。GitHub 账号如果隐藏公开邮箱，该字段会是 `null`，需要在 GitHub 个人资料中设置公开邮箱，或改用会返回邮箱字段的 OAuth2 提供商/接口 |
| 页面初始化时报 `Cannot read properties of undefined (reading 'map')` | 先看 `/open_api/settings` 返回是否正常。如果是 Worker 直连部署，通常是 worker 变量没有设置成功，请检查 `DOMAINS`、`ADMIN_PASSWORDS` 等 JSON 格式变量是否正确配置；如果是 Pages 前端部署并且请求打到了错误地址，则继续看下方 Pages 相关排障 |
| 后端 Worker 页面打开是 `OK`，但前端所有请求都是 `Network Error` | 先在浏览器无痕模式打开前端，排除旧前端包缓存。再确认 Cloudflare 没有对 API 域名开启 Under Attack、Bot Fight、Managed Challenge 等需要浏览器挑战的安全策略；这些挑战会拦截 XHR/API 请求并表现为 `Network Error` |
| 邮件突然收不到，删除几封邮件后恢复，Worker 日志出现 `D1_ERROR: Exceeded maximum DB size` | D1 单数据库达到容量上限后无法继续写入 `raw_mails`。请清理旧邮件、开启 admin 后台自动清理，并确认 Worker 的 `Settings -> Trigger Events -> Cron Triggers` 已添加定时触发器，否则后台清理配置不会自动执行 |

## Pages 相关

| 问题            | 解决方案                                 |
| --------------- | ---------------------------------------- |
| `Network Error` | 先使用无痕模式或者清空浏览器缓存、DNS 缓存；再打开浏览器 DevTools 的 Network 面板确认失败请求的实际 URL、状态码和响应内容 |
| Pages 部署后页面报 `map` 错误，或 `/admin/users`、`/admin/new_address` 等接口返回 `405 Method Not Allowed` | 通常是前端后端地址配置错误。请检查 `VITE_API_BASE`、UI 页面生成 zip 时填写的地址或 `FRONTEND_ENV`：前后端分离直连 Worker 时，应填写后端 Worker API 根地址，并且以 `https://` 开头、末尾不要带 `/`；如果使用 `PAGE_TOML` 通过 Page Functions 反代后端，则可保持 `VITE_API_BASE` 为空走同域请求。详见 [Pages 前端部署](/zh/guide/ui/pages) |
| 刷新页面或直接访问 `/admin`、`/user` 返回 404 | 本项目是单页应用（SPA），通过 UI 部署 Pages 时需要在高级选项中将「未找到处理」设置为 `Single-page application (SPA)`。详见 [Pages 前端部署](/zh/guide/ui/pages) |
| 管理员登录后报 `Network Error`，请求为 `/open_api/admin_login` | 检查前端生成 zip 时填写的后端 API 根地址是否就是 Worker 域名，不要填 Pages 域名、不要带 `/admin` 或 `/api`、不要带结尾 `/`。同时确认请求响应不是 Cloudflare 安全挑战页 |

## 发送邮件相关

| 问题            | 解决方案                                 |
| --------------- | ---------------------------------------- |
| 设置了 `DEFAULT_SEND_BALANCE` 但仍提示 `No balance` | 先刷新前端设置页或重试发送。当 `DEFAULT_SEND_BALANCE > 0` 时，系统只会为**尚无 `address_sender` 记录**的地址自动初始化默认额度；已有记录（包括历史 `balance = 0 且 enabled = 0` 的行、管理员禁用或手动设置的行）不会被 runtime 修改，需要管理员在后台手动启用并设置余额。也可以将地址加入「无限制发送地址列表」或配置 `NO_LIMIT_SEND_ROLE` |
| 提示 `请先为此域名启用 resend 或 smtp` | 需要先配置 `RESEND_TOKEN` 或 `SMTP_CONFIG`，详见 [配置发送邮件](/zh/guide/config-send-mail) |
| `SMTP_CONFIG` 配置了但发送失败 | 请确认 JSON 中的 key 是**你自己的发信域名**（如 `your-domain.com`），不要直接复制示例 key。详见 [配置发送邮件](/zh/guide/config-send-mail#使用-smtp-发送邮件) |

## 邮件客户端相关

| 问题            | 解决方案                                 |
| --------------- | ---------------------------------------- |
| 设置了 `ENABLE_ADDRESS_PASSWORD` 但 Foxmail/Outlook 等客户端无法登录 | `ENABLE_ADDRESS_PASSWORD` 只是开启「地址密码登录」Web 接口，**不等于**提供标准 IMAP/SMTP 服务。要使用邮件客户端收发邮件，需要额外部署 [SMTP/IMAP 代理服务](/zh/guide/feature/config-smtp-proxy) |

## Telegram Bot

| 问题                                                           | 解决方案                                           |
| -------------------------------------------------------------- | -------------------------------------------------- |
| `Telgram Bot获取邮件失败：400：Bad Request:BUTTON_URL_INVALID` | tg mini app 的 URL 填写错误，需要填写 pages 的 URL |
| `Telegram bot bind error: bind adress count reach the limit`   | 需要设置 worker 变量 `TG_MAX_ADDRESS`              |

## Github Actions

| 问题                                       | 解决方案                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| Github Action部署后，cf里始终是preview分支 | 到 cf pages 页面的设置中确认 前端的分支 和 Github Action 的 前端部署分支 是否相同 |
