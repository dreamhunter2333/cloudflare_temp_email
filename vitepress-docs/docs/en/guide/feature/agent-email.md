# AI Agent Mailbox Usage

For AI agents such as OpenClaw / Codex / Cursor: consume a temp mailbox directly using a user-supplied `Address JWT + API base URL` — list the inbox, fetch a single mail, extract verification codes / magic links.

## Prerequisites

The user must first open the frontend (e.g. `https://mail.example.com`) in a browser and **create or log into a mailbox address**. This step may require passing a Turnstile CAPTCHA that agents cannot complete automatically.

After creating or logging in, the **Address JWT** is displayed in the frontend UI and can be copied directly. The user provides the agent with:

1. **Address JWT** — copy from the frontend UI
2. **API base URL** — same origin as the frontend, e.g. `https://mail.example.com`
3. *(optional)* **Site password** — only if the deployment enabled `x-custom-auth`

## Why `parsed_mail` API

By design, `/api/mails` and `/api/mail/:id` return raw RFC822 (`raw` field), so the agent must ship a MIME parser to obtain `subject` / `text` / `html`.

To let agents consume the mailbox directly, the project adds **server-parsed** read-only endpoints that reuse the same `postal-mime` logic used by the frontend:

| Task                    | Method | Path                                 | Returns                                   |
| ----------------------- | ------ | ------------------------------------ | ----------------------------------------- |
| Address info            | GET    | `/api/settings`                      | `{ address, send_balance }`               |
| List parsed mails       | GET    | `/api/parsed_mails?limit=&offset=`   | `{ results: [parsedMail], count }`        |
| Get one parsed mail     | GET    | `/api/parsed_mail/:id`               | `parsedMail`                              |

`limit` is clamped to `1..100`, `offset` is 0-based.

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

**Attachment binary content is not included** in `parsed_*` responses — only metadata. If you need the bytes, fall back to `/api/mail/:id` and parse the raw source yourself.

## Required headers

- `Authorization: Bearer <JWT>` — required on every `/api/*` request
- `x-custom-auth: <SITE_PASSWORD>` — only when the site enables the private password
- `x-lang: en` or `zh` — optional, error-message language

::: warning Do not confuse Address JWT with User JWT
Address JWT goes in `Authorization: Bearer`, User JWT goes in `x-user-token`. Mixing them returns `401 InvalidAddressCredentialMsg`.
:::

## Examples

### 1. Smoke-test the JWT

```bash
curl -s "$BASE/api/settings" -H "Authorization: Bearer $JWT"
# → { "address": "abc123@example.com", "send_balance": 0 }
```

If this returns `401`, the JWT is wrong / expired / mismatched with `BASE` — ask the user for a fresh one.

### 2. List the inbox (parsed)

```bash
curl -s "$BASE/api/parsed_mails?limit=20&offset=0" \
  -H "Authorization: Bearer $JWT"
```

### 3. Extract a verification code (poll + regex)

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
            if m["id"] in seen:
                continue
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

If `/api/parsed_mails` / `/api/parsed_mail/:id` returns `404` (older deployment) or a parse error, fall back to `/api/mails` / `/api/mail/:id` (RFC822 `raw`) and **parse locally with the same strategy as the frontend**: `mail-parser-wasm` first, `postal-mime` as fallback (implementation reference: `frontend/src/utils/email-parser.js`).

```bash
npm i mail-parser-wasm postal-mime
```

```js
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

const row = await (await fetch(`${BASE}/api/mail/${id}`, {
    headers: { Authorization: `Bearer ${JWT}` },
})).json();
const parsed = await parseRaw(row.raw);
```

For attachment bytes, use `postal-mime` directly — `parsed.attachments[i].content` is a `Uint8Array`.

## Polling discipline

- Start at 3s, exponential backoff capped at 10s
- Dedupe by mail `id`
- Never poll faster than once per second
- Respect `429` — sleep and retry

## `cf-temp-mail-agent-mail` Skill

The repo ships an agent skill at `.claude/skills/cf-temp-mail-agent-mail/` that wraps the flow above. Works with Claude Code / Cursor / Codex / OpenClaw and other agents.

Pick any install method:

```bash
# Option 1: npx skills (recommended, auto-detects multiple agents)
npx skills add dreamhunter2333/cloudflare_temp_email --skill cf-temp-mail-agent-mail
# Add -g to install globally
npx skills add dreamhunter2333/cloudflare_temp_email --skill cf-temp-mail-agent-mail -g

# Option 2: npx degit to copy into your agent's skills folder
npx degit dreamhunter2333/cloudflare_temp_email/.claude/skills/cf-temp-mail-agent-mail <your-agent-skills-dir>/cf-temp-mail-agent-mail

# Option 3: clone and copy
git clone --depth 1 https://github.com/dreamhunter2333/cloudflare_temp_email.git /tmp/cf-temp-mail
cp -r /tmp/cf-temp-mail/.claude/skills/cf-temp-mail-agent-mail <your-agent-skills-dir>/
```

See [SKILL.md](https://github.com/dreamhunter2333/cloudflare_temp_email/blob/main/.claude/skills/cf-temp-mail-agent-mail/SKILL.md) for details.

## Common errors

- `401 InvalidAddressCredentialMsg` — JWT wrong / expired / sent via the wrong header. Ask the user for a fresh JWT.
- `401 CustomAuthPasswordMsg` — site requires `x-custom-auth`; attach `SITE_PASSWORD`.
- `400 InvalidLimitMsg` / `InvalidOffsetMsg` — `limit` must be 1..100, `offset ≥ 0`.
- `429` — rate limited; back off and retry.
