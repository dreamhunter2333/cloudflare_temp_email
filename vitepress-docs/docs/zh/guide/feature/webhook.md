# 配置 webhook

> [!NOTE]
> 如果要使用 webhook，请先绑定 `KV` 并且 `worker` 变量配置 `ENABLE_WEBHOOK = true`
>
> 如果你想 webhook 的解析邮件能力更强，参考 [配置 worker 使用 wasm 解析邮件](/zh/guide/feature/mail_parser_wasm_worker)

## 前提条件

你需要自建一个 `webhook 服务` 或者 使用 `第三方平台`，这个服务需要能够接收 `POST` 请求，并且能够解析 `json` 数据。

本项目使用了 [songquanpeng/message-pusher](https://github.com/songquanpeng/message-pusher) 示例作为 webhook 服务。

- 可以使用 [msgpusher.com](https://msgpusher.com) 提供的服务
- 也可以自建 `message-pusher` 服务，参考 [songquanpeng/message-pusher](https://github.com/songquanpeng/message-pusher)

## admin 配置全局 webhook

![telegram](/feature/admin-mail-webhook.png)

## admin 允许邮箱使用 webhook

![telegram](/feature/admin-webhook-settings.png)

## 某个邮箱配置 webhook

![telegram](/feature/address-webhook.png)

## Webhook 模板示例

### Telegram Bot 推送

通过 Webhook 直接调用 Telegram Bot API 推送邮件通知，适合不想部署完整 Telegram Bot 集成或需要自定义推送格式的场景。

- **URL**: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/sendMessage`
- **Method**: `POST`
- **Headers**:

```json
{
    "Content-Type": "application/json"
}
```

- **Body**:

```json
{
    "chat_id": "YOUR_CHAT_ID",
    "text": "New Email\nFrom: ${from}\nTo: ${to}\nSubject: ${subject}\nURL: ${url}"
}
```

> [!TIP]
> 获取 `chat_id`：向 Bot 发送一条消息，然后访问 `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates` 查看返回结果中的 `chat.id` 字段

### 企业微信机器人推送

- **URL**: `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY`
- **Method**: `POST`
- **Headers**:

```json
{
    "Content-Type": "application/json"
}
```

- **Body**:

```json
{
    "msgtype": "text",
    "text": {
        "content": "New Email\nFrom: ${from}\nTo: ${to}\nSubject: ${subject}\nURL: ${url}"
    }
}
```

### Discord Webhook 推送

- **URL**: `https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN`
- **Method**: `POST`
- **Headers**:

```json
{
    "Content-Type": "application/json"
}
```

- **Body**:

```json
{
    "content": "**New Email**\nFrom: ${from}\nTo: ${to}\nSubject: ${subject}\nURL: ${url}"
}
```

## webhook 数据格式

Body 中可以将附件链接直接插入最终文本：

- `${attachmentLinks}`：所有附件的纯 URL，每行一个，不按文件类型过滤。
- `${attachmentMarkdownLinks}`：所有附件的 Markdown 链接 `[文件名](URL)`，每行一个，不按文件类型过滤。

例如 `{"content":"附件：\n${attachmentMarkdownLinks}"}`。无附件或未配置后端地址时，展开的链接列表为空。链接如何展示由接收平台决定。页面上的 Webhook 测试按钮也支持这些变量，使用所选测试邮件的附件。

`${attachments}` 返回所有附件的 JSON 数组，每项包含 `filename`、`mimeType`、`url`。将此变量直接放在 JSON 值的位置，**不要加引号**：

```json
{"attachments": ${attachments}}
```

例如返回 `{"attachments":[{"filename":"a.png","mimeType":"image/png","url":"https://temp-email-api.example.com/open_api/a/123/0/..."}]}`。无附件时为 `[]`。附件链接使用 `BACKEND_URL`，接收端可直接使用每项 `url`；附件序号也参与签名，不能修改路径读取其他附件。链接本身是临时访问凭证，请使用 HTTPS 传输并避免公开分享。

要获取 url 需要配置 worker 的 `FRONTEND_URL` 为你的前端地址，或者你可以通过 `id` 自己拼接 url = `${FRONTEND_URL}?mail_id=${id}`

```json
{
    "id": "${id}",
    "url": "${url}",
    "from": "${from}",
    "to": "${to}",
    "subject": "${subject}",
    "raw": "${raw}",
    "parsedText": "${parsedText}",
    "parsedHtml": "${parsedHtml}",
    "attachments": ${attachments},
    "aiExtractType": "${aiExtractType}",
    "aiExtractResult": "${aiExtractResult}",
    "aiExtractResultText": "${aiExtractResultText}",
}
```

启用 AI 邮件内容提取后，Webhook 模板可使用 `aiExtractType`、`aiExtractResult`、`aiExtractResultText` 占位符。未提取到结果时这些字段为空字符串。

点击“测试”会弹出选择框：默认随机选择邮件，也可以选择“指定 ID”并输入邮件 ID。指定邮件不存在时会报错，不会回退随机；邮箱页面只能使用当前邮箱的邮件，管理员页面可指定任意邮件。现有测试接口 `/api/webhook/test` 和 `/admin/mail_webhook/test` 的请求 Body 支持可选正整数 `mail_id`，不传则沿用随机逻辑。页面仅在测试请求中传入该参数，不会保存到 Webhook 配置。

每项 `url` 直接访问后端附件接口，使用 `JWT_SECRET` 签名并在 24 小时后失效。签名使用 52 字符的小写 Base32 编码，校验兼容签名部分的大小写，不截断 HMAC-SHA256。非 PNG、JPEG、GIF、WebP 的附件会作为文件下载。邮件被删除或附件在入库前被配置移除时，无法通过接口读取附件。

在 Worker 中配置 `BACKEND_URL = "https://temp-email-api.example.com"`，使用后端公网根地址（支持末尾斜杠），不需要前端代理。未配置时附件的 `url` 为空；邮件页面链接仍使用 `FRONTEND_URL`。

关闭 `ENABLE_WEBHOOK` 后，附件下载接口返回 403，即使链接签名尚未过期也无法下载；请求不会进入邮件数据库查询和解析流程。附件下载本身不依赖 KV，Webhook 配置的保存和读取仍需要 KV。
