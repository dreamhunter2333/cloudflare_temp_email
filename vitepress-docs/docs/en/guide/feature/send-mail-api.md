# Send Email API

## Send Email via HTTP API

There are two HTTP API endpoints for sending emails:

| Endpoint | Authentication | Use Case |
|----------|---------------|----------|
| `/api/send_mail` | `Authorization: Bearer <address_JWT>` header | Internal calls, requires cookie / header auth |
| `/external/api/send_mail` | `token` field in request body | External system integration, no header auth needed |

::: tip What is "Address JWT"?
The Address JWT is the `jwt` field returned when creating an email address via `/api/new_address` or `/admin/new_address`.
You can view it in the "Password" menu in the frontend UI. It is **NOT** the `JWT_SECRET` environment variable, nor the admin password.
:::

### Method 1: Header Authentication (`/api/send_mail`)

```python
send_body = {
    "from_name": "Sender Name",
    "to_name": "Recipient Name",
    "to_mail": "Recipient Address",
    "subject": "Email Subject",
    "is_html": False,  # Set whether it's HTML based on content
    "content": "<Email content: html or text>",
}

res = requests.post(
    "https://your_worker_domain/api/send_mail",
    json=send_body, headers={
        "Authorization": f"Bearer {address_JWT}",
        # "x-custom-auth": "<your_website_password>", # If private site password is enabled
        "Content-Type": "application/json"
    }
)
```

You can also use curl to debug a plain-text send:

```bash
curl -X POST "https://your_worker_domain/api/send_mail" \
  -H "Authorization: Bearer $ADDRESS_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "from_name": "My Temp Mail",
    "to_name": "Recipient",
    "to_mail": "friend@example.org",
    "subject": "Hello from Cloudflare Temp Email",
    "is_html": false,
    "content": "Hi! This is a test from my self-hosted temp mail."
  }'
```

### Method 2: Body Token Authentication (`/external/api/send_mail`)

Suitable for external system calls, place the Address JWT in the `token` field of the request body:

```python
send_body = {
    "token": "<address_JWT>",
    "from_name": "Sender Name",
    "to_name": "Recipient Name",
    "to_mail": "Recipient Address",
    "subject": "Email Subject",
    "is_html": False,  # Set whether it's HTML based on content
    "content": "<Email content: html or text>",
}
res = requests.post(
    "https://your_worker_domain/external/api/send_mail",
    json=send_body, headers={
        # "x-custom-auth": "<your_website_password>", # If private site password is enabled
        "Content-Type": "application/json"
    }
)
```

For server-to-server integrations, curl can put the Address JWT in the request body:

```bash
curl -X POST "https://your_worker_domain/external/api/send_mail" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "'"$ADDRESS_JWT"'",
    "from_name": "My Temp Mail",
    "to_mail": "friend@example.org",
    "subject": "HTML test",
    "is_html": true,
    "content": "<h1>Hi!</h1><p>This is <b>HTML</b>.</p>"
  }'
```

Check recent sendbox records:

```bash
curl "https://your_worker_domain/api/sendbox?limit=10&offset=0" \
  -H "Authorization: Bearer $ADDRESS_JWT"
```

## Send Email via SMTP

Please first refer to [Configure SMTP Proxy](/en/guide/feature/config-smtp-proxy.html).

This is a `python` example using the `smtplib` library to send emails.

`JWT Token Password`: This is the email login password, which can be viewed in the password menu in the UI interface.

```python
import smtplib

from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


with smtplib.SMTP('localhost', 8025) as smtp:
    smtp.login("jwt", "Enter your JWT token password here")
    message = MIMEMultipart()
    message['From'] = "Me <me@awsl.uk>"
    message['To'] = "Admin <admin@awsl.uk>"
    message['Subject'] = "Test Subject"
    message.attach(MIMEText("Test Content", 'html'))
    smtp.sendmail("me@awsl.uk", "admin@awsl.uk", message.as_string())
```
