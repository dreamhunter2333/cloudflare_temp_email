
# 配置发送邮件

::: tip 推荐方案
推荐使用 Cloudflare `send_email` binding 作为默认发信通道。绑定 `SEND_MAIL` 并完成 Email Routing onboarding 后，即可直接向任意外部地址发信。

Workers Paid 每月含 3,000 封，超出部分 $0.35 / 1000 封。
:::

## 发信通道优先级

每次 `/api/send_mail` 请求按如下顺序匹配通道，**命中即发送**：

| 顺序 | 条件 | 通道 | 扣 balance |
|------|------|------|-----------|
| 1 | `SEND_MAIL` 已绑定 **且** 收件人在 `verifiedAddressList` | Cloudflare binding（兼容模式） | 否 |
| 2 | `RESEND_TOKEN` 或 `RESEND_TOKEN_<DOMAIN>` 已配置 | Resend API | 是 |
| 3 | `SMTP_CONFIG` 含当前域名配置 | worker-mailer SMTP | 是 |
| 4 | `SEND_MAIL` 已绑定（以上均未命中） | **Cloudflare binding（推荐主通道）** | 是 |
| — | 以上均未命中 | 抛错 | — |

> [!NOTE]
> binding 发信失败会直接报错。

## 使用 Cloudflare `send_email` binding（推荐）

仅 CLI 部署时使用，在 `wrangler.toml` 中添加：

```toml
# 通过 Cloudflare send_email binding 发送邮件
send_email = [
   { name = "SEND_MAIL" },
]
```

> [!warning] 重要
> 绑定名必须为 `SEND_MAIL`，与 Cloudflare 官方文档示例中的 `SEND_EMAIL` 不同。

完成下列步骤后即可直接向任意外部地址发信：

1. 在 Cloudflare Dashboard 给对应域名开启 Email Routing 并完成 onboarding
2. `wrangler.toml` 添加上述 `send_email` 绑定
3. 部署 Worker

无需配置任何额外的 env var。

## 使用 Resend 发送邮件

注册 `https://resend.com/domains` 根据提示添加 DNS 记录,

`API KEYS` 页面创建 `api key`

然后执行下面的命令，将 `RESEND_TOKEN` 添加到 secrets 中

> [!NOTE]
> 如果你觉得麻烦，也可以直接明文放在 `wrangler.toml` 中 `[vars]` 下面，但是不推荐这样做

如果你是通过 UI 部署的，可以在 Cloudflare 的 UI 界面中添加到 `Variables and Secrets` 下面

```bash
# 切换到 worker 目录
cd worker
wrangler secret put RESEND_TOKEN
```

如果你有多个域名，对应不同的 `api key`，可以在 `wrangler.toml` 中添加多个 secret, 名称为 `RESEND_TOKEN_` + `<. 换成 _ 的 大写域名>`,例如

```bash
wrangler secret put RESEND_TOKEN_XXX_COM
wrangler secret put RESEND_TOKEN_DREAMHUNTER2333_XYZ
```

## 使用 SMTP 发送邮件

`SMTP_CONFIG` 的格式如下，**key 必须是你自己的发信域名**，value 为 SMTP 配置。

SMTP 配置格式详情可以参考 [zou-yu/worker-mailer](https://github.com/zou-yu/worker-mailer/blob/main/README_zh-CN.md)

> [!warning] 重要
> JSON 中的 key（如下面示例中的 `your-domain.com`）必须替换为**你自己的域名**，即 `DOMAINS` 变量中配置的域名。
> 这是最常见的配置错误之一，请勿直接复制示例中的域名。

```json
{
    "your-domain.com": {
        "host": "smtp.example.com",
        "port": 465,
        "secure": true,
        "authType": [
            "plain",
            "login"
        ],
        "credentials": {
            "username": "your-smtp-username",
            "password": "your-smtp-password"
        }
    }
}
```

**字段说明：**

| 字段 | 说明 |
|------|------|
| key（如 `your-domain.com`） | 你的发信域名，必须与 `DOMAINS` 中配置的域名一致 |
| `host` | SMTP 服务器地址，如 `smtp.mailgun.org`、`smtp.gmail.com` 或你自建的 SMTP 服务器地址 |
| `port` | SMTP 端口，通常 `465`（SSL）或 `587`（STARTTLS） |
| `secure` | 是否使用 SSL/TLS，端口 465 时设为 `true`，端口 587 时设为 `false` |
| `authType` | 认证方式，一般使用 `["plain", "login"]` |
| `credentials.username` | SMTP 服务器的登录用户名 |
| `credentials.password` | SMTP 服务器的登录密码 |

如果你有**多个域名**使用不同的 SMTP 服务，在同一个 JSON 中添加多个 key 即可：

```json
{
    "domain-a.com": {
        "host": "smtp.mailgun.org",
        "port": 465,
        "secure": true,
        "authType": ["plain", "login"],
        "credentials": { "username": "user@domain-a.com", "password": "xxx" }
    },
    "domain-b.com": {
        "host": "smtp.gmail.com",
        "port": 465,
        "secure": true,
        "authType": ["plain", "login"],
        "credentials": { "username": "user@gmail.com", "password": "app-password" }
    }
}
```

然后执行下面的命令，将 `SMTP_CONFIG` 添加到 secrets 中

> [!NOTE]
> 如果你觉得麻烦，也可以直接明文放在 `wrangler.toml` 中 `[vars]` 下面，但是不推荐这样做

如果你是通过 UI 部署的，可以在 Cloudflare 的 UI 界面中添加到 `Variables and Secrets` 下面

```bash
# 切换到 worker 目录
cd worker
wrangler secret put SMTP_CONFIG
```

## 发信余额机制

用户发送邮件需要有发信余额。余额机制如下：

1. **申请发信权限**：用户需要先在前端界面点击「申请发信权限」按钮
2. **默认额度**：申请时会获得 `DEFAULT_SEND_BALANCE` 环境变量设置的默认额度（如果未设置则为 0）
3. **无限制发送**：以下方式可以跳过余额检查：
   - 在 admin 后台将地址加入「无限制发送地址列表」
   - 配置 `NO_LIMIT_SEND_ROLE` 环境变量，指定可以无限发送的用户角色

> [!NOTE]
> `DEFAULT_SEND_BALANCE` **不会**自动给所有地址充值余额，用户必须先主动申请发信权限，额度才会生效。
>
> 第 1 层 `verifiedAddressList` 命中时不扣余额，但同样计入发信额度；第 2/3/4 层统一扣 balance。
>
> 发信额度对**全部**发信渠道生效，admin 发信接口也会一起计入。
>
> 每日和每月额度按 **UTC** 时间窗口计算。
>
> 当前额度实现属于 **soft guard**，适合日常额度控制；在数据库异常或高并发场景下，它不适合作为绝对严格的成本硬闸。

## 给 Cloudflare 上已认证的转发邮箱发送邮件

适合未完成 Email Routing onboarding 的域名，或 Workers 免费版。

只有收件人在 admin 后台的 `已验证地址列表` 中时，才会通过 `SEND_MAIL` binding 发信。
