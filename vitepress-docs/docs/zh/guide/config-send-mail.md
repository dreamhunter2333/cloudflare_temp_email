
# 配置发送邮件

::: warning 注意
三种方式可以同时配置，发送邮件时会优先使用 `resend`，如果没有配置 `resend`，则会使用 `smtp`.

如果配置了 Cloudflare 已认证的转发邮箱地址，会优先使用 cf 内部 API 发送邮件
:::

## 使用 resend 发送邮件

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

`SMTP_CONFIG` 的格式如下，key 为域名，value 为 SMTP 配置，SMTP 配置格式详情可以参考 [zou-yu/worker-mailer](https://github.com/zou-yu/worker-mailer/blob/main/README_zh-CN.md)

```json
{
    "awsl.uk": {
        "host": "smtp.xxx.com",
        "port": 465,
        "secure": true,
        "authType": [
            "plain",
            "login"
        ],
        "credentials": {
            "username": "username",
            "password": "password"
        }
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

## 给 Cloudflare 上已认证的转发邮箱发送邮件

仅支持 CLI 部署时使用，在 `wrangler.toml` 中添加 `send_email` 配置

发送的目的邮箱地址必须是 Cloudflare 上已认证的邮箱地址，局限性较大，如果需要发送邮件给其他邮箱，可以使用 `resend` 或者 `smtp` 发送邮件

```toml
# 通过 Cloudflare 发送邮件
send_email = [
   { name = "SEND_MAIL" },
]
```

admin 后台 账号配置 `已验证地址列表(可通过 cf 内部 api 发送邮件)`
