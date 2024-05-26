
# 配置发送邮件

## 使用 Cloudflare Workers 给已认证的邮箱发送邮件

admin 后台 账号配置 `已验证地址列表(可通过 cf 内部 api 发送邮件)`

## 使用 resend 发送邮件

注册 `https://resend.com/domains` 根据提示添加 DNS 记录,

`API KEYS` 页面创建 `api key`

使用 cli 或者直接添加到 `wrangler.toml` 的 `vars`，或者在 cloudflare worker 页面的变量中添加 `RESEND_TOKEN`

```bash
wrangler secret put RESEND_TOKEN
```

如果你有多个域名，对应不同的 `api key`，可以在 `wrangler.toml` 中添加多个 secret, 名称为 `RESEND_TOKEN_` + `<. 换成 _ 的 大写域名>`,例如

```bash
wrangler secret put RESEND_TOKEN_XXX_COM
wrangler secret put RESEND_TOKEN_DREAMHUNTER2333_XYZ
```

## 使用 mailchannels 发送邮件

::: warning
[Mail Channels 免费电子邮件发送 API 将于2024年6月30日结束](https://support.mailchannels.com/hc/en-us/articles/26814255454093-End-of-Life-Notice-Cloudflare-Workers)
:::

1. 找到域名 `DNS` 记录的 `TXT` 的 `SPF` 记录, 增加 `include:relay.mailchannels.net`

    `v=spf1 include:_spf.mx.cloudflare.net include:relay.mailchannels.net ~all`

2. 新建 `_mailchannels` 记录, 类型为 `TXT`, 内容为 `v=mc1 cfid=你的worker域名`

- 此处 worker 域名为后端 api 的域名，比如我部署在 `https://temp-email-api.awsl.uk/`，则填写 `v=mc1 cfid=awsl.uk`

- 如果你的域名是 `https://temp-email-api.xxx.workers.dev`，则填写 `v=mc1 cfid=xxx.workers.dev`
