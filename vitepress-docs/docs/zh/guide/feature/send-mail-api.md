# 发送邮件 API

## 通过 HTTP API 发送邮件

有三种 HTTP API 端点可以发送邮件，区别如下：

| 端点 | 认证方式 | 适用场景 |
|------|---------|---------|
| `/api/send_mail` | `Authorization: Bearer <地址JWT>` header | 内部调用，需要先通过 cookie / header 鉴权 |
| `/external/api/send_mail` | 请求体中的 `token` 字段 | 外部系统集成，无需 header 鉴权 |
| `/user_api/address/:address_id/send_mail` | `x-user-token: <用户JWT>` header | 已登录用户使用自己的绑定邮箱发信 |

::: tip 什么是"地址 JWT"？
地址 JWT 是通过 `/api/new_address` 或 `/admin/new_address` 创建邮箱地址时返回的 `jwt` 字段。
你可以在前端 UI 的「密码」菜单中查看它。它**不是** `JWT_SECRET` 环境变量，也**不是** admin 密码。
:::

### 方式一：通过 Header 认证（`/api/send_mail`）

```python
send_body = {
    "from_name": "发件人名字",
    "to_name": "收件人名字",
    "to_mail": "收件人地址",
    "subject": "邮件主题",
    "is_html": False,  # 根据内容设置是否为 HTML
    "content": "<邮件内容：html 或者 文本>",
}

res = requests.post(
    "https://你的worker域名/api/send_mail",
    json=send_body, headers={
        "Authorization": f"Bearer {地址JWT}",
        # "x-custom-auth": "<你的网站密码>", # 如果启用了私有站点密码
        "Content-Type": "application/json"
    }
)
```

### 方式二：通过 Body Token 认证（`/external/api/send_mail`）

适合外部系统调用，将地址 JWT 放在请求体的 `token` 字段中：

```python
send_body = {
    "token": "<地址JWT>",
    "from_name": "发件人名字",
    "to_name": "收件人名字",
    "to_mail": "收件人地址",
    "subject": "邮件主题",
    "is_html": False,  # 根据内容设置是否为 HTML
    "content": "<邮件内容：html 或者 文本>",
}
res = requests.post(
    "https://你的worker域名/external/api/send_mail",
    json=send_body, headers={
        # "x-custom-auth": "<你的网站密码>", # 如果启用了私有站点密码
        "Content-Type": "application/json"
    }
)
```

### 方式三：使用用户 JWT（`/user_api/address/:address_id/send_mail`）

`address_id` 可从分页接口 `GET /user_api/bind_address` 的结果中获取。后端会验证该地址属于当前用户，客户端不能自行指定发件邮箱。

如果站点通过 `NO_LIMIT_SEND_ROLE` 为当前用户角色配置了无限发信额度，还需要传入 `GET /user_api/settings` 返回的 `access_token`。前端会自动处理该令牌。

```python
send_body = {
    "from_name": "发件人名字",
    "to_name": "收件人名字",
    "to_mail": "收件人地址",
    "subject": "邮件主题",
    "is_html": False,
    "content": "邮件内容",
}

res = requests.post(
    "https://你的worker域名/user_api/address/123/send_mail",
    json=send_body,
    headers={
        "x-user-token": "<用户JWT>",
        # "x-user-access-token": "<用户访问令牌>",  # 使用角色权限时需要
        "Content-Type": "application/json",
    },
)
```

同一组用户地址接口还包括：

| 方法 | 端点 | 说明 |
| --- | --- | --- |
| `GET` | `/user_api/address/:address_id/settings` | 获取地址和剩余发信额度 |
| `POST` | `/user_api/address/:address_id/request_send_mail_access` | 为该地址申请发信权限 |
| `GET` | `/user_api/sendbox?limit=20&offset=0&address=可选地址` | 分页获取当前用户的发件箱，可按绑定地址过滤 |
| `DELETE` | `/user_api/sendbox/:mail_id` | 删除当前用户的一条发件记录 |

以上接口都需要用户 JWT。地址级接口验证 `address_id` 是否绑定到当前用户，用户级发件箱接口只返回或删除当前用户绑定地址的记录；用户访问令牌仅用于应用可选的角色权限。

## 通过 SMTP 发送邮件

请先参考 [配置 SMTP 代理](/zh/guide/feature/config-smtp-proxy.html)。

这是一个 `python` 的例子，使用 `smtplib` 库发送邮件。

`JWT令牌密码`: 即为邮箱登录密码，可以在 UI 界面中查看密码菜单中查看。

```python
import smtplib

from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


with smtplib.SMTP('localhost', 8025) as smtp:
    smtp.login("jwt", "此处填写你的JWT令牌密码")
    message = MIMEMultipart()
    message['From'] = "Me <me@awsl.uk>"
    message['To'] = "Admin <admin@awsl.uk>"
    message['Subject'] = "测试主题"
    message.attach(MIMEText("测试内容", 'html'))
    smtp.sendmail("me@awsl.uk", "admin@awsl.uk", message.as_string())
```
