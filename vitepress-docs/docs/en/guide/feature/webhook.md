# Configure Webhook

> [!NOTE]
> If you want to use webhook, please bind `KV` first and configure the `worker` variable `ENABLE_WEBHOOK = true`
>
> If you want webhook to have stronger email parsing capabilities, refer to [Configure worker to use wasm for email parsing](/en/guide/feature/mail_parser_wasm_worker)

## Prerequisites

You need to set up your own `webhook service` or use a `third-party platform`. This service needs to be able to receive `POST` requests and parse `json` data.

This project uses [songquanpeng/message-pusher](https://github.com/songquanpeng/message-pusher) as an example webhook service.

- You can use the service provided by [msgpusher.com](https://msgpusher.com)
- You can also self-host the `message-pusher` service, refer to [songquanpeng/message-pusher](https://github.com/songquanpeng/message-pusher)

## Admin Configure Global Webhook

![telegram](/feature/admin-mail-webhook.png)

## Admin Allow Email to Use Webhook

![telegram](/feature/admin-webhook-settings.png)

## Configure Webhook for a Specific Email

![telegram](/feature/address-webhook.png)

## Webhook Template Examples

### Telegram Bot Push

Push email notifications by calling the Telegram Bot API directly via webhook. Suitable for scenarios where you don't want to deploy the full Telegram Bot integration or need a custom push format.

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
> To get your `chat_id`: send a message to the Bot, then visit `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates` and look for the `chat.id` field in the response

### WeChat Work Bot Push

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

### Discord Webhook Push

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

## Webhook Data Format

To get the url, you need to configure the worker's `FRONTEND_URL` to your frontend address, or you can construct the url yourself using `id` = `${FRONTEND_URL}?mail_id=${id}`

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
