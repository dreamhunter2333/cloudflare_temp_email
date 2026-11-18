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
        # 可选：ISO 8601 时间字符串或毫秒时间戳；不传或传 null 表示永不过期
        # "expiresAt": "2026-12-31T23:59:59Z",
    },
    headers={
        'x-admin-auth': "<你的网站admin密码>",
        # "x-custom-auth": "<你的网站密码>", # 如果启用了私有站点密码
        "Content-Type": "application/json"
    }
)

# 返回值 {"jwt": "<Jwt>", "address": "<邮箱地址>", "address_id": 123, "expires_at": null}
print(res.json())
```

### 可选过期时间（`expiresAt` / `expiresIn`）

该功能受环境变量 `ENABLE_ADDRESS_EXPIRY` 控制（默认 `false` 关闭）：
- **先迁移再开启**：现有部署必须先完成 `v0.0.11` 数据库迁移（`Admin -> 快速设置 -> 数据库 -> 升级数据库 Schema`、`POST /admin/db_migration` 或执行 `db/2026-11-18-address-expires-at.sql`），再将 `ENABLE_ADDRESS_EXPIRY` 设为 `true`。
- **关闭状态语义**：关闭时隐藏过期时间相关界面控件，暂停过期校验与过期清理（不会抹掉数据库中已保存的 `expires_at`），且 API 显式传入 `expiresAt`/`expiresIn` 时会明确返回错误（`403`），避免悄悄创建永久邮箱。

开启 `ENABLE_ADDRESS_EXPIRY = true` 后，`/api/new_address` 和 `/admin/new_address` 均支持可选参数 `expiresAt`（或 `expires_at`）或 `expiresIn`（或 `expires_in`），两者互斥：
- 不传或传 `null`（默认）表示该邮箱永不过期。
- `expiresAt`：传入将来的 ISO 8601 时间字符串（例如 `"2026-12-31T23:59:59Z"`）或毫秒时间戳，按指定日期时间过期。
- `expiresIn`：传入正数秒数（例如 `86400` 表示 24 小时，`604800` 表示 1 周），按相对时长过期。
- 到期后，共享邮箱鉴权/登录及单地址用户操作将立即拒绝访问；在清理删除该地址前，收件流程仍沿用 `blockReceiveUnknowAddressEmail` 策略，清理之后再按原有未知地址规则处理。
- 过期邮箱及关联数据的实际删除在 `wrangler.toml` 启用 `[triggers]` `crons`（`wrangler.toml.template` 默认注释了该项）后由 `expiredAddress` 定时分批执行，因此实际删除时间取决于 cron 周期与批处理清理进度。

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
- 管理后台可以把该能力设置为“跟随环境变量 / 强制开启 / 强制关闭”；其中“跟随环境变量”会清空后台覆盖，恢复到未设置后按 env 回退

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
