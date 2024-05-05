# 发送邮件 API

## 通过 HTTP API 发送邮件

这是一个 `python` 的例子，使用 `requests` 库发送邮件。

```python
send_body = {
    "from_name": "发件人名字",
    "to_name": "收件人名字",
    "to_mail": "收件人地址",
    "subject": "邮件主题",
    "is_html": False,  # 根据内容设置是否为 HTML
    "content": "<邮件内容：html 或者 文本>",
}

res = requests.post(
    "http://localhost:8787/api/send_mail",
    json=send_body, headers={
        "Authorization": f"Bearer {你的JWT密码}",
        # "x-custom-auth": "<你的网站密码>", # 如果启用了自定义密码
        "Content-Type": "application/json"
    }
)

# 使用 body 验证
send_body = {
    "token": "<你的JWT密码>",
    "from_name": "发件人名字",
    "to_name": "收件人名字",
    "to_mail": "收件人地址",
    "subject": "邮件主题",
    "is_html": False,  # 根据内容设置是否为 HTML
    "content": "<邮件内容：html 或者 文本>",
}
res = requests.post(
    "http://localhost:8787/external/api/send_mail",
    json=send_body, headers={
        "Content-Type": "application/json"
    }
)
```

## 通过 SMTP 发送邮件

请先参考 [配置 SMTP 代理](/zh/guide/feature/config-smtp-proxy.html)。

这是一个 `python` 的例子，使用 `smtplib` 库发送邮件。

`JWT令牌密码`: 即为邮箱登录密码，可以在 UI 界面中查看密码菜单中查看。

```python
import smtplib

from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


with smtplib.SMTP('localhost', 8025) as smtp:
    smtp.login("jwt", "此处填写你的JWT令牌密码")
    message = MIMEMultipart()
    message['From'] = "Me <me@awsl.uk>"
    message['To'] = "Admin <admin@awsl.uk>"
    message['Subject'] = "测试主题"
    message.attach(MIMEText("测试内容", 'html'))
    smtp.sendmail("me@awsl.uk", "admin@awsl.uk", message.as_string())
```
