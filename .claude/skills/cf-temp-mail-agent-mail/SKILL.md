---
name: cf-temp-mail-agent-mail
description: Read mails from a cloudflare_temp_email mailbox using a user-supplied Address JWT and API base URL. Use when the user (or an agent such as OpenClaw / Codex / Cursor) needs to list the inbox, fetch a specific message, or extract a verification code / magic link via the server-parsed /api/parsed_mails and /api/parsed_mail/:id endpoints. Falls back to local parsing of /api/mail/:id raw source with mail-parser-wasm + postal-mime if the parsed endpoints are unavailable. Does NOT handle mailbox creation — the user provides the JWT themselves.
---

# Temp-Mail Read-Only Usage

## Prerequisites

The user must first **open the frontend** (e.g. `https://mail.example.com`) in a browser and create or log into a mailbox address. This step may require passing a Turnstile CAPTCHA that agents cannot complete. After that, the **Address JWT** is displayed in the frontend UI and can be copied directly.

## Inputs the user must provide

- `BASE` — API base URL, e.g. `https://mail.example.com`.
- `JWT` — Address JWT, visible and copyable from the frontend UI after creating or logging into a mailbox.
- *(optional)* `SITE_PASSWORD` — only if the deployment enabled `x-custom-auth`.

If anything is missing, ask the user before making requests.

## Required headers

- `Authorization: Bearer <JWT>` — on every `/api/*` request.
- `x-custom-auth: <SITE_PASSWORD>` — only when the site requires it.
- `x-lang: en` or `zh` — optional, error-message language.

Do not send the Address JWT as `x-user-token` — that is a different JWT type and will yield `401 InvalidAddressCredentialMsg`.

## Primary path: parsed endpoints

| Task                | Method | Path                               | Returns                                   |
| ------------------- | ------ | ---------------------------------- | ----------------------------------------- |
| Address info        | GET    | `/api/settings`                    | `{ address, send_balance }`               |
| List parsed mails   | GET    | `/api/parsed_mails?limit=&offset=` | `{ results: [parsedMail], count }`        |
| Get one parsed mail | GET    | `/api/parsed_mail/:id`             | `parsedMail`                              |

`limit` 1–100, `offset` 0-based. On `429`, back off.

`parsedMail` shape:

```json
{
  "id": 42,
  "message_id": "<...>",
  "source": "noreply@foo.com",
  "to": "abc@yourdomain.com",
  "created_at": "2026-04-21 10:00:00",
  "sender":  "Foo <noreply@foo.com>",
  "subject": "Your code is 123456",
  "text":    "Your code is 123456\n",
  "html":    "<p>Your code is <b>123456</b></p>",
  "attachments": [
    { "filename": "a.pdf", "mimeType": "application/pdf", "disposition": "attachment", "size": 12345 }
  ]
}
```

Attachments carry metadata only; no binary content.

### 1. Smoke-test the JWT

```bash
curl -s "$BASE/api/settings" -H "Authorization: Bearer $JWT"
# → { "address": "abc123@example.com", "send_balance": 0 }
```

If this returns `401`, JWT is wrong / expired / mismatched with `BASE` — ask the user for a fresh one.

### 2. List the inbox

```bash
curl -s "$BASE/api/parsed_mails?limit=20&offset=0" \
  -H "Authorization: Bearer $JWT"
```

### 3. Get one mail

```bash
curl -s "$BASE/api/parsed_mail/<id>" -H "Authorization: Bearer $JWT"
```

### 4. Extract a verification code (poll)

```python
import re, time, requests

BASE, JWT = "<BASE>", "<JWT>"
H = {"Authorization": f"Bearer {JWT}"}

def wait_for_code(pattern=r"\b\d{4,8}\b", timeout=120, poll=3):
    deadline = time.time() + timeout
    seen = set()
    while time.time() < deadline:
        lst = requests.get(f"{BASE}/api/parsed_mails?limit=5&offset=0", headers=H).json()
        for m in lst.get("results", []):
            if m["id"] in seen: continue
            seen.add(m["id"])
            body = (m.get("subject") or "") + "\n" + (m.get("text") or "") + "\n" + (m.get("html") or "")
            hit = re.search(pattern, body)
            if hit:
                return hit.group(0)
        time.sleep(poll)
    raise TimeoutError("no matching mail within window")

print(wait_for_code())
```

## Fallback: local parse of raw source

If `/api/parsed_mails` / `/api/parsed_mail/:id` returns `404` (older deployment) or a parse error, fall back to `/api/mails` / `/api/mail/:id` (RFC822 `raw`) and parse locally. Mirror the frontend strategy in `frontend/src/utils/email-parser.js`: try **`mail-parser-wasm`** first, fall back to **`postal-mime`**.

```bash
npm i mail-parser-wasm postal-mime
```

```js
// parseRaw.mjs — drop-in parser matching frontend behavior
async function parseRaw(raw) {
    try {
        const { parse_message } = await import('mail-parser-wasm');
        const m = parse_message(raw);
        if (m?.subject && (m?.body_html || m?.text)) {
            return {
                sender: m.sender || '',
                subject: m.subject || '',
                text: m.text || '',
                html: m.body_html || '',
                attachments: (m.attachments || []).map(a => ({
                    filename: a.filename || a.content_id || '',
                    mimeType: a.content_type || '',
                    size: a.content?.length ?? 0,
                })),
            };
        }
    } catch { /* fall through */ }
    const PostalMime = (await import('postal-mime')).default;
    const p = await PostalMime.parse(raw);
    const sender = p.from?.name && p.from?.address
        ? `${p.from.name} <${p.from.address}>`
        : (p.from?.address || '');
    return {
        sender,
        subject: p.subject || '',
        text: p.text || '',
        html: p.html || '',
        attachments: (p.attachments || []).map(a => ({
            filename: a.filename || a.contentId || '',
            mimeType: a.mimeType || '',
            size: a.content?.length ?? 0,
        })),
    };
}

// usage
const row = await (await fetch(`${BASE}/api/mail/${id}`, {
    headers: { Authorization: `Bearer ${JWT}` },
})).json();
const parsed = await parseRaw(row.raw);
```

For attachment bytes, use `postal-mime` directly — `parsed.attachments[i].content` is a `Uint8Array`.

## Polling discipline

- Start at `poll=3s`, exponential backoff capped at 10s.
- Dedupe by mail `id`.
- Never poll faster than once per second.
- Respect `429` — sleep and retry.

## Common errors

- `401 InvalidAddressCredentialMsg` — JWT wrong/expired/sent via wrong header. Ask the user for a fresh JWT.
- `401 CustomAuthPasswordMsg` — site requires `x-custom-auth`; attach `SITE_PASSWORD`.
- `400 InvalidLimitMsg` / `InvalidOffsetMsg` — `limit` must be 1..100, `offset ≥ 0`.
- `404` on `/api/parsed_mail*` — deployment predates the parsed endpoints; use the fallback.
- `429` — rate limited; back off.
