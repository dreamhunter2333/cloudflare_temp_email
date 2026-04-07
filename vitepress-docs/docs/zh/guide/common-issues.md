# 常见问题 (FAQ)

> [!NOTE] 注意
> 如果你的问题没有在这里找到解决方案，请到 `Github Issues` 中搜索或者提问, 或者到 Telegram 群组中提问。

## 通用

| 问题                                               | 解决方案                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| 使用 Cloudflare Workers 给已认证的转发邮箱发送邮件 | 使用 cf 的 API 进行发送，只支持绑定到 CF 上的收件地址，即 CF EMAIL 转发目的地址 |
| 绑定多个域名                                       | 每个域名都需要设置 email 转发到 worker                                          |

## Worker 相关

| 问题                                                               | 解决方案                                                                    |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `Uncaught Error: No such module "path". imported from "worker.js"` | [参考](/zh/guide/ui/worker)                                                 |
| `No such module "node:stream". imported from "worker.js"`          | [参考](/zh/guide/ui/worker)                                                 |
| `二级域名无法发送邮件`                                             | [参考](https://github.com/dreamhunter2333/cloudflare_temp_email/issues/515) |
| `Failed to send verify code: No balance`                           | admin 后台设置无限制邮件或者发件权限页面增加额度                            |
| `Github OAuth无法获取到邮箱 400 Failed to get user email`          | 需要 github 用户设置公开邮箱                                                |
| 页面初始化时报 `Cannot read properties of undefined (reading 'map')` | 先看 `/open_api/settings` 返回是否正常。如果是 Worker 直连部署，通常是 worker 变量没有设置成功，请检查 `DOMAINS`、`ADMIN_PASSWORDS` 等 JSON 格式变量是否正确配置；如果是 Pages 前端部署并且请求打到了错误地址，则继续看下方 Pages 相关排障 |

## Pages 相关

| 问题            | 解决方案                                 |
| --------------- | ---------------------------------------- |
| `network error` | 使用无痕模式或者清空浏览器缓存，DNS 缓存 |
| Pages 部署后页面报 `map` 错误，或 `/admin/users`、`/admin/new_address` 等接口返回 `405 Method Not Allowed` | 通常是前端后端地址配置错误。请检查 `VITE_API_BASE`、UI 页面生成 zip 时填写的地址或 `FRONTEND_ENV`：前后端分离直连 Worker 时，应填写后端 Worker API 根地址，并且以 `https://` 开头、末尾不要带 `/`；如果使用 `PAGE_TOML` 通过 Page Functions 反代后端，则可保持 `VITE_API_BASE` 为空走同域请求。详见 [Pages 前端部署](/zh/guide/ui/pages) |
| 刷新页面或直接访问 `/admin`、`/user` 返回 404 | 本项目是单页应用（SPA），通过 UI 部署 Pages 时需要在高级选项中将「未找到处理」设置为 `Single-page application (SPA)`。详见 [Pages 前端部署](/zh/guide/ui/pages) |

## 发送邮件相关

| 问题            | 解决方案                                 |
| --------------- | ---------------------------------------- |
| 设置了 `DEFAULT_SEND_BALANCE` 但仍提示 `No balance` | `DEFAULT_SEND_BALANCE` 是用户**申请发信权限时**的默认额度，用户需要先在前端界面点击「申请发信权限」才会生效。也可以在 admin 后台将地址加入「无限制发送地址列表」，或配置 `NO_LIMIT_SEND_ROLE` |
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
