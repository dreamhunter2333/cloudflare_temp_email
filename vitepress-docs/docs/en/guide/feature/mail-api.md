# Mail API

## Mailbox Password JWT Validation and Renewal

Mailbox APIs accept legacy mailbox credentials and password sessions containing `type: "address_password_login"`, `address`, `address_id`, `iat`, and `exp`. The backend verifies signatures and mailbox identity, and requires password sessions to be unexpired, issued no later than the current time, and valid for no more than 30 days.

- Mailbox APIs retain `Authorization: Bearer <jwt>` without a database migration.
- `GET /api/settings` returns mailbox identity, `send_balance`, and `new_address_token`. A valid password-session JWT with less than seven days remaining receives a new 30-day token; otherwise the field is `null`. Legacy credentials do not renew, and expired sessions must log in again.
- Clients using renewal must save `new_address_token` and use it for subsequent requests.

The web client updates only the active JWT from one successful settings response. The local cache retains token strings and its existing append and bind behavior, without replacing or deduplicating historical tokens. Switching to an expired cached session requires logging in again. JWT decoding is only for mailbox and login-method display; authorization remains on the backend.

Existing password-login, mailbox-creation, user, admin, and Telegram routes still issue legacy credentials. The login-page switch still only controls the login entry and does not reject legacy credentials; switching issuance follows in a later stage.

## Viewing Emails via Mail API

This is a `python` example using the `requests` library to view emails.

```python
limit = 10
offset = 0
res = requests.get(
    f"https://<your-worker-address>/api/mails?limit={limit}&offset={offset}",
    headers={
        "Authorization": f"Bearer {your-JWT-password}",
        # "x-custom-auth": "<your-website-password>", # If private site password is enabled
        "Content-Type": "application/json"
    }
)
```

**Note**: `/api/mails` returns raw RFC822 data by design (for example `source`/`raw`), and it does not guarantee parsed fields such as `subject`, `text`, or `html`. Parse the raw source on the client side (for example with `mail-parser-wasm` or `postal-mime`) if you need readable message content.

## Admin Mail API

Supports `address` filter

```python
import requests

url = "https://<your-worker-address>/admin/mails"

querystring = {
    "limit":"20",
    "offset":"0",
    # address is optional parameter
    "address":"xxxx@awsl.uk"
}

headers = {
        "x-admin-auth": "<your-Admin-password>",
        # "x-custom-auth": "<your-website-password>", # If private site password is enabled
    }

response = requests.get(url, headers=headers, params=querystring)

print(response.json())
```

**Note**: `/admin/mails` follows the same design as `/api/mails`: it returns stored raw MIME data. If you need readable subject/body, parse the raw content on the client side.

**Note**: Keyword filtering has been removed from the backend API. If you need to filter emails by content, please use the frontend filter input in the UI, which filters the currently displayed page.

## Mail Read Status API

Enable `ENABLE_MAIL_READ_STATUS` and upgrade the database first. Historical mail has `is_unread = NULL` and is treated as read; new mail has `is_unread = 1`. Opening unread mail from the web mail list marks it as read, and its detail view can switch the state manually. Refreshing the page does not mark it as read:

- `PATCH /api/mails/:id/read`: set one mail belonging to the current address; use `{ "isUnread": true }` for unread or `{ "isUnread": false }` for read

## Admin Get Mail API

Fetch a single mail by mail ID without a mailbox JWT. Authenticate with `x-admin-auth`.
The response matches one entry returned by `/admin/mails`: gzip-compressed raw content is decompressed into `raw`, and `raw_blob` is excluded.

```python
import requests

mail_id = 1
url = f"https://<your-worker-address>/admin/mails/{mail_id}"

headers = {
        "x-admin-auth": "<your-Admin-password>",
        # "x-custom-auth": "<your-website-password>", # If private site password is enabled
    }

response = requests.get(url, headers=headers)

print(response.json())
```

## Admin Delete Mail API

Delete a single mail by mail ID.

```python
import requests

mail_id = 1
url = f"https://<your-worker-address>/admin/mails/{mail_id}"

headers = {
        "x-admin-auth": "<your-Admin-password>",
        # "x-custom-auth": "<your-website-password>", # If private site password is enabled
    }

response = requests.delete(url, headers=headers)

print(response.json())
```

## Admin Delete Address API

Delete an email address by address ID (also deletes associated mails, sender permissions, and user bindings).

```python
import requests

address_id = 1
url = f"https://<your-worker-address>/admin/delete_address/{address_id}"

headers = {
        "x-admin-auth": "<your-Admin-password>",
        # "x-custom-auth": "<your-website-password>", # If private site password is enabled
    }

response = requests.delete(url, headers=headers)

print(response.json())
```

## Admin Clear Inbox API

Clear all received mails for an address by address ID.

```python
import requests

address_id = 1
url = f"https://<your-worker-address>/admin/clear_inbox/{address_id}"

headers = {
        "x-admin-auth": "<your-Admin-password>",
        # "x-custom-auth": "<your-website-password>", # If private site password is enabled
    }

response = requests.delete(url, headers=headers)

print(response.json())
```

## Admin Clear Sent Items API

Clear all sent mails for an address by address ID.

```python
import requests

address_id = 1
url = f"https://<your-worker-address>/admin/clear_sent_items/{address_id}"

headers = {
        "x-admin-auth": "<your-Admin-password>",
        # "x-custom-auth": "<your-website-password>", # If private site password is enabled
    }

response = requests.delete(url, headers=headers)

print(response.json())
```

## User Mail API

::: warning Note: User JWT vs Address JWT
These endpoints use a **User JWT** (obtained via `/user_api/login` after registration), with the `x-user-token` header. Binding an address also requires an Address JWT in the same request.

**Do not confuse with Address JWT**:
- Address JWT uses `Authorization: Bearer <jwt>` to access `/api/*` endpoints
- User JWT uses `x-user-token: <jwt>` to access `/user_api/*` endpoints
:::

### Bind an Email Address to a User Account

Binding associates an existing mailbox with the currently logged-in user account so it can be managed in the user center. For Telegram bindings, see [Telegram Bot](./telegram.md#per-user-mail-push).

`POST /user_api/bind_address` requires both credentials:

| Header | Value |
| --- | --- |
| `x-user-token` | The current account's User JWT, from the `jwt` field returned by `POST /user_api/login` |
| `Authorization` | `Bearer <Address-JWT>`, using the `jwt` returned when [creating a mailbox](./new-address-api.md) or the Address JWT obtained after mailbox login |

No request body is required. User and mailbox identities come from these two JWTs; `user_id`, `address_id`, and email addresses cannot be supplied through the request body. Include `x-custom-auth` if the site requires an access password.

```python
import requests

response = requests.post(
    "https://<your-worker-address>/user_api/bind_address",
    headers={
        "x-user-token": "<your-user-JWT-token>",
        "Authorization": "Bearer <your-address-JWT>",
        # "x-custom-auth": "<your-site-password>",
    },
)
print(response.json())  # {"success": True}
```

Success returns `{"success": true}`; binding the same address to the same user again also succeeds. An address already bound to another user or a user who has reached their address limit results in 400.

### Bound Address List

`GET /user_api/bind_address` uses server-side pagination and accepts these query parameters:

Requests without pagination parameters return the default first page. Fetching all bound addresses in one request is not supported.

| Parameter | Default | Description |
| --- | --- | --- |
| `limit` | `20` | Page size, from 1 to 100 |
| `offset` | `0` | Pagination offset |
| `query` | Empty | Optional email address keyword filter for the current user's bound addresses; at most 100 characters, without `%` or `_` (invalid queries return 400) |

The `results` array contains only the current page. The filtered total is queried only when `offset=0`; later pages return `count: 0`, so clients should retain the total from the first page.

```python
import requests

url = "https://<your-worker-address>/user_api/bind_address"
headers = {
    "x-user-token": "<your-user-JWT-token>",
}
querystring = {
    "limit": "20",
    "offset": "0",
}
response = requests.get(url, headers=headers, params=querystring)
print(response.json())
```

### Get an Address JWT for a Bound Mailbox

`GET /user_api/bind_address_jwt/:address_id` uses the User JWT and only returns credentials for mailboxes bound to the current user. Obtain `address_id` from `results[].id` in the bound address list above. Use the returned `jwt` as `Authorization: Bearer <jwt>` for `/api/*` mailbox endpoints.

```python
import requests

address_id = 1
response = requests.get(
    f"https://<your-worker-address>/user_api/bind_address_jwt/{address_id}",
    headers={
        "x-user-token": "<your-user-JWT-token>",
        # "x-custom-auth": "<your-site-password>",
    },
)
print(response.json())  # {"jwt": "..."}
```

### Unbind an Email Address

`POST /user_api/unbind_address` uses the User JWT with a body of `{"address_id": 1}` and returns `{"success": true}` on success. It removes only the current user's association with the mailbox, without deleting the mailbox or its messages or revoking issued Address JWTs. Save the mailbox credential before unbinding to retain access or bind it again later.

```python
import requests

response = requests.post(
    "https://<your-worker-address>/user_api/unbind_address",
    headers={
        "x-user-token": "<your-user-JWT-token>",
        # "x-custom-auth": "<your-site-password>",
    },
    json={"address_id": 1},
)
print(response.json())  # {"success": True}
```

### User Mail List

Supports `address` filter

```python
import requests

url = "https://<your-worker-address>/user_api/mails"

querystring = {
    "limit":"20",
    "offset":"0",
    # address is optional parameter
    "address":"xxxx@awsl.uk"
}

headers = {
        "x-user-token": "<your-user-JWT-token>",
        # "x-custom-auth": "<your-website-password>", # If private site password is enabled
    }

response = requests.get(url, headers=headers, params=querystring)

print(response.json())
```

**Note**: `/user_api/mails` also returns raw RFC822 content from storage; parse it in your client to extract `subject`, `text`, and `html`.

**Note**: Keyword filtering has been removed from the backend API. If you need to filter emails by content, please use the frontend filter input in the UI, which filters the currently displayed page.
