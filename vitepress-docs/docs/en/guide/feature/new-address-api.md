# Create New Email Address API

::: warning Note: Address JWT vs User JWT
This page describes **Address JWT**, which is different from **User JWT**:

- **Address JWT**: Returned when creating a mailbox via `/api/new_address` or `/admin/new_address`
  - Use `Authorization: Bearer <jwt>` header
  - Access `/api/*` endpoints (view mails, delete mails, etc.)

- **User JWT**: Obtained via `/user_api/login` or `/user_api/register`
  - Use `x-user-token: <jwt>` header
  - Access `/user_api/*` endpoints (user account management)

**Do not confuse these two JWT types!**
:::

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
        # Optional: ISO 8601 string or epoch ms; omit or null for never expiring
        # "expiresAt": "2026-12-31T23:59:59Z",
    },
    headers={
        'x-admin-auth': "<your_website_admin_password>",
        # "x-custom-auth": "<your_website_password>", # If private site password is enabled
        "Content-Type": "application/json"
    }
)

# Returns {"jwt": "<Jwt>", "address": "<email_address>", "address_id": 123}
print(res.json())
```

### Optional Expiration Time (`expiresAt`)

This feature is controlled by `ENABLE_ADDRESS_EXPIRY` (default `false`):
- **Migrate Before Enabling**: Existing deployments must run the `v0.0.11` database migration (`Admin -> Quick Setup -> Database -> Migrate Database`, `POST /admin/db_migration`, or `db/2026-11-18-address-expires-at.sql`) **before** setting `ENABLE_ADDRESS_EXPIRY = true`. For an existing database without a version record, call the migration endpoint directly instead of initializing it again.
- **Disabled Behavior**: When `ENABLE_ADDRESS_EXPIRY` is `false` (default), expiry UI controls are hidden, expiry checks and cleanup are paused (without erasing any previously saved `expires_at` values), and explicitly passing `expiresAt` returns an error (`403`) rather than silently creating a permanent mailbox.

When `ENABLE_ADDRESS_EXPIRY = true`, both `/api/new_address` and `/admin/new_address` accept the optional `expiresAt` field:
- Omit or pass `null` (default) so the address never expires.
- `expiresAt`: Pass future Unix epoch milliseconds or an ISO 8601 timestamp with a time zone (e.g. `"2026-12-31T23:59:59Z"`). The database format `YYYY-MM-DD HH:mm:ss` is also accepted as UTC. The deadline must be before `2100-01-01T00:00:00Z`. The web UI converts duration presets to this field at submission.
- Once expired, shared mailbox authentication/login and single-address user actions reject access immediately. Inbound mail still follows `blockReceiveUnknowAddressEmail` until cleanup removes the address.
- Actual deletion of expired addresses and their mails happens in bounded batches during the scheduled cron (`expiredAddress`) when `[triggers]` `crons` is enabled in `wrangler.toml` (commented out by default in `wrangler.toml.template`), so exact removal timing depends on your cron schedule and backlog progress.

### Create a Subdomain Mailbox Address

If your base domain is already configured in `DOMAINS` / `DEFAULT_DOMAINS` / `USER_ROLES`, and
`ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH` is enabled (it can also be toggled in the admin panel),
the create-address APIs can accept subdomains directly:

```python
res = requests.post(
    "https://xxxx.xxxx/admin/new_address",
    json={
        "enablePrefix": True,
        "name": "project001",
        "domain": "team.example.com",
    },
    headers={
        'x-admin-auth': "<your_website_admin_password>",
        "Content-Type": "application/json"
    }
)
```

- If `example.com` is an allowed base domain, `team.example.com` and `dev.team.example.com` can match successfully
- Lookalike domains such as `badexample.com` will **not** be treated as `example.com`
- This is different from `RANDOM_SUBDOMAIN_DOMAINS`: here the caller **explicitly specifies** the subdomain, instead of the system generating a random one
- In the admin panel, this can be set to **Follow Environment Variable / Force Enable / Force Disable**. Choosing **Follow Environment Variable** clears the admin override and returns to env fallback behavior.

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
                # "x-custom-auth": "<your_website_password>", # If private site password is enabled
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
