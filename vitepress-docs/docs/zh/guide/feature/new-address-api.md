# 新建邮箱地址 API

::: warning 注意：地址 JWT vs 用户 JWT
本页面介绍的是**地址 JWT**，与**用户 JWT** 是两种不同的认证方式：

- **地址 JWT**：通过 `/api/new_address` 或 `/admin/new_address` 创建邮箱时返回
  - 使用 `Authorization: Bearer <jwt>` header
  - 用于访问 `/api/*` 接口（查看邮件、删除邮件等）

- **用户 JWT**：通过 `/user_api/login` 或 `/user_api/register` 获得
  - 使用 `x-user-token: <jwt>` header
  - 用于访问 `/user_api/*` 接口（用户账户管理）

**请勿混淆两种 JWT 的使用方式！**
:::

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
        # "x-custom-auth": "<你的网站密码>", # 如果启用了私有站点密码
        "Content-Type": "application/json"
    }
)

# 返回值 {"jwt": "<Jwt>"}
print(res.json())
```

### 创建子域名邮箱地址

如果你已经把基础域名配置进 `DOMAINS` / `DEFAULT_DOMAINS` / `USER_ROLES`，并且开启了
`ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH`（管理后台也可单独开关），那么创建地址 API 可以直接接收子域名：

```python
res = requests.post(
    "https://xxxx.xxxx/admin/new_address",
    json={
        "enablePrefix": True,
        "name": "project001",
        "domain": "team.example.com",
    },
    headers={
        'x-admin-auth': "<你的网站admin密码>",
        "Content-Type": "application/json"
    }
)
```

- 如果允许域名里有 `example.com`，则 `team.example.com`、`dev.team.example.com` 都可以匹配成功
- `badexample.com` 这种**不是点分后缀**的域名不会被误判为 `example.com`
- 这与 `RANDOM_SUBDOMAIN_DOMAINS` 不同：这里是**由调用方显式指定子域名**，不是系统自动生成随机子域名

## 批量创建随机用户名邮箱地址 API 示例

### 通过 admin API 批量新建邮箱地址

这是一个 `python` 的例子，使用 `requests` 库发送邮件。

```python
import requests
import random
import string
from concurrent.futures import ThreadPoolExecutor, as_completed


def generate_random_name():
    # 生成5位英文字符
    letters1 = ''.join(random.choices(string.ascii_lowercase, k=5))
    # 生成1-3个数字
    numbers = ''.join(random.choices(string.digits, k=random.randint(1, 3)))
    # 生成1-3个英文字符
    letters2 = ''.join(random.choices(string.ascii_lowercase, k=random.randint(1, 3)))
    # 组合成最终名称
    return letters1 + numbers + letters2


def fetch_email_data(name):
    try:
        res = requests.post(
            "https://<worker 域名>/admin/new_address",
            json={
                "enablePrefix": True,
                "name": name,
                "domain": "<邮箱域名>",
            },
            headers={
                'x-admin-auth': "<你的网站admin密码>",
                # "x-custom-auth": "<你的网站密码>", # 如果启用了私有站点密码
                "Content-Type": "application/json"
            }
        )

        if res.status_code == 200:
            response_data = res.json()
            email = response_data.get("address", "无地址")
            jwt = response_data.get("jwt", "无jwt")
            return f"{email}----{jwt}\n"
        else:
            print(f"请求失败，状态码: {res.status_code}")
            return None
    except requests.RequestException as e:
        print(f"请求出现错误: {e}")
        return None


def generate_and_save_emails(num_emails):
    with ThreadPoolExecutor(max_workers=30) as executor, open('email.txt', 'a') as file:
        futures = [executor.submit(fetch_email_data, generate_random_name()) for _ in range(num_emails)]

        for future in as_completed(futures):
            result = future.result()
            if result:
                file.write(result)


# 生成10个邮箱并追加到现有文件
generate_and_save_emails(10)

```
