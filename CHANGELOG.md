# CHANGE LOG

## main branch to be released

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

---
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
wrangler d1 execute dev  --file=../db/2024-04-09-patch.sql
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
