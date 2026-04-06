
# Configure Email Sending

::: warning Note
All three methods can be configured simultaneously. When sending emails, it will prioritize using `resend`, if `resend` is not configured, it will use `smtp`.

If a Cloudflare authenticated forwarding email address is configured, CF's internal API will be prioritized for sending emails
:::

## Send Emails Using Resend

Register at `https://resend.com/domains` and add DNS records according to the instructions.

Create an `api key` on the `API KEYS` page.

Then execute the following command to add `RESEND_TOKEN` to secrets:

> [!NOTE]
> If you find this troublesome, you can also put it directly in plain text under `[vars]` in `wrangler.toml`, but this is not recommended

If you deployed through the UI, you can add it under `Variables and Secrets` in the Cloudflare UI interface.

```bash
# Switch to worker directory
cd worker
wrangler secret put RESEND_TOKEN
```

If you have multiple domains with different `api keys`, you can add multiple secrets in `wrangler.toml`, named `RESEND_TOKEN_` + `<UPPERCASE DOMAIN WITH . REPLACED BY _>`, for example:

```bash
wrangler secret put RESEND_TOKEN_XXX_COM
wrangler secret put RESEND_TOKEN_DREAMHUNTER2333_XYZ
```

## Send Emails Using SMTP

The format of `SMTP_CONFIG` is as follows. **The key must be your own sending domain**, and the value is the SMTP configuration.

For SMTP configuration format details, refer to [zou-yu/worker-mailer](https://github.com/zou-yu/worker-mailer/blob/main/README_zh-CN.md)

> [!warning] Important
> The JSON key (e.g. `your-domain.com` in the example below) must be replaced with **your own domain** — the domain configured in your `DOMAINS` variable.
> This is one of the most common configuration mistakes. Do not copy the example domain directly.

```json
{
    "your-domain.com": {
        "host": "smtp.example.com",
        "port": 465,
        "secure": true,
        "authType": [
            "plain",
            "login"
        ],
        "credentials": {
            "username": "your-smtp-username",
            "password": "your-smtp-password"
        }
    }
}
```

**Field Reference:**

| Field | Description |
|-------|-------------|
| key (e.g. `your-domain.com`) | Your sending domain, must match a domain configured in `DOMAINS` |
| `host` | SMTP server address, e.g. `smtp.mailgun.org`, `smtp.gmail.com`, or your self-hosted SMTP server |
| `port` | SMTP port, typically `465` (SSL) or `587` (STARTTLS) |
| `secure` | Whether to use SSL/TLS. Set to `true` for port 465, `false` for port 587 |
| `authType` | Authentication method, typically `["plain", "login"]` |
| `credentials.username` | SMTP server login username |
| `credentials.password` | SMTP server login password |

If you have **multiple domains** using different SMTP services, add multiple keys in the same JSON:

```json
{
    "domain-a.com": {
        "host": "smtp.mailgun.org",
        "port": 465,
        "secure": true,
        "authType": ["plain", "login"],
        "credentials": { "username": "user@domain-a.com", "password": "xxx" }
    },
    "domain-b.com": {
        "host": "smtp.gmail.com",
        "port": 465,
        "secure": true,
        "authType": ["plain", "login"],
        "credentials": { "username": "user@gmail.com", "password": "app-password" }
    }
}
```

Then execute the following command to add `SMTP_CONFIG` to secrets:

> [!NOTE]
> If you find this troublesome, you can also put it directly in plain text under `[vars]` in `wrangler.toml`, but this is not recommended

If you deployed through the UI, you can add it under `Variables and Secrets` in the Cloudflare UI interface.

```bash
# Switch to worker directory
cd worker
wrangler secret put SMTP_CONFIG
```

## Send Balance Mechanism

Users need a send balance to send emails. The balance mechanism works as follows:

1. **Request Send Permission**: Users must first click the "Request Send Permission" button in the frontend
2. **Default Quota**: Upon requesting, users receive the default quota set by the `DEFAULT_SEND_BALANCE` environment variable (defaults to 0 if not set)
3. **Unlimited Sending**: The following methods can bypass balance checks:
   - Add the address to the "No Limit Send Address List" in the admin console
   - Configure the `NO_LIMIT_SEND_ROLE` environment variable to specify roles that can send without limits

> [!NOTE]
> `DEFAULT_SEND_BALANCE` does **NOT** automatically grant balance to all addresses. Users must actively request send permission first for the quota to take effect.

## Send Emails to Authenticated Forwarding Addresses on Cloudflare

Only supported for CLI deployment, add `send_email` configuration in `wrangler.toml`.

The destination email address must be an authenticated email address on Cloudflare, which has significant limitations. If you need to send emails to other addresses, you can use `resend` or `smtp` to send emails.

```toml
# Send emails through Cloudflare
send_email = [
   { name = "SEND_MAIL" },
]
```

Admin console account configuration `Verified address list (can send emails through CF internal API)`
