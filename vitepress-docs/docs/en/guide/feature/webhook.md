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
