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

支持 `address` filter 和 `keyword` filter

```python
import requests

url = "https://<你的worker地址>/admin/mails"

querystring = {
    "limit":"20",
    "offset":"0",
    # adress 和 keyword 为可选参数
    "address":"xxxx@awsl.uk",
    "keyword":"xxxx"
}

headers = {"x-admin-auth": "<你的Admin密码>"}

response = requests.get(url, headers=headers, params=querystring)

print(response.json())
```

## user 邮件 API

支持 `address` filter 和 `keyword` filter

```python
import requests

url = "https://<你的worker地址>/user_api/mails"

querystring = {
    "limit":"20",
    "offset":"0",
    # adress 和 keyword 为可选参数
    "address":"xxxx@awsl.uk",
    "keyword":"xxxx"
}

headers = {"x-admin-auth": "<你的Admin密码>"}

response = requests.get(url, headers=headers, params=querystring)

print(response.json())
```
