---
name: cf-temp-mail-usage
description: Read mails from a cloudflare_temp_email mailbox using a user-supplied Address JWT and API base URL. Use when the user (or an agent such as OpenClaw / Codex / Cursor) needs to list the inbox, fetch a specific message, or extract a verification code / magic link. Prefers the server-parsed endpoints so the agent gets subject/text/html/attachments directly. Does NOT handle mailbox creation — the user provides the JWT themselves.
---

# Temp-Mail Read-Only Usage

Consume an existing mailbox. The user hands over the JWT (obtained in a browser after creating an address); the agent only reads mail.

## Inputs the user must provide

- `BASE` — API base URL, e.g. `https://mail.example.com` or the Worker's `*.workers.dev` host.
- `JWT` — Address JWT. In the frontend it is stored in `localStorage` under the key `jwt` (raw string, no JSON wrap).
- *(optional)* `SITE_PASSWORD` — only if the deployment enabled `x-custom-auth`.

If anything is missing, ask the user before making requests.

## Required headers

- `Authorization: Bearer <JWT>` — on every `/api/*` request.
- `x-custom-auth: <SITE_PASSWORD>` — only when the site requires it.
- `x-lang: en` or `zh` — optional, error-message language.

Do not send the Address JWT as `x-user-token` — that is a different JWT type and will yield `401 InvalidAddressCredentialMsg`.

## Endpoints (read-only)

| Task                        | Method | Path                               | Returns                                   |
| --------------------------- | ------ | ---------------------------------- | ----------------------------------------- |
| Address info                | GET    | `/api/settings`                    | `{ address, send_balance }`               |
| **List parsed mails**       | GET    | `/api/parsed_mails?limit=&offset=` | `{ results: [parsedMail], count }`        |
| **Get one parsed mail**     | GET    | `/api/parsed_mail/:id`             | `parsedMail`                              |
| List raw mails              | GET    | `/api/mails?limit=&offset=`        | `{ results: [{...,raw}], count }`         |
| Get one raw mail            | GET    | `/api/mail/:id`                    | `{ ..., raw }`                            |

`limit` 1–100, `offset` 0-based. On `429`, back off.

**Prefer the `parsed_*` endpoints.** They run the same `commonParseMail` (postal-mime) the frontend uses and return structured fields directly, so the agent does not need to ship a MIME parser.

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

Attachment **binary content is not included** in `parsed_*` responses — only metadata. If you need the bytes, fetch the raw mail via `/api/mail/:id` and parse it client-side (see below).

## Recipes

### 1. Smoke-test the JWT

```bash
curl -s "$BASE/api/settings" -H "Authorization: Bearer $JWT"
# → { "address": "abc123@example.com", "send_balance": 0 }
```

If this returns `401`, JWT is wrong / expired / mismatched with `BASE` — ask the user for a fresh one.

### 2. List the inbox (parsed)

```bash
curl -s "$BASE/api/parsed_mails?limit=20&offset=0" \
  -H "Authorization: Bearer $JWT"
```

### 3. Get one mail (parsed)

```bash
curl -s "$BASE/api/parsed_mail/<id>" -H "Authorization: Bearer $JWT"
```

### 4. Extract a verification code (end-to-end, parsed API)

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

## Raw endpoints (fallback — only if you need attachment bytes or the original MIME)

`/api/mails` and `/api/mail/:id` return the gzip-resolved RFC822 source in `raw`. Parse it client-side.

### Node.js (postal-mime, pure JS)

```bash
npm i postal-mime
```

```js
import PostalMime from 'postal-mime';

const mail = await (await fetch(`${BASE}/api/mail/${id}`, {
  headers: { Authorization: `Bearer ${JWT}` },
})).json();
const parsed = await PostalMime.parse(mail.raw);
// parsed.subject / parsed.from / parsed.text / parsed.html
// parsed.attachments[i].content is a Uint8Array
```

### Python (stdlib, no deps)

```python
import email, requests
from email import policy

r = requests.get(f"{BASE}/api/mail/{mid}", headers={"Authorization": f"Bearer {JWT}"}).json()
msg = email.message_from_string(r["raw"], policy=policy.default)
subject = msg["subject"]
text    = (msg.get_body(preferencelist=("plain",)) or None) and msg.get_body(preferencelist=("plain",)).get_content()
html    = (msg.get_body(preferencelist=("html",))  or None) and msg.get_body(preferencelist=("html",)).get_content()
for part in msg.iter_attachments():
    name, mime, data = part.get_filename(), part.get_content_type(), part.get_content()
```

The frontend's reference implementation is `frontend/src/utils/email-parser.js` — tries `mail-parser-wasm` first, falls back to `postal-mime`. The server uses `postal-mime` only.

## Polling discipline

- Start at `poll=3s`, exponential backoff capped at 10s.
- Dedupe by mail `id`.
- Never poll faster than once per second.
- Respect `429` — sleep and retry.

## Common errors

- `401 InvalidAddressCredentialMsg` — JWT wrong/expired/sent via wrong header. Ask the user for a fresh JWT.
- `401 CustomAuthPasswordMsg` — site requires `x-custom-auth`; attach `SITE_PASSWORD`.
- `400 InvalidLimitMsg` / `InvalidOffsetMsg` — `limit` must be 1..100, `offset ≥ 0`.
- `429` — rate limited; back off.
