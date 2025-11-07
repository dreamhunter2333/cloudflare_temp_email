
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

The format of `SMTP_CONFIG` is as follows, where key is the domain name and value is the SMTP configuration. For SMTP configuration format details, refer to [zou-yu/worker-mailer](https://github.com/zou-yu/worker-mailer/blob/main/README_zh-CN.md)

```json
{
    "awsl.uk": {
        "host": "smtp.xxx.com",
        "port": 465,
        "secure": true,
        "authType": [
            "plain",
            "login"
        ],
        "credentials": {
            "username": "username",
            "password": "password"
        }
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
