# SMTP Sending Tutorial — Step-by-Step Guide

> Beginner-friendly walkthrough for configuring outbound email / SMTP on
> Cloudflare Temp Email. Companion to the existing
> [`Configure Email Sending`](../vitepress-docs/docs/en/guide/config-send-mail.md)
> guide, which focuses on the full reference; **this page focuses on the
> "where do I click and what do I paste"** questions raised in
> [#609](https://github.com/dreamhunter2333/cloudflare_temp_email/issues/609).

> **TL;DR.** Cloudflare Workers cannot send mail on their own. You must wire
> the Worker to a real outbound channel — either the Cloudflare `send_email`
> binding (paid plan), **Resend**, or **SMTP**. This tutorial covers SMTP.

---

## 1. Why does sending fail out of the box?

Cloudflare does not provide a free SMTP relay. Your Worker has the outbound
connection *engine* (`worker-mailer`) built in, but it needs credentials for
a real mail server. Until you supply one, every send attempt returns:

```
Please enable resend or smtp for this domain (your-domain.com)
```

The fix is to set one of two secrets on the Worker:

| Secret          | When to use                                                  |
| --------------- | ------------------------------------------------------------ |
| `RESEND_TOKEN`  | Easiest — sign up at resend.com and paste an API key         |
| `SMTP_CONFIG`   | Any SMTP relay you control (Gmail, Outlook, Mailgun, custom) |

If you only need SMTP and want to keep your existing mailbox provider,
read on.

---

## 2. Where in the Cloudflare dashboard do I add the secret?

Both CLI and UI deployments use the same destination:

```
Workers & Pages → <your-worker> → Settings → Variables and Secrets
```

### 2.1 UI deployment

1. Open <https://dash.cloudflare.com/> and pick **Workers & Pages**.
2. Click your Worker (the one running `worker.js`).
3. Go to **Settings → Variables and Secrets**.
4. Click **Add** and create a variable named `SMTP_CONFIG`.
5. The dialog will ask **Type** — pick **Secret** (encrypted), then paste
   your JSON (see §3) into the **Value** field. Click **Deploy**.

> [!IMPORTANT]
> The variable name must be `SMTP_CONFIG` exactly. Wrong name → the Worker
> silently falls back to the next channel and you get the
> "Please enable resend or smtp" error.

### 2.2 CLI deployment

```bash
cd worker
wrangler secret put SMTP_CONFIG
# paste the JSON, then press Ctrl-D
```

---

## 3. The `SMTP_CONFIG` JSON

The key in the JSON **must be your own sending domain** (one of the domains
you put in `DOMAINS`). The value is the SMTP server config consumed by
[`zou-yu/worker-mailer`](https://github.com/zou-yu/worker-mailer):

```json
{
  "your-domain.com": {
    "host": "smtp.example.com",
    "port": 465,
    "secure": true,
    "authType": ["plain", "login"],
    "credentials": {
      "username": "your-smtp-username",
      "password": "your-smtp-password"
    }
  }
}
```

| Field                | Notes                                                          |
| -------------------- | -------------------------------------------------------------- |
| top-level key        | Must equal one of your `DOMAINS` (e.g. `awsl.uk`)              |
| `host`               | SMTP server hostname                                           |
| `port`               | `465` (implicit SSL) or `587` (STARTTLS)                       |
| `secure`             | `true` for 465, `false` for 587                                |
| `authType`           | `["plain", "login"]` works for Gmail/Outlook/Mailgun           |
| `credentials.*`      | Usually the full email address as username                     |

> [!WARNING]
> Most common mistake: leaving the example key `your-domain.com` (or
> `awsl.uk`) in the JSON instead of replacing it with **your** domain. The
> Worker matches the JSON key against the sender's domain, so a wrong key
> silently disables SMTP and falls through to the next channel.

---

## 4. Provider recipes

### 4.1 Gmail

Gmail blocks plain password logins for most accounts. You **must** create an
[App Password](https://myaccount.google.com/apppasswords):

1. Enable 2-Step Verification on the Google account.
2. Visit <https://myaccount.google.com/apppasswords>, pick **App = Mail** and
   **Device = Other (Custom name)**, click **Generate**.
3. Copy the 16-character password (ignore the spaces).

```json
{
  "your-domain.com": {
    "host": "smtp.gmail.com",
    "port": 465,
    "secure": true,
    "authType": ["plain", "login"],
    "credentials": {
      "username": "you@gmail.com",
      "password": "abcd efgh ijkl mnop"
    }
  }
}
```

> [!WARNING]
> Google Workspace admins can disable App Passwords org-wide. If
> `530-5.5.1 Authentication required` keeps appearing, ask your admin to
> allow less-secure-app access or switch to Resend.

### 4.2 Outlook / Microsoft 365

If your tenant allows basic auth SMTP:

```json
{
  "your-domain.com": {
    "host": "smtp.office365.com",
    "port": 587,
    "secure": false,
    "authType": ["plain", "login"],
    "credentials": {
      "username": "you@outlook.com",
      "password": "your-app-password-or-mfa-passcode"
    }
  }
}
```

Modern Microsoft 365 tenants require OAuth2 and will reject basic auth with
`535 5.7.3 Authentication unsuccessful`. In that case use **Resend** instead
— it is the supported path for headless Workers.

### 4.3 Custom / self-hosted SMTP

```json
{
  "your-domain.com": {
    "host": "mail.your-isp.example",
    "port": 465,
    "secure": true,
    "authType": ["plain"],
    "credentials": {
      "username": "noreply@your-domain.com",
      "password": "choose-a-strong-one"
    }
  }
}
```

Make sure port `465` (or `587`) is reachable from Cloudflare's IP ranges —
most ISPs block outbound 25/465 entirely, in which case Resend or Mailgun
is the only practical option.

---

## 5. Sending balance

SMTP/Resend/binding sends deduct from the per-address **send balance**.
Configure defaults on the Worker:

| Variable                | Default | Effect                                                  |
| ----------------------- | ------- | ------------------------------------------------------- |
| `DEFAULT_SEND_BALANCE`  | `0`     | Auto-initialized when a user first opens the send page  |
| `NO_LIMIT_SEND_ROLE`    | unset   | Roles listed bypass the balance check (e.g. `"vip"`)    |

If users see `Failed to send verify code: No balance`, raise
`DEFAULT_SEND_BALANCE`, or add the address to the admin "No Limit Send
Address List".

---

## 6. Common errors and fixes

| Error                                                                                          | Cause                                                                                | Fix                                                                                                                |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `Please enable resend or smtp for this domain (xxx)`                                          | `SMTP_CONFIG` / `RESEND_TOKEN` not set, or the JSON key doesn't match `DOMAINS`     | Double-check the JSON key matches one of your `DOMAINS` and the variable name is exactly `SMTP_CONFIG`             |
| `Failed to send verify code: No balance`                                                       | `DEFAULT_SEND_BALANCE = 0` and the address has no admin-set quota                   | Raise `DEFAULT_SEND_BALANCE`, or set quota in the admin "Address Sender" page, or add address to no-limit list     |
| `Error: Invalid login: 535-5.7.8 Username and Password not accepted`                           | Gmail/Outlook blocking basic auth                                                   | Generate an App Password (Gmail) or enable SMTP AUTH in Microsoft 365, or switch to Resend                         |
| `Error: connect ECONNREFUSED / ETIMEDOUT`                                                     | Cloudflare IPs blocked by the relay, or wrong port/secure flag                       | Use port 465 with `secure: true`; if your ISP relays do not allow Cloudflare, switch to Resend/Mailgun             |
| `Error: self signed certificate`                                                               | `secure: true` against a server whose TLS cert isn't trusted                        | Fix the cert, or set `secure: false` with port 587 + STARTTLS                                                     |
| `Error: getaddrinfo ENOTFOUND smtp.example.com`                                                | Typo in `host`                                                                       | Re-check the provider's SMTP hostname                                                                              |
| Mail is sent but recipient's inbox filters it as spam                                          | Missing SPF / DKIM / DMARC on your sending domain                                    | Configure Resend (or your SMTP provider) to publish DKIM; align `From` domain with a verified domain               |

---

## 7. curl examples

After deploying the Worker and setting `SMTP_CONFIG`, the address JWT is
visible in the frontend's "Password" menu for each mailbox.

### 7.1 Plain-text send via `/api/send_mail`

```bash
curl -X POST "https://your-worker.workers.dev/api/send_mail" \
  -H "Authorization: Bearer $ADDRESS_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "from_name": "My Temp Mail",
    "to_name":   "Recipient",
    "to_mail":   "friend@example.org",
    "subject":   "Hello from Cloudflare Temp Mail",
    "is_html":   false,
    "content":   "Hi! This is a test from my self-hosted temp mail."
  }'
```

### 7.2 HTML send via `/external/api/send_mail`

The `/external/api/...` variant puts the JWT in the body, so it is easier
to call from a server-to-server integration:

```bash
curl -X POST "https://your-worker.workers.dev/external/api/send_mail" \
  -H "Content-Type: application/json" \
  -d '{
    "token":     "'"$ADDRESS_JWT"'",
    "from_name": "My Temp Mail",
    "to_mail":   "friend@example.org",
    "subject":   "HTML test",
    "is_html":   true,
    "content":   "<h1>Hi!</h1><p>This is <b>HTML</b>.</p>"
  }'
```

### 7.3 Check what is left in the outbox

```bash
curl "https://your-worker.workers.dev/api/sendbox?limit=10&offset=0" \
  -H "Authorization: Bearer $ADDRE...
  -H "Authorization: Bearer $ADDRESS_JWT"
```

Successful responses return `{"status":"ok"}`. Errors come back as plain
text with HTTP `400` — copy the exact message into the
[FAQ](../vitepress-docs/docs/en/guide/common-issues.md#email-sending-related)
table above to identify the fix.

---

## 8. Reference

- Full variable reference:
  [`vitepress-docs/docs/en/guide/config-send-mail.md`](../vitepress-docs/docs/en/guide/config-send-mail.md)
- HTTP send API:
  [`vitepress-docs/docs/en/guide/feature/send-mail-api.md`](../vitepress-docs/docs/en/guide/feature/send-mail-api.md)
- Issue tracker: [#609](https://github.com/dreamhunter2333/cloudflare_temp_email/issues/609)
- Underlying library: [zou-yu/worker-mailer](https://github.com/zou-yu/worker-mailer)