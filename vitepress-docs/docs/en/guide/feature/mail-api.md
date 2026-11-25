# Mail API

## Mailbox Password JWT Validation and Renewal

Mailbox APIs accept legacy mailbox credentials and password sessions containing `type: "address_password_login"`, `address`, `address_id`, `iat`, and `exp`. The backend verifies signatures and mailbox identity, and requires password sessions to be unexpired, issued no later than the current time, and valid for no more than 30 days.

- Mailbox APIs retain `Authorization: Bearer <jwt>` without a database migration.
- `GET /api/settings` returns only `address`, `send_balance`, and `new_address_token`. A valid password-session JWT with less than seven days remaining receives a new 30-day token; otherwise the field is `null`. Legacy credentials do not renew, and expired sessions must log in again.
- Clients must replace their current token only when `new_address_token` is non-null; when it is `null`, keep using the current token.

The web client updates only the active JWT from one successful settings response. The local cache retains token strings and its existing append and bind behavior, without replacing or deduplicating historical tokens. Switching to an expired cached session requires logging in again. JWT decoding is only for mailbox, login-method, and token-expiry display; authorization remains on the backend.

With both `ENABLE_ADDRESS_PASSWORD=true` and `ADDRESS_PASSWORD_LOGIN_ONLY=true`, password login, mailbox creation, and authorized user, admin, and Telegram access issue 30-day password-session JWTs for mailbox API access and renewal through settings below seven days. With `ENABLE_ADDRESS_PASSWORD=false`, password login returns 403. With mailbox passwords enabled and `ADDRESS_PASSWORD_LOGIN_ONLY=false`, password login issues legacy credentials. Creation and other authorized entry points issue legacy credentials whenever password-only mode is ineffective. Previously issued valid sessions remain usable and renewable. Legacy credentials, credential-login links, and direct API access remain compatible. API clients must replace their current token only when `new_address_token` is non-null. Changing the mailbox password does not revoke issued JWTs. A session renewed before every expiry has no fixed end date.

The UI keeps session-token access and shows the token expiry time. Auto-login links and QR codes using that token expire at the same time. Password-only mode hides legacy credential contents, connection details, and legacy mailbox-switching options. The management table retains legacy cache entries for manual removal and hides their switch action. The selector still shows the known current mailbox. Disabling the switch restores legacy cache switching.

Telegram retains its separate permanent internal binding tokens. Expiry is ignored only for stored historical bindings read after Telegram authentication, with signature and mailbox identity still checked. New bindings require normal mailbox authentication.

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

## Reading a Mailbox by Address

`GET /open_api/mailbox` needs no mailbox JWT: given an email address it reads that inbox and extracts verification codes, which makes it convenient for polling from scripts (auto sign-up, auto login and similar flows).

Authorization is resolved in this order (any one match is accepted):

1. When `MAILBOX_QUERY_KEY` is set, the request must pass `?key=<key>` or the `x-mailbox-key` header;
2. When `MAILBOX_QUERY_PUBLIC=true`, anonymous access is allowed;
3. When the site password `PASSWORDS` is set, the request must pass the `x-custom-auth` header;
4. When none of the above is configured, the endpoint is disabled and returns 403.

Supported query parameters:

| Parameter | Default | Description |
| --- | --- | --- |
| `address` | required | Email address, case insensitive |
| `limit` | `10` | Number of mails to return, 1–100 |
| `offset` | `0` | Pagination offset |
| `id` | empty | Mail ID, returns only that mail (including body) |
| `code_only` | `false` | Only return mails a code was extracted from |
| `include_body` | `false` | Include plain text body in `text` (truncated to 4000 characters) |
| `include_html` | `false` | With `include_body`, include HTML body (truncated to 20000 characters) |
| `format` | `json` | `json`; `text` returns the code as plain text only; `html` returns a simple browser-friendly page |

```bash
# Read the code from the newest mail (plain text, empty string when nothing matched)
curl "https://<your-worker-address>/open_api/mailbox?address=xxx@awsl.uk&key=<key>&code_only=true&limit=1&format=text"
```

```python
import requests

res = requests.get(
    "https://<your-worker-address>/open_api/mailbox",
    params={
        "address": "xxx@awsl.uk",
        "key": "<key>",  # if MAILBOX_QUERY_KEY is not used and the site password is enabled, send header x-custom-auth instead
        "code_only": "true",
        "limit": 1,
    },
    timeout=10,
)
data = res.json()
print(data["code"])  # code from the newest mail that contains one, null when nothing matched
```

Example JSON response (`count` is the total number of mails for that address and is only meaningful on the first page):

```json
{
  "address": "xxx@awsl.uk",
  "count": 2,
  "code": "483920",
  "mails": [
    {
      "id": 1,
      "from": "noreply@service.com",
      "subject": "Your verification code is 483920",
      "created_at": "2026-11-25 10:00:00",
      "code": "483920"
    }
  ]
}
```

Mails are returned newest first (by descending ID); `code` is the newest extracted code among the returned mails. An unknown address returns 404, an invalid address returns 400. `count` is the total number of mails for that address and is returned on every page, so you can tell whether more pages exist.

To read older history, page with `limit` + `offset` (up to 100 mails per page; the endpoint never truncates the inbox to the newest few mails):

```python
page_size, offset, all_mails = 100, 0, []
while True:
    page = requests.get(
        "https://<your-worker-address>/open_api/mailbox",
        params={"address": "xxx@awsl.uk", "key": "<key>", "limit": page_size, "offset": offset},
        timeout=10,
    ).json()
    all_mails.extend(page["mails"])
    if len(page["mails"]) < page_size:
        break
    offset += page_size
print(page["count"], len(all_mails))  # total mails vs mails actually fetched
```

::: warning
With `MAILBOX_QUERY_PUBLIC` enabled, anyone who knows the email address can read that inbox. Use it only in trusted environments; prefer `MAILBOX_QUERY_KEY` in production.
:::

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
