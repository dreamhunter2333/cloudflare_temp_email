
# Configure Email Sending

::: tip Recommended
Use Cloudflare `send_email` binding as the default send channel. Bind `SEND_MAIL` and finish Email Routing onboarding, then the Worker can send to any external address directly.

Workers Paid includes 3,000 messages/month, then $0.35 per 1,000 messages.
:::

## Send Channel Priority

Each `/api/send_mail` request matches channels in order; **the first hit sends**:

| Order | Condition | Channel | Deducts balance |
|-------|-----------|---------|----------------|
| 1 | `SEND_MAIL` bound **AND** recipient in `verifiedAddressList` | Cloudflare binding (compat mode) | No |
| 2 | `RESEND_TOKEN` or `RESEND_TOKEN_<DOMAIN>` set | Resend API | Yes |
| 3 | `SMTP_CONFIG` has entry for current domain | worker-mailer SMTP | Yes |
| 4 | `SEND_MAIL` bound (none of the above) | **Cloudflare binding (recommended primary)** | Yes |
| — | None of the above | Throws | — |

> [!NOTE]
> Binding send failures return an error directly.

## Using the Cloudflare `send_email` Binding (Recommended)

Only available when deploying via CLI. Add to `wrangler.toml`:

```toml
# Send emails via the Cloudflare send_email binding
send_email = [
   { name = "SEND_MAIL" },
]
```

> [!warning] Important
> The binding name must be `SEND_MAIL` — different from Cloudflare's official `SEND_EMAIL` example.

After the following steps, you can send to any external address directly:

1. Enable Email Routing on the domain in the Cloudflare Dashboard and complete onboarding
2. Add the `send_email` binding shown above to `wrangler.toml`
3. Deploy the Worker

No additional env var is required.

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

1. **Auto-initialize Default Quota**: When `DEFAULT_SEND_BALANCE > 0`, the system automatically initializes the default quota when the user opens the send page or calls the send-mail API for the first time
2. **Manual Request**: If `DEFAULT_SEND_BALANCE = 0`, users can still click "Request Send Permission" in the frontend to create a pending send-access record for admins to review
3. **Unlimited Sending**: The following methods can bypass balance checks:
   - Add the address to the "No Limit Send Address List" in the admin console
   - Configure the `NO_LIMIT_SEND_ROLE` environment variable to specify roles that can send without limits

> [!NOTE]
> `DEFAULT_SEND_BALANCE` only inserts an initial quota for addresses that do not yet have an `address_sender` row (`ON CONFLICT DO NOTHING`); existing rows — including admin-disabled or admin-edited ones — are never modified by the runtime path. Restoring a previously disabled or pre-existing address must go through the admin console (enable + set balance).
>
> Layer 1 (`verifiedAddressList` hit) does not deduct balance, but it still counts toward send limits; layers 2/3/4 all deduct balance.
>
> Send limits apply to **all** send channels, including admin send endpoints.
>
> Daily and monthly windows are calculated in **UTC**.
>
> The current limit implementation is a **soft guard**. It is suitable for routine quota control, but it should not be treated as a strict hard-stop cost gate under database errors or high concurrency.

## Send Emails to Authenticated Forwarding Addresses on Cloudflare

Typical use case: non-onboarded domains or Workers free-tier users.

In this compatibility mode, mail is sent via `SEND_MAIL` binding only when the recipient is in the admin `Verified Address List`.
