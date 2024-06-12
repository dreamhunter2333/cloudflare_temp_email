# 新建邮箱地址 API

## 通过 admin API 新建邮箱地址

这是一个 `python` 的例子，使用 `requests` 库发送邮件。

```python
res = requests.post(
    # 替换 xxxx.xxxx 为你的 worker 域名
    "https://xxxx.xxxx/admin/new_address",
    json={
        # 是否启用前缀 (True/False)
        "enablePrefix": True,
        "name": "<邮箱名称>",
        "domain": "<邮箱域名>",
    },
    headers={
        'x-admin-auth': "<你的网站admin密码>",
        "Content-Type": "application/json"
    }
)

# 返回值 {"jwt": "<Jwt>"}
print(res.json())
```
