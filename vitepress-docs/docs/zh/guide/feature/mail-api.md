# 查看邮件 API

## 通过 邮件 API 查看邮件

这是一个 `python` 的例子，使用 `requests` 库查看邮件。

```python
limit = 10
offset = 0
res = requests.get(
    f"https://<你的worker地址>/api/mails?limit={limit}&offset={offset}",
    headers={
        "Authorization": f"Bearer {你的JWT密码}",
        # "x-custom-auth": "<你的网站密码>", # 如果启用了自定义密码
        "Content-Type": "application/json"
    }
)
```

## admin 邮件 API

支持 `address` 过滤

```python
import requests

url = "https://<你的worker地址>/admin/mails"

querystring = {
    "limit":"20",
    "offset":"0",
    # address 为可选参数
    "address":"xxxx@awsl.uk"
}

headers = {"x-admin-auth": "<你的Admin密码>"}

response = requests.get(url, headers=headers, params=querystring)

print(response.json())
```

**注意**：后端 API 已移除关键词过滤功能。如需按内容过滤邮件，请使用前端界面的过滤输入框，该功能可过滤当前显示的页面。

## admin 删除邮件 API

通过邮件 ID 删除单封邮件。

```python
import requests

mail_id = 1
url = f"https://<你的worker地址>/admin/mails/{mail_id}"

headers = {"x-admin-auth": "<你的Admin密码>"}

response = requests.delete(url, headers=headers)

print(response.json())
```

## admin 删除邮箱地址 API

通过邮箱地址 ID 删除邮箱地址（同时删除该地址关联的邮件、发件权限和用户绑定）。

```python
import requests

address_id = 1
url = f"https://<你的worker地址>/admin/delete_address/{address_id}"

headers = {"x-admin-auth": "<你的Admin密码>"}

response = requests.delete(url, headers=headers)

print(response.json())
```

## admin 清空收件箱 API

通过邮箱地址 ID 清空该地址的所有收件。

```python
import requests

address_id = 1
url = f"https://<你的worker地址>/admin/clear_inbox/{address_id}"

headers = {"x-admin-auth": "<你的Admin密码>"}

response = requests.delete(url, headers=headers)

print(response.json())
```

## admin 清空发件箱 API

通过邮箱地址 ID 清空该地址的所有发件。

```python
import requests

address_id = 1
url = f"https://<你的worker地址>/admin/clear_sent_items/{address_id}"

headers = {"x-admin-auth": "<你的Admin密码>"}

response = requests.delete(url, headers=headers)

print(response.json())
```

## user 邮件 API

支持 `address` 过滤

```python
import requests

url = "https://<你的worker地址>/user_api/mails"

querystring = {
    "limit":"20",
    "offset":"0",
    # address 为可选参数
    "address":"xxxx@awsl.uk"
}

headers = {"x-user-token": "<你的用户JWT Token>"}

response = requests.get(url, headers=headers, params=querystring)

print(response.json())
```

**注意**：后端 API 已移除关键词过滤功能。如需按内容过滤邮件，请使用前端界面的过滤输入框，该功能可过滤当前显示的页面。
