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
