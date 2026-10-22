# Mail API

## Mailbox password login

`ADDRESS_PASSWORD_LOGIN_ONLY` defaults to `false` and only takes effect with `ENABLE_ADDRESS_PASSWORD=true`. When off, password login and mailbox creation retain legacy token issuance without a new 30-day lifetime. When enabled, it rejects legacy credentials for login and API access and hides credential displays and automatic login links. Legacy credential links also fail API authentication. No database migration is needed.

- When the policy is enabled, password login issues a 30-day JWT with `type: "address_password_login"`, `address`, `address_id`, `iat`, and `exp`. Mailbox APIs retain `Authorization: Bearer <jwt>` and use middleware for authentication. After the switch is disabled, new logins return legacy tokens; previously issued valid expiring JWTs remain usable and renewable.
- `GET /api/settings` returns this login information, `send_balance`, and `new_address_token`. A valid JWT with less than 7 days remaining receives a new 30-day token; otherwise the field is `null`. Expired JWTs require login again, and legacy credentials cannot obtain new tokens.
- After successfully loading settings, the frontend saves the server-issued `new_address_token` and updates the local mailbox cache without another settings request or decoding the JWT. Ordinary requests do not refresh tokens. External clients should also save `new_address_token`; the switch rejects legacy credentials used directly by SMTP/IMAP and Agent clients.
- The local cache uses server-returned mailbox information without decoding JWTs and retains both login methods independently. Historical token-only entries display “Saved mailbox” until selected and validated. Password-only login hides identified legacy entries without deleting them.
- Mailbox creation and authorized access through user accounts, administrators, and Telegram issue mailbox JWTs according to the switch. Telegram KV stores separate permanent `telegram_binding` tokens, which mailbox APIs reject. Expiration is ignored only for historical stored bindings accessed after Telegram identity verification; tokens submitted for new bindings must pass mailbox authentication.


### Change the mailbox password

With `ENABLE_ADDRESS_PASSWORD` enabled, use the existing password-change action in the authenticated mailbox settings without supplying the old password. It continues to use `POST /api/address_change_password`; no User-tab reset action or user reset endpoint is added. For historical mailboxes without passwords, set one inside the mailbox before enabling password-only login, or ask an administrator to set it. Changing a password does not revoke existing JWTs; valid expiring JWTs can still renew.

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
This endpoint uses **User JWT** (obtained via `/user_api/login` or `/user_api/register`), with `x-user-token` header.

**Do not confuse with Address JWT**:
- Address JWT uses `Authorization: Bearer <jwt>` to access `/api/*` endpoints
- User JWT uses `x-user-token: <jwt>` to access `/user_api/*` endpoints
:::

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
