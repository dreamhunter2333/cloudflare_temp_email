<!-- markdownlint-disable-file MD004 MD024 MD034 MD036 -->
# CHANGE LOG

## main(v1.0.1)

- feat: |UI| 增加极简模式主页, 可在 `外观` 中切换
- fix: 修复 oauth2 登录时，default role 不生效的问题

## v1.0.0

- fix: |UI| 修复 User 查看收件箱，不选择地址时，关键词查询不生效
- fix: 修复自动清理任务，时间为 0 时不生效的问题
- feat: 清理功能增加 创建 n 天前地址清理，n 天前未活跃地址清理
- fix: |IMAP Proxy| 修复 IMAP Proxy 服务器，无法查看新邮件的问题

## v0.10.0

- feat: 支持 User 查看收件箱，`/user_api/mails` 接口, 支持 `address` 和 `keyword` 过滤
- fix: 修复 Oauth2 登录获取 Token 时，一些 Oauth2 需要 `redirect_uri` 参数的问题
- feat: 用户访问网页时，如果 `user token` 在 7 天内过期，自动刷新
- feat: admin portal 中增加初始化 db 的功能
- feat: 增加 `ALWAYS_SHOW_ANNOUNCEMENT` 变量，用于配置是否总是显示公告

## v0.9.1

- feat: |UI| support google ads
- feat: |UI| 使用 shadow DOM 防止样式污染
- feat: |UI| 支持 URL jwt 参数自动登录邮箱，jwt 参数会覆盖浏览器中的 jwt
- fix: |CleanUP| 修复清理邮件时，清理时间超过 30 天报错的 bug
- feat: admin 用户管理页面: 增加 用户地址查看功能
- feat: | S3 附件| 增加 S3 附件删除功能
- feat: | Admin API| 增加 admin 绑定用户和地址的 api
- feat: | Oauth2 | Oatuh2 获取用户信息时，支持 `JSONPATH` 表达式

## v0.9.0

- feat: | Worker | 支持多语言
- feat: | Worker | `NO_LIMIT_SEND_ROLE` 配置支持多角色, 逗号分割
- feat: | Actions | build 里增加 `worker-with-wasm-mail-parser.zip` 支持 UI 部署带 `wasm` 的 worker

## v0.8.7

- fix: |UI| 修复移动设备日期显示问题
- feat: |Worker| 支持通过 `SMTP` 发送邮件, 使用 [zou-yu/worker-mailer](https://github.com/zou-yu/worker-mailer/blob/main/README_zh-CN.md)

## v0.8.6

- feat: |UI| 公告支持 html 格式
- feat: |UI| `COPYRIGHT` 支持 html 格式
- feat: |Doc| 优化部署文档，补充了 `Github Actions 部署文档`，增加了 `Worker 变量说明`

## v0.8.5

- feat: |mail-parser-wasm-worker| 修复 `initSync` 函数调用时的 `deprecated` 参数警告
- feat: rpc headers covert & typo (#559)
- fix: telegram mail page use iframe show email (#561)
- feat: |Worker| 增加 `REMOVE_ALL_ATTACHMENT` 和 `REMOVE_EXCEED_SIZE_ATTACHMENT` 用于移除邮件附件，由于是解析邮件的一些信息会丢失，比如图片等.

## v0.8.4

- fix: |UI| 修复 admin portal 无收件人邮箱删除调用api 错误
- feat: |Telegram Bot| 增加 telegram bot 清理无效地址凭证命令
- feat: 增加 worker 配置 `DISABLE_ANONYMOUS_USER_CREATE_EMAIL` 禁用匿名用户创建邮箱地址，只允许登录用户创建邮箱地址
- feat: 增加 worker 配置 `ENABLE_ANOTHER_WORKER` 及 `ANOTHER_WORKER_LIST` ，用于调用其他 worker 的 rpc 接口 (#547)
- feat: |UI| 自动刷新配置保存到浏览器，可配置刷新间隔
- feat: 垃圾邮件检测增加存在时才检查的列表 `JUNK_MAIL_CHECK_LIST` 配置
- feat: | Worker | 增加 `ParsedEmailContext` 类用于缓存解析后的邮件内容，减少解析次数
- feat: |Github Action| Worker 部署增加 `DEBUG_MODE` 输出日志, `BACKEND_USE_MAIL_WASM_PARSER` 配置是否使用 wasm 解析邮件

## v0.8.3

- feat: |Github Action| 增加自动更新并部署功能
- feat: |UI| admin 用户设置，支持 oauth2 配置的删除
- feat: 增加垃圾邮件检测必须通过的列表 `JUNK_MAIL_FORCE_PASS_LIST` 配置

## v0.8.2

- fix: |Doc| 修复文档中的一些错误
- fix: |Github Action| 修复 frontend 部署分支错误的问题
- feat: admin 发送邮件功能
- feat: admin 后台，账号配置页面添加无限发送邮件的地址列表

## v0.8.1

- feat: |Doc| 更新 UI 安装的文档
- feat: |UI| 对用户隐藏邮箱账号的 ID
- feat: |UI| 增加邮件详情页的 `转发` 按钮

## v0.8.0

- feat: |UI| 随机生成地址时不超过最大长度
- feat: |UI| 邮件时间显示浏览器时区，可在设置中切换显示为 UTC 时间
- feat: 支持转移邮件到其他用户

## v0.7.6

### Breaking Changes

UI 部署 worker 需要点击 Settings -> Runtime, 修改 Compatibility flags, 增加 `nodejs_compat`

![worker-runtime](vitepress-docs/docs/public/ui_install/worker-runtime.png)

### Changes

- feat: 支持提前设置 bot info, 降低 telegram 回调延迟 (#441)
- feat: 增加 telegram mini app 的 build 压缩包
- feat: 增加是否启用垃圾邮件检查 `ENABLE_CHECK_JUNK_MAIL` 配置

## v0.7.5

- fix: 修复 `name` 的校验检查

## v0.7.4

- feat: UI 列表页面增加最小宽度
- fix: 修复 `name` 的校验检查
- fix: 修复 `DEFAULT_DOMAINS` 配置为空不生效的问题

## v0.7.3

- feat: worker 增加 `ADDRESS_CHECK_REGEX`, address name 的正则表达式, 只用于检查，符合条件将通过检查
- fix: UI 修复登录页面 tab 激活图标错位
- fix: UI 修复 admin 页面刷新弹框输入密码的问题
- feat: support `Oath2` 登录, 可以通过 `Github` `Authentik` 等第三方登录, 详情查看 [OAuth2 第三方登录](https://temp-mail-docs.awsl.uk/zh/guide/feature/user-oauth2.html)

## v0.7.2

### Breaking Changes

`webhook` 的结构增加了 `enabled` 字段，已经配置了的需要重新在页面开启并保存。

### Changes

- fix: worker 增加 `NO_LIMIT_SEND_ROLE` 配置, 加载失败的问题
- feat: worker 增加 `# ADDRESS_REGEX = "[^a-z.0-9]"` 配置, 替换非法符号的正则表达式，如果不设置，默认为 [^a-z0-9], 需谨慎使用, 有些符号可能导致无法收件
- feat: worker 优化 webhook 逻辑, 支持 admin 配置全局 webhook, 添加 `message pusher` 集成示例

## v0.7.1

- fix: 修复用户角色加载失败的问题
- feat: admin 账号设置增加来源邮件地址黑名单配置

## v0.7.0

### Breaking Changes

DB changes: 增加用户 `passkey` 表, 需要执行 `db/2024-08-10-patch.sql` 更新 `D1` 数据库

### Changes

- Docs: Update new-address-api.md (#360)
- feat: worker 增加 `ADMIN_USER_ROLE` 配置, 用于配置管理员用户角色，此角色的用户可访问 admin 管理页面 (#363)
- feat: worker 增加 `DISABLE_SHOW_GITHUB` 配置, 用于配置是否显示 github 链接
- feat: worker 增加 `NO_LIMIT_SEND_ROLE` 配置, 用于配置可以无限发送邮件的角色
- feat: 用户增加 `passkey` 登录方式, 用于用户登录, 无需输入密码
- feat: worker 增加 `DISABLE_ADMIN_PASSWORD_CHECK` 配置, 用于配置是否禁用 admin 控制台密码检查, 若你的网站只可私人访问，可通过此禁用检查

## v0.6.1

- pages github actions && 修复清理邮件天数为 0 不生效 by @tqjason (#355)
- fix: imap proxy server 不支持 密码 by @dreamhunter2333 (#356)
- worker 新增 `ANNOUNCEMENT` 配置, 用于配置公告信息 by @dreamhunter2333 (#357)
- fix: telegram bot 新建地址默认选择第一个域名 by @dreamhunter2333 (#358)

## v0.6.0

### Breaking Changes

DB changes: 增加用户角色表, 需要执行 `db/2024-07-14-patch.sql` 更新 `D1` 数据库

### Changes

worker 配置文件新增 `DEFAULT_DOMAINS`, `USER_ROLES`, `USER_DEFAULT_ROLE`, 具体查看文档 [worker配置](https://temp-mail-docs.awsl.uk/zh/guide/cli/worker.html#%E4%BF%AE%E6%94%B9-wrangler-toml-%E9%85%8D%E7%BD%AE%E6%96%87%E4%BB%B6)

- 移除 `apiV1` 相关代码和相关的数据库表
- 更新 `admin/statistics` api, 添加用户统计信息
- 更新地址的规则，只允许小写+数字，对于历史的地址在查询邮件时会进行 `lowercase` 处理
- 增加用户角色功能，`admin` 可以设置用户角色(目前可配置每个角色域名和前缀)
- admin 页面搜索优化, 回车自动搜索, 输入内容自动 trim

## v0.5.4

- 点击 logo 5 次进入 admin 页面
- 修复 401 时无法跳转登录页面(admin 和 网站认证)

## v0.5.3

- 修复 smtp imap proxy sever 的一些 bug
- 完善用户/admin 删除收件箱/发件箱的功能
- admin 可以删除 发件权限记录
- 添加中文邮件别名配置 `DOMAIN_LABELS` [文档](https://temp-mail-docs.awsl.uk/zh/guide/cli/worker.html)
- 移除 `mail channels` 相关代码
- github actions 增加 `FRONTEND_BRANCH` 变量用于指定部署的分支 (#324)

## v0.5.1

- 添加 `mail-parser-wasm-worker` 用于 worker 解析邮件, [文档](https://temp-mail-docs.awsl.uk/zh/guide/feature/mail_parser_wasm_worker.html)
- 添加校验用户邮箱长度配置 `MIN_ADDRESS_LEN` 和 `MAX_ADDRESS_LEN`
- 修复 `pages function` 未转发 `telegram` api 问题

## v0.5.0

- UI: 增加本地缓存进行地址管理
- worker: 增加 `FORWARD_ADDRESS_LIST` 全局邮件转发地址(等同于 `catch all`)
- UI: 多语言使用路由进行切换
- 添加保存附件到 S3 的功能
- UI: 增加收取邮件列表 `批量删除` 和 `批量下载`

## v0.4.6

- worker 配置文件添加 `TITLE = "Custom Title"`, 可自定义网站标题
- 修复 KV 未绑定无法删除地址的问题

## v0.4.5

- UI lazy load 懒加载
- telegram bot 添加用户全局推送功能(admin 用户)
- 增加对 cloudflare verified 用户发送邮件
- 增加使用 `resend` 发送邮件, `resend` 提供 http 和 smtp api, 使用更加方便, 文档: https://temp-mail-docs.awsl.uk/zh/guide/config-send-mail.html

## v0.4.4

- 增加 telegram mini app
- telegram bot 增加 `ubind`, `delete` 指令
- 修复 webhook 多行文本的问题

## v0.4.3

### Breaking Changes

配置文件 `main = "src/worker.js"` 改为 `main = "src/worker.ts"`

### Changes

- `telegram bot`  白名单配置
- `ENABLE_WEBHOOK` 添加 webhook
- UI: admin 页面使用双层 tab
- UI: 登录后可直接主页切换地址
- UI: 发件箱也采用左右分栏显示(类似收件箱)
- `SMTP IMAP Proxy` 添加发件箱查看

* feat: telegram bot TelegramSettings && webhook by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/244
* fix build by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/245
* feat: UI changes by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/247
* feat: SMTP IMAP Proxy: add sendbox && UI: sendbox use split view by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/248

## v0.4.2

- 修复 smtp imap proxy sever 的一些 bug
- 修复 UI 界面文字错误, 界面增加版本号
- 增加  telegram bot 文档 https://temp-mail-docs.awsl.uk/zh/guide/feature/telegram.html

* fix: imap server by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/227
* fix: Maintenance wrong label by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/229
* feat: add version for frontend && backend by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/230
* feat: add page functions proxy to make response faster by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/234
* feat: add about page by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/235
* feat: remove mailV1Alert && fix mobile showSideMargin by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/236
* feat: telegram bot by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/238
* fix: remove cleanup address due to many table need to be clean by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/240
* feat: docs: Telegram Bot by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/241
* fix: smtp_proxy: cannot decode 8bit && tg bot new random address by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/242
* fix: smtp_proxy: update raise imap4.NoSuchMailbox by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/243

### v0.4.1

- 用户名限制最长30个字符
- 修复 `/external/api/send_mail` 未返回的 bug (#222)
- 添加 `IMAP proxy` 服务，支持 `IMAP` 查看邮件
- UI 界面增加版本号显示

* feat: use common function handleListQuery when query by page by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/220
* fix: typos by @lwd-temp in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/221
* fix: name max 30 && /external/api/send_mail not return result by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/222
* fix: smtp_proxy_server support decode from mail charset by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/223
* feat: add imap proxy server by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/225
* feat: UI show version by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/226

### New Contributors

* @lwd-temp made their first contribution in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/221

## v0.4.0

### DB Changes/Breaking changes

新增 user 相关表，用于存储用户信息

- `db/2024-05-08-patch.sql`

### config changs

启用用户注册邮箱验证需要 `KV`

```toml
# kv config for send email verification code
# [[kv_namespaces]]
# binding = "KV"
# id = "xxxx"
```

### function changs

- 增加用户注册功能，可绑定邮箱地址，绑定后可自动获取邮箱JWT凭证
- 增加默认以文本显示邮件，文本和HTML邮箱显示方式切换按钮
- 修复 `BUG` 随机生成的邮箱名字不合法 #211
- `admin` 邮件页面支持邮件内容搜索 #210
- 修复删除地址时邮件未删除的BUG #213
- UI 增加全局标签页位置配置, 侧边距配置

* feat: update docs by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/204
* feat: add Deploy to Cloudflare Workers button by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/205
* feat: add Deploy to Cloudflare Workers docs by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/206
* feat: add UserLogin by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/209
* feat: admin search mailbox && fix generateName multi dot && user jwt exp in 30 days && UI globalTabplacement && useSideMargin by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/214
* feat: UI check openSettings in Login page by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/215
* feat: UI move AdminContact to common by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/217
* feat: docs by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/218

## v0.3.3

- 修复 Admin 删除邮件报错
- UI: 回复邮件按钮, 引用原始邮件文本  #186
- 添加发送邮件地址黑名单
- 添加 `CF Turnstile` 人机验证配置
- 添加 `/external/api/send_mail` 发送邮件 api, 使用 body 验证 #194

## v0.3.2

## What's Changed

- UI: 添加回复邮件按钮
- 添加定时清理功能，可在 admin 页面配置（需要在配置文件启用定时任务）
- 修复删除账户无反应的问题

* feat: UI: MailBox add reply button by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/187
* feat: add cron auto clean up by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/189
* fix: delete account by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/190

## v0.3.1

### DB Changes

新增 `settings` 表，用于存储通用配置信息

- `db/2024-05-01-patch.sql`

### Changes

- `ENABLE_USER_CREATE_EMAIL` 是否允许用户创建邮件
- 允许 admin 创建无前缀的邮件
- 添加 `SMTP proxy server`，支持 SMTP 发送邮件
- 修复某些情况浏览器无法加载 `wasm` 时使用 js 解析邮件
- 页脚添加 `COPYRIGHT`
- UI 允许用户切换邮件展示模式 `v-html` / `iframe`
- 添加 `admin` 账户配置页面，支持配置用户注册名称黑名单

* feat: support admin create address && add ENABLE_USER_CREATE_EMAIL co… by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/175
* feat: add SMTP proxy server by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/177
* fix: cf ui var is string by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/178
* fix: UI mailbox 100vh to 80vh by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/179
* fix: smtp_proxy_server hostname && add docker image for linux/arm64 by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/180
* fix: some browser do not support wasm by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/182
* feat: add COPYRIGHT by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/183
* feat: UI: add user page: useIframeShowMail && mailboxSplitSize by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/184
* feat: add address_block_list for new address by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/185

## v0.3.0

### Breaking Changes

`address` 表的前缀将从代码中迁移到 db 中，请将下面 sql 中的 `tmp` 替换为你的前缀，然后执行。
如果你的数据很重要，请先备份数据库。

**注意替换前缀**

```sql
update
    address
set
    name = 'tmp' || name;
```

### Changes

- `address` 表的前缀将从代码中迁移到 db 中
- `admin` 账户页面添加收发邮件数量
- `admin` 发件页面默认显示全部
- `admin` 发件权限页面支持搜索地址
- `admin` 邮件页面使用左右分栏 UI

* feat: remove PREFIX logic in db by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/171
* feat: admin page add account mail count && sendbox default all && sen… by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/172
* feat: all mail use MailBox Component by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/173

**Full Changelog**: https://github.com/dreamhunter2333/cloudflare_temp_email/compare/0.2.10...v0.3.0

## v0.2.10

- `ENABLE_USER_DELETE_EMAIL` 是否允许用户删除账户和邮件
- `ENABLE_AUTO_REPLY` 是否启用自动回复
- fetchAddressError 提示改进
- 自动刷新显示倒计时

* feat: docs update by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/165
* feat: add ENABLE_USER_DELETE_EMAIL && ENABLE_AUTO_REPLY && modify fetchAddressError i18n && UI: show autoRefreshInterval by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/169

## v0.2.9

- 添加富文本编辑器
- admin 联系方式，不配置则不显示，可配置任意字符串 `ADMIN_CONTACT = "xx@xx.xxx"`
- 默认发送邮件余额，如果不设置，将为 0 `DEFAULT_SEND_BALANCE = 1`

## v0.2.8

- 允许用户删除邮件
- admin 修改发件权限时邮件通知用户
- 发件权限默认 1 条
- 添加 RATE_LIMITER 限流 发送邮件 和 新建地址
- 一些 bug 修复

- feat: allow user delete mail && notify when send access changed by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/132
- feat: requset_send_mail_access default 1 balance by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/143
- fix: RATE_LIMITER not call jwt by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/146
- fix: delete_address not delete address_sender by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/153
- fix: send_balance not update when click sendmail by @dreamhunter2333 in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/155

## v0.2.7

- Added user interface installation documentation
- Support email DKIM
- Rate limiting configuration for `/api/new_address`

## v0.2.6

- Added admin query outbox page
- Add admin data cleaning page

## 2024-04-12 v0.2.5

- support send email

DB changes:

- `db/2024-04-12-patch.sql`

## 2024-04-10 v0.2.0

### Breaking Changes

- remove `ENABLE_ATTACHMENT` config
- use rust wasm to parse email in frontend
- deprecated api moved to `/api/v1`

### Rust Mail Parser

由于 nodejs 解析 email 的库有些问题，此版本切换到使用 rust wasm 调用 rust 的mail 解析库

- 速度更快，附件支持好，可以显示邮件的附件图片
- 解析支持更多 rfc 规范

Due to some problems with nodejs' email parsing library, this version switches to using rust wasm to call rust's mail parsing library.

- Faster speed, good attachment support, can display attachment images of emails
- Parsing supports more rfc specifications

### DB changs

将 `mails` 表废弃，新的 `mail` 的 `raw` 文本将直接存入 `raw_mails` 表.
The `mails` table will be discarded, and the `raw` text of the new `mail` will be directly stored in the `raw_mails` table

## Upgrade Step

```bash
git checkout v0.2.0
cd worker
wrangler d1 execute dev  --file=../db/2024-04-09-patch.sql --remote
pnpm run deploy
cd ../frontend
pnpm run deploy
```

注意：对于历史邮件，请使用部署新网页查看旧数据。
Note: For historical messages, use the Deploy New web page to view old data.

```bash
git checkout feature/backup
cd frontend
# 创建一个新的 pages, 用于访问旧数据
pnpm run deploy --project-name temp-email-v1
```

## 2024-04-09 v0.0.0

release v0.0.0

## 2024-04-03

DB changes

- `db/2024-04-03-patch.sql`

Changes:

- add delete account
- add admin panel search

## 2024-01-13

DB changes

- `db/2024-01-13-patch.sql`
