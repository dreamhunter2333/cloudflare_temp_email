# 查看邮件 API

## 邮箱密码登录会话

同时启用 `ENABLE_ADDRESS_PASSWORD=true` 和 `ADDRESS_PASSWORD_LOGIN_ONLY=true` 后，密码登录、创建邮箱以及用户中心、管理员或 Telegram 的授权访问会签发 `type: "address_password_login"` 的邮箱 JWT，包含 `address`、`address_id`、`iat` 和 `exp`，有效期为 30 天。邮箱 API 继续使用 `Authorization: Bearer <jwt>`，无需数据库迁移。

- `GET /api/settings` 返回邮箱身份信息、`send_balance` 和 `new_address_token`。有效密码登录 JWT 剩余不足 7 天时返回新的 30 天 token，否则为 `null`；已过期 JWT 必须重新登录，旧凭据不会续期。
- 网页一次成功的 settings 请求即可保存续期 token 并更新本地邮箱缓存，无需二次验证请求。外部客户端应同样保存 `new_address_token`。
- 本地邮箱沿用 token 字符串缓存，通过解码 JWT 显示邮箱地址和登录方式；凭据登录和密码登录记录分别保留，续期时原位替换同类记录。解码仅用于显示和缓存去重，权限仍由后端校验；请求失败时保留原 token 和缓存。
- 关闭开关或禁用邮箱密码后，新登录和授权访问恢复旧凭据签发。已签发且仍有效的密码登录 JWT 继续可用并可续期。旧凭据、`/open_api/credential_login`、凭据登录链接和直接 API 访问仍被接受；此配置目前不全面禁用旧凭据访问。
- Telegram 继续使用独立的永久内部绑定 token。仅对验证 Telegram 身份后从存储读取的历史绑定忽略过期时间，仍验证签名和邮箱身份；新绑定提交的 token 必须通过正常邮箱鉴权。

邮箱内的密码修改继续使用 `POST /api/address_change_password`，不新增用户 tab 重置入口，也不要求旧密码。修改密码不撤销已签发的 JWT，有效会话仍可续期。

## 通过 邮件 API 查看邮件

这是一个 `python` 的例子，使用 `requests` 库查看邮件。

```python
limit = 10
offset = 0
res = requests.get(
    f"https://<你的worker地址>/api/mails?limit={limit}&offset={offset}",
    headers={
        "Authorization": f"Bearer {你的JWT密码}",
        # "x-custom-auth": "<你的网站密码>", # 如果启用了私有站点密码
        "Content-Type": "application/json"
    }
)
```

**注意**：`/api/mails` 按设计返回的是原始 RFC822 数据（如 `source`/`raw`），不保证直接包含 `subject`、`text`、`html` 等已解析字段。若要直接读取正文，请在客户端侧解析 `raw`（例如 `mail-parser-wasm`、`postal-mime`）。

## admin 邮件 API

支持 `address` 过滤

```python
import requests

url = "https://<你的worker地址>/admin/mails"

querystring = {
    "limit":"20",
    "offset":"0",
    # address 为可选参数
    "address":"xxxx@awsl.uk"
}

headers = {
        "x-admin-auth": "<你的Admin密码>",
        # "x-custom-auth": "<你的网站密码>", # 如果启用了私有站点密码
    }

response = requests.get(url, headers=headers, params=querystring)

print(response.json())
```

**注意**：`/admin/mails` 与 `/api/mails` 一致，返回的是邮件数据库中的 raw MIME 内容；如需正文/主题等可读字段，请在客户端自行解析 `raw`。

**注意**：后端 API 已移除关键词过滤功能。如需按内容过滤邮件，请使用前端界面的过滤输入框，该功能可过滤当前显示的页面。

## 邮件已读状态 API

启用 `ENABLE_MAIL_READ_STATUS` 并升级数据库后可使用。历史邮件的 `is_unread` 为 `NULL`，视为已读；新邮件为 `1`。用户在网页邮件列表中点击未读邮件后会将其设为已读，也可以在邮件详情中手动切换状态；刷新页面不会自动标记：

- `PATCH /api/mails/:id/read`：设置当前地址下单封邮件的状态，请求体为 `{ "isUnread": true }`（未读）或 `{ "isUnread": false }`（已读）

## admin 获取单封邮件 API

无需邮箱 JWT，通过邮件 ID 获取单封邮件，并使用 `x-admin-auth` 认证。
返回结构与 `/admin/mails` 中的单条记录一致：gzip 压缩的原始邮件会解压到 `raw`，响应不包含 `raw_blob`。

```python
import requests

mail_id = 1
url = f"https://<你的worker地址>/admin/mails/{mail_id}"

headers = {
        "x-admin-auth": "<你的Admin密码>",
        # "x-custom-auth": "<你的网站密码>", # 如果启用了私有站点密码
    }

response = requests.get(url, headers=headers)

print(response.json())
```

## admin 删除邮件 API

通过邮件 ID 删除单封邮件。

```python
import requests

mail_id = 1
url = f"https://<你的worker地址>/admin/mails/{mail_id}"

headers = {
        "x-admin-auth": "<你的Admin密码>",
        # "x-custom-auth": "<你的网站密码>", # 如果启用了私有站点密码
    }

response = requests.delete(url, headers=headers)

print(response.json())
```

## admin 删除邮箱地址 API

通过邮箱地址 ID 删除邮箱地址（同时删除该地址关联的邮件、发件权限和用户绑定）。

```python
import requests

address_id = 1
url = f"https://<你的worker地址>/admin/delete_address/{address_id}"

headers = {
        "x-admin-auth": "<你的Admin密码>",
        # "x-custom-auth": "<你的网站密码>", # 如果启用了私有站点密码
    }

response = requests.delete(url, headers=headers)

print(response.json())
```

## admin 清空收件箱 API

通过邮箱地址 ID 清空该地址的所有收件。

```python
import requests

address_id = 1
url = f"https://<你的worker地址>/admin/clear_inbox/{address_id}"

headers = {
        "x-admin-auth": "<你的Admin密码>",
        # "x-custom-auth": "<你的网站密码>", # 如果启用了私有站点密码
    }

response = requests.delete(url, headers=headers)

print(response.json())
```

## admin 清空发件箱 API

通过邮箱地址 ID 清空该地址的所有发件。

```python
import requests

address_id = 1
url = f"https://<你的worker地址>/admin/clear_sent_items/{address_id}"

headers = {
        "x-admin-auth": "<你的Admin密码>",
        # "x-custom-auth": "<你的网站密码>", # 如果启用了私有站点密码
    }

response = requests.delete(url, headers=headers)

print(response.json())
```

## user 邮件 API

::: warning 注意：用户 JWT vs 地址 JWT
此接口使用**用户 JWT**（通过 `/user_api/login` 或 `/user_api/register` 获得），使用 `x-user-token` header。

**请勿与地址 JWT 混淆**：
- 地址 JWT 使用 `Authorization: Bearer <jwt>` 访问 `/api/*` 接口
- 用户 JWT 使用 `x-user-token: <jwt>` 访问 `/user_api/*` 接口
:::

### 用户绑定地址列表

`GET /user_api/bind_address` 使用服务端分页，支持以下查询参数：

未携带分页参数时返回默认第一页，不支持一次获取全部绑定地址。

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `limit` | `20` | 每页数量，范围为 1–100 |
| `offset` | `0` | 分页偏移量 |
| `query` | 空 | 可选，按邮箱地址关键字筛选当前用户已绑定的地址；最长 100 个字符，不可包含 `%` 或 `_`，非法查询返回 400 |

响应中的 `results` 仅包含当前页。仅 `offset=0` 时查询筛选后的总数，后续页面的 `count` 为 `0`，客户端应保留第一页返回的总数。

```python
import requests

url = "https://<你的worker地址>/user_api/bind_address"
headers = {
    "x-user-token": "<你的用户JWT Token>",
}
querystring = {
    "limit": "20",
    "offset": "0",
}
response = requests.get(url, headers=headers, params=querystring)
print(response.json())
```

### 用户邮件列表

支持 `address` 过滤

```python
import requests

url = "https://<你的worker地址>/user_api/mails"

querystring = {
    "limit":"20",
    "offset":"0",
    # address 为可选参数
    "address":"xxxx@awsl.uk"
}

headers = {
        "x-user-token": "<你的用户JWT Token>",
        # "x-custom-auth": "<你的网站密码>", # 如果启用了私有站点密码
    }

response = requests.get(url, headers=headers, params=querystring)

print(response.json())
```

**注意**：`/user_api/mails` 同样返回原始 RFC822 内容；请在客户端解析后提取 `subject`、`text`、`html`。

**注意**：后端 API 已移除关键词过滤功能。如需按内容过滤邮件，请使用前端界面的过滤输入框，该功能可过滤当前显示的页面。
