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

## Mail filters

![Webhook filter editor](/feature/webhook-filter.webp)

Add conditions in the admin mail webhook or mailbox webhook settings. Each webhook evaluates its own filter independently. A mismatch skips only that webhook; mail storage, blacklists, forwarding and Telegram notifications are unaffected. No new environment variables or database migration are required.

The expression is stored in an optional `filter` property alongside `url`, `headers` and `body`, not inside the Body template. Missing or `null` filters preserve existing behavior: send every message. The visual and JSON editors use the same structure:

```json
{
  "filter": {
    "operator": "and",
    "children": [
      { "field": "from", "operator": "regex", "value": "@example\\.com>$", "options": { "flags": "i" } },
      {
        "operator": "and",
        "children": [
          {
            "operator": "or",
            "children": [
              { "field": "subject", "operator": "contains", "value": "ALERT" },
              { "field": "subject", "operator": "regex", "value": "^DOWN\\b", "options": { "flags": "i" } }
            ]
          },
          {
            "operator": "not",
            "children": [{ "field": "text", "operator": "contains", "value": "maintenance" }]
          }
        ]
      }
    ]
  }
}
```

In the page's JSON editor, enter only the expression inside `filter`, without the outer `filter` wrapper.

The root and every child share the same Rule type selector: Condition, AND, OR, NOT. AND/OR have exactly two slots and NOT has one; children can be nested. Logical nodes start with empty slots and incomplete rules cannot be saved. Removing a child clears its slot; removing the root disables filtering. Switching AND/OR preserves children; switching to another type starts a new node.

Disabling the webhook preserves the last saved filter, or no filter if none existed. Toggling does not discard JSON or visual drafts on the current page; re-enable to correct and save the draft.

### Fields and operators

| Field | Meaning |
| --- | --- |
| `from` | Parsed sender, identical to `${from}` in Body, e.g. `GitHub <notifications@github.com>`; use contains to match a name or email address |
| `to` | Actual delivery address, not the To header |
| `subject` | Parsed subject |
| `text` / `html` | Parsed plain text / HTML; absent content is an empty string. Does not search raw MIME or attachment contents |
| `header.List-ID`, etc. | All values of a named header; header names are case-insensitive. Type custom fields into the field selector |

- `and` / `or` require exactly two children; `not` requires exactly one. Children can be nested, and the root may also be a single field condition. Children cannot be `null`; use nesting to combine three or more conditions.
- `regex` uses native JavaScript `RegExp`, case-sensitive by default. Optional `options.flags`: `i` (ignore case), `m` (multiline anchors), `s` (dot matches newline). JavaScript lookahead and backreferences are supported; the backend compiles and validates expressions on save. User scripts are never executed.
- Native regex does not guarantee linear execution time; rule-length and node limits do not eliminate backtracking risks. Use simple expressions and avoid nested repetitions or other expensive patterns that could consume Worker CPU.
- For repeated headers, any matching value satisfies the condition; wrapping it in `not` requires all values not to match. Missing headers are empty lists and match no values. From filtering is not sender authentication and does not replace SPF/DKIM/DMARC.
- Limits: 8 levels, 100 nodes, 100 characters per field name, 500 characters per value. The frontend only checks editor-supported structure, fields and option keys; it does not compile regexes. The backend validates regex syntax and flags when saving or checking rules. Errors are shown on the page without replacing saved settings. The existing Test action is unaffected by filter drafts.
- Parsing/evaluation failures skip that webhook and log an error; `not` cannot turn failures into matches. Configurations without filters keep the old path. Existing Body variables and rendering are unchanged.

Attachment removal rebuilds mail using the existing flow, then restores all original From headers in their original order instead of substituting the SMTP envelope sender. If the original message has no From header, the generated line is removed. Missing or invalid From does not prevent attachment removal, and delivery filtering and stored-mail checks use the same `from` and `header.From`. Other headers, subjects and body encoding retain their existing processing, without guaranteeing byte-for-byte equality before and after removal; `to` always means the actual delivery address.

### Text operators and case sensitivity

Choose the matching behavior directly from the filter's operator selector; there is no separate case-sensitivity checkbox:

| Case-insensitive (default) | Case-sensitive | Meaning |
| --- | --- | --- |
| Equals `equals` | Equals (Case sensitive) `equalsCaseSensitive` | Match the entire field |
| Contains `contains` | Contains (Case sensitive) `containsCaseSensitive` | Find the text anywhere in the field |
| Starts with `startsWith` | Starts with (Case sensitive) `startsWithCaseSensitive` | Match the beginning of the field |
| Ends with `endsWith` | Ends with (Case sensitive) `endsWithCaseSensitive` | Match the end of the field |

For example, a subject of `DOWN service` matches the value `down` with **Contains**, but not with **Contains (Case sensitive)**. Changing the value to `DOWN` matches both. Use **Check only → Specify ID → Check only** in the filter area to verify without sending a webhook request.

JSON and the selector use the same operators, with no extra case-sensitivity option. Paste this **Contains (Case sensitive)** condition directly into the JSON editor:

```json
{ "field": "subject", "operator": "containsCaseSensitive", "value": "DOWN" }
```

Text operators do not accept `options`. Empty values are allowed; for example, **Equals** with an empty string matches an empty body. Regular expressions use `options.flags`; enter `i` to ignore case.

### Testing and reuse

**Check only** opens a dedicated dialog in the filter area, with random email / specified ID selection. It evaluates the current draft without sending a webhook. A real email is required, and mailbox ownership checks apply to selected IDs.

The original **Test** button and dialog retain their behavior: independently select mail and send the configured webhook **without applying filters**, even when the filter mismatches or its draft is invalid. Use it to test connectivity and Body rendering. The two actions have independent mail selection and loading state. Actual incoming mail still uses the saved filter to decide delivery.

Dedicated POST `/api/webhook/check_filter` and `/admin/mail_webhook/check_filter` accept only `{ "filter": expression, "mail_id": optionalMailId }` and return `{ "success": true, "matched": true/false }`. No URL, Headers or Body is required; no request is sent and no attachment links are generated. Omitting `filter` matches all mail. A real email is required, and mailbox checks can only read that mailbox's emails.

JSON parsing errors in settings saves, rule checks and delivery tests use the existing global error handler and return 500. Valid JSON with an invalid request structure returns 400. Saves and checks also reject invalid filters without replacing saved settings.

Existing `/api/webhook/test` and `/admin/mail_webhook/test` accept settings plus optional `mail_id` and keep their original queries and delivery flow, without reading or validating `filter`. Success returns `{ "success": true }`; delivery failure responses are unchanged. There is no `check_only` parameter. Random tests with no mail retain the original sample content; `${to}` in admin tests remains `admin@test.com`.

The generic backend module `worker/src/utils/filter.ts` exposes `compileFilter(expression, isFieldAllowed, operators)`, validating/compiling an expression into a function accepting string/string-array fields. Register a parameter compiler to extend operators. Mail-specific mapping and delivery-list filtering live beside the existing webhook processing functions in `common.ts`; check handlers live in their existing webhook settings API files and are referenced directly by routes. The generic frontend `FilterEditor.vue` accepts `v-model`, `fields` and `operators` (including option editor definitions), without depending on webhook APIs. The existing `WebhookComponent.vue` configures fields, operators and its independent check dialog directly, without a webhook-specific Filter wrapper. The existing delivery-test function and dialog remain unchanged. Other features can supply their own configuration to reuse the editor.

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
