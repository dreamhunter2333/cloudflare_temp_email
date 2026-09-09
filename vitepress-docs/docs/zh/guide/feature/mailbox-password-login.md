# 仅允许邮箱密码登录

```toml
ENABLE_ADDRESS_PASSWORD = true
ADDRESS_PASSWORD_LOGIN_ONLY = true
```

新开关默认 `false`，只有启用邮箱密码时才生效。开启后，后端拒绝旧邮箱凭据，包括直接访问邮箱 API；关闭凭据登录接口和 `?jwt=` 登录入口，前端隐藏凭据及自动登录链接。创建邮箱后仍显示生成的邮箱密码，用户中心和管理员仍可打开有权访问的邮箱，并获得新登录 JWT。

历史邮箱如果没有密码，需要由绑定用户或管理员设置；启用密码功能不会自动为历史邮箱生成密码。不需要数据库迁移。

## 邮箱登录 JWT

密码登录返回的 `jwt` 使用新 payload，在原有 `address`、`address_id` 上增加 `type: "address_password_login"`、`iat` 和 `exp`。有效期为 30 天，邮箱 API 仍使用 `Authorization: Bearer <jwt>`，中间件统一校验签名、类型、有效期和邮箱是否存在，业务 API 使用原有的地址字段。

`GET /api/settings` 返回当前登录信息（`address`、`address_id`，密码登录还包含 `type`、`iat`、`exp`）、发信余额及 `new_address_token`。有效登录 JWT 剩余不足 7 天时，`new_address_token` 为新签发的 30 天 JWT；否则为 `null`。

前端与用户登录采用相同流程：`getSettings()` 获取设置，使用返回的新 JWT 再次请求 `settings` 校验，成功后更新当前 JWT 和本地邮箱缓存。续期响应不会覆盖已经切换的邮箱。续期只在加载邮箱设置时处理，普通 API 请求不额外检查或刷新 JWT。

本地邮箱缓存保存 token 及 `settings` 返回的邮箱名称和登录类型，前端不解码 JWT。旧凭据与密码登录 JWT 独立保留，同邮箱、同类型在登录或续期校验成功后更新。列表标明登录方式，启用“只允许密码登录”后隐藏已识别的旧凭据入口，但保留缓存。历史缓存只有 token 时先显示“已保存邮箱”，选中且验证成功后补全信息；后端始终拒绝已禁用的凭据。

已过期 JWT 不能续期，需要重新登录；旧凭据不能通过 `settings` 换取新登录 JWT。开关关闭时，原有凭据仍按原逻辑使用，密码登录仍返回新格式 JWT。

外部客户端继续使用相同的 API 和请求头；使用新登录 JWT 时需接收并保存 `settings.new_address_token`。启用开关后，SMTP/IMAP、Agent 等客户端直接使用旧凭据访问邮箱 API 也会被拒绝。

## Telegram 绑定

Telegram 在创建或绑定邮箱后，在 KV 中保存 `type: "telegram_binding"` 的不过期 token。此 token 仅供 Telegram 内部使用，邮箱 API 不接受它。Bot 和 Mini App 先验证 Telegram 身份，再读取对应用户的绑定，并检查邮箱仍然存在。

Mini App 打开邮箱时，根据当前登录策略签发邮箱 JWT；启用仅密码登录后，该 JWT 有效期为 30 天，由网页沿用上述流程续期。KV 中的绑定不需要跟随网页 JWT 续期。

已有 KV 绑定兼容旧格式，仅在 Telegram 内部验证签名和邮箱身份时不检查 token 的过期时间。外部提交的绑定请求仍按邮箱 API 规则校验 JWT，不能使用已禁用的旧凭据或过期 JWT 新增绑定。解绑或删除邮箱后，原 Telegram 绑定不再授予访问权限。

## 用户重置绑定邮箱密码

用户中心邮箱列表提供“重置密码”，不需要邮箱原密码。此功能仅依赖 `ENABLE_ADDRESS_PASSWORD`，不要求开启仅密码登录。

```http
POST /user_api/address/:address_id/reset_password
x-user-token: <用户JWT>
Content-Type: application/json

{"new_password":"<新密码的64位小写SHA-256十六进制值>"}
```

后端在同一条更新语句中确认用户存在及当前绑定关系，只更新现有 `password`、`updated_at` 字段。成功返回 `{"success":true}`；未登录返回 401，邮箱不属于当前用户或密码功能关闭返回 403，输入格式错误返回 400。

密码重置只修改密码，不撤销已经签发的登录 JWT；有效登录 JWT 仍可续期。本方案不新增会话表或撤销状态。
