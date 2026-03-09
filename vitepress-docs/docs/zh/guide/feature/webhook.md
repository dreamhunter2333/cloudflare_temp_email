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
}
```
