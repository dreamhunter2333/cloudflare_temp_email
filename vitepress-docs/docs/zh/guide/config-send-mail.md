
# 配置发送邮件

## 使用 Cloudflare Workers 给已认证的邮箱发送邮件

admin 后台 账号配置 `已验证地址列表(可通过 cf 内部 api 发送邮件)`

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
