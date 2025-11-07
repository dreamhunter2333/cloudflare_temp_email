# Send Email API

## Send Email via HTTP API

This is a `python` example using the `requests` library to send emails.

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
    "http://localhost:8787/api/send_mail",
    json=send_body, headers={
        "Authorization": f"Bearer {your_JWT_password}",
        # "x-custom-auth": "<your_website_password>", # If custom password is enabled
        "Content-Type": "application/json"
    }
)

# Using body authentication
send_body = {
    "token": "<your_JWT_password>",
    "from_name": "Sender Name",
    "to_name": "Recipient Name",
    "to_mail": "Recipient Address",
    "subject": "Email Subject",
    "is_html": False,  # Set whether it's HTML based on content
    "content": "<Email content: html or text>",
}
res = requests.post(
    "http://localhost:8787/external/api/send_mail",
    json=send_body, headers={
        "Content-Type": "application/json"
    }
)
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
