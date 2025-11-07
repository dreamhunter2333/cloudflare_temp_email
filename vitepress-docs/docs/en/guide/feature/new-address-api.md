# Create New Email Address API

## Create Email Address via Admin API

This is a `python` example using the `requests` library to send emails.

```python
res = requests.post(
    # Replace xxxx.xxxx with your worker domain
    "https://xxxx.xxxx/admin/new_address",
    json={
        # Enable prefix (True/False)
        "enablePrefix": True,
        "name": "<email_name>",
        "domain": "<email_domain>",
    },
    headers={
        'x-admin-auth': "<your_website_admin_password>",
        "Content-Type": "application/json"
    }
)

# Returns {"jwt": "<Jwt>"}
print(res.json())
```

## Batch Create Random Username Email Addresses API Example

### Batch Create Email Addresses via Admin API

This is a `python` example using the `requests` library to send emails.

```python
import requests
import random
import string
from concurrent.futures import ThreadPoolExecutor, as_completed


def generate_random_name():
    # Generate 5 lowercase letters
    letters1 = ''.join(random.choices(string.ascii_lowercase, k=5))
    # Generate 1-3 digits
    numbers = ''.join(random.choices(string.digits, k=random.randint(1, 3)))
    # Generate 1-3 lowercase letters
    letters2 = ''.join(random.choices(string.ascii_lowercase, k=random.randint(1, 3)))
    # Combine into final name
    return letters1 + numbers + letters2


def fetch_email_data(name):
    try:
        res = requests.post(
            "https://<worker_domain>/admin/new_address",
            json={
                "enablePrefix": True,
                "name": name,
                "domain": "<email_domain>",
            },
            headers={
                'x-admin-auth': "<your_website_admin_password>",
                "Content-Type": "application/json"
            }
        )

        if res.status_code == 200:
            response_data = res.json()
            email = response_data.get("address", "no address")
            jwt = response_data.get("jwt", "no jwt")
            return f"{email}----{jwt}\n"
        else:
            print(f"Request failed, status code: {res.status_code}")
            return None
    except requests.RequestException as e:
        print(f"Request error: {e}")
        return None


def generate_and_save_emails(num_emails):
    with ThreadPoolExecutor(max_workers=30) as executor, open('email.txt', 'a') as file:
        futures = [executor.submit(fetch_email_data, generate_random_name()) for _ in range(num_emails)]

        for future in as_completed(futures):
            result = future.result()
            if result:
                file.write(result)


# Generate 10 emails and append to existing file
generate_and_save_emails(10)

```
