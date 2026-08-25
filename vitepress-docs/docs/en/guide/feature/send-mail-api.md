# Send Email API

## Send Email via HTTP API

There are three HTTP API endpoints for sending emails:

| Endpoint | Authentication | Use Case |
|----------|---------------|----------|
| `/api/send_mail` | `Authorization: Bearer <address_JWT>` header | Internal calls, requires cookie / header auth |
| `/external/api/send_mail` | `token` field in request body | External system integration, no header auth needed |
| `/user_api/address/:address_id/send_mail` | `x-user-token: <user_JWT>` header | Signed-in users sending from one of their bound addresses |

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

### Method 3: User JWT (`/user_api/address/:address_id/send_mail`)

Obtain `address_id` from the paginated `GET /user_api/bind_address` response. The backend verifies that the address belongs to the current user; clients cannot choose an arbitrary sender address.

If the site grants unlimited sending to the current user's role through `NO_LIMIT_SEND_ROLE`, also send the `access_token` returned by `GET /user_api/settings`. The frontend handles this token automatically.

```python
send_body = {
    "from_name": "Sender Name",
    "to_name": "Recipient Name",
    "to_mail": "Recipient Address",
    "subject": "Email Subject",
    "is_html": False,
    "content": "Email content",
}

res = requests.post(
    "https://your_worker_domain/user_api/address/123/send_mail",
    json=send_body,
    headers={
        "x-user-token": "<user_JWT>",
        # "x-user-access-token": "<user_access_token>",  # Required for role permissions
        "Content-Type": "application/json",
    },
)
```

The same user-address API group also provides:

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/user_api/address/:address_id/settings` | Get the address and remaining send balance |
| `POST` | `/user_api/address/:address_id/request_send_mail_access` | Request send access for the address |
| `GET` | `/user_api/sendbox?limit=20&offset=0&address=optional-address` | List the current user's sent items, optionally filtered by a bound address |
| `DELETE` | `/user_api/sendbox/:mail_id` | Delete one sent item owned by the current user |

All endpoints require a User JWT. Address-scoped endpoints verify that `address_id` is bound to the current user, while user-level sent-item endpoints only return or delete records for the user's bound addresses. The user access token is only used to apply optional role permissions.

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
