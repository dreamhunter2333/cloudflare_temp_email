# 常见问题

> [!NOTE] 注意
> 如果你的问题没有在这里找到解决方案，请到 `Github Issues` 中搜索或者提问, 或者到 Telegram 群组中提问。

## 通用

| 问题                                           | 解决方案                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------- |
| 使用 Cloudflare Workers 给已认证的邮箱发送邮件 | 使用 cf 的 API 进行发送，只支持绑定到 CF 上的收件地址，即 CF EMAIL 转发目的地址 |
| 绑定多个域名                                   | 每个域名都需要设置 email 转发到 worker                                          |

## worker 相关

| 问题                                                               | 解决方案                                                                    |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `Uncaught Error: No such module "path". imported from "worker.js"` | [参考](/zh/guide/ui/worker)                                                 |
| `No such module "node:stream". imported from "worker.js"`          | [参考](/zh/guide/ui/worker)                                                 |
| `二级域名无法发送邮件`                                             | [参考](https://github.com/dreamhunter2333/cloudflare_temp_email/issues/515) |
| `Failed to send verify code: No balance`                           | admin 后台设置无限制邮件或者发件权限页面增加额度                            |
| `Github OAuth无法获取到邮箱 400 Failed to get user email`          | 需要 github 用户设置公开邮箱                                                |
| `Cannot read properties of undefined (reading 'map')`              | worker 变量没有设置成功                                                     |

## pages 相关

| 问题            | 解决方案                                 |
| --------------- | ---------------------------------------- |
| `network error` | 使用无痕模式或者清空浏览器缓存，DNS 缓存 |

## telegram bot

| 问题                                                           | 解决方案                                           |
| -------------------------------------------------------------- | -------------------------------------------------- |
| `Telgram Bot获取邮件失败：400：Bad Request:BUTTON_URL_INVALID` | tg mini app 的 URL 填写错误，需要填写 pages 的 URL |
| `Telegram bot bind error: bind adress count reach the limit`   | 需要设置 worker 变量 `TG_MAX_ADDRESS`              |

## Github Actions

| 问题                                       | 解决方案                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| Github Action部署后，cf里始终是preview分支 | 到 cf pages 页面的设置中确认 前端的分支 和 Github Action 的 前端部署分支 是否相同 |
