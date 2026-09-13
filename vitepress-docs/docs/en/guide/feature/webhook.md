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

Insert attachment links directly into the final Body text:

- `${attachmentLinks}`: Plain URLs for all attachments, one per line, without file-type filtering.
- `${attachmentMarkdownLinks}`: Markdown links `[filename](URL)` for all attachments, one per line, without file-type filtering.

For example, `{"content":"Attachments:\n${attachmentMarkdownLinks}"}`. Expanded lists are empty without attachments or a backend URL. Link rendering is determined by the receiving platform. The Webhook test buttons also support these variables using the selected test email’s attachments.

`${attachments}` provides a JSON array of all attachments, each with `filename`, `mimeType`, and `url`. Insert this placeholder directly as a JSON value, **without quotes**:

```json
{"attachments": ${attachments}}
```

Example output: `{"attachments":[{"filename":"a.png","mimeType":"image/png","url":"https://temp-email-api.example.com/open_api/a/123/0/..."}]}`. Emails without attachments produce `[]`. Attachment URLs use BACKEND_URL and can be used directly. Attachment indices are included in the signature, so modifying an index cannot grant access to another attachment. Links are temporary access credentials: use HTTPS and avoid sharing them publicly.

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
    "attachments": ${attachments},
    "aiExtractType": "${aiExtractType}",
    "aiExtractResult": "${aiExtractResult}",
    "aiExtractResultText": "${aiExtractResultText}",
}
```

When AI email extraction is enabled, webhook templates can use the `aiExtractType`, `aiExtractResult`, and `aiExtractResultText` placeholders. They are empty strings when no extraction result is available.

Click **Test** to choose a random email (default) or specify an email ID. Missing specified emails return an error without falling back to a random email. Mailbox tests can only use that mailbox's emails; administrators can select any email. The existing `/api/webhook/test` and `/admin/mail_webhook/test` endpoints accept an optional positive integer `mail_id` in the request body. Omitting it preserves random selection. The UI sends this field only for testing, without saving it in the Webhook configuration.

Each `url` directly accesses the backend attachment endpoint. It is signed with `JWT_SECRET`, and expires after 24 hours. Signatures use 52-character lowercase Base32 with case-insensitive signature verification and no HMAC-SHA256 truncation. Files other than PNG, JPEG, GIF, or WebP images are served as downloads. The endpoint cannot retrieve attachments after the email is deleted or when configuration removed them before storage.

Set `BACKEND_URL = "https://temp-email-api.example.com"` in the Worker to its public base URL (a trailing slash is supported). No frontend proxy is required. Attachment URLs are empty when unset; mail-page links continue to use `FRONTEND_URL`.

When `ENABLE_WEBHOOK` is disabled, attachment downloads return 403 even if the signature has not expired. Requests do not reach the email database lookup or parsing steps. Attachment downloads do not require KV; saving and reading Webhook configuration still requires KV.
