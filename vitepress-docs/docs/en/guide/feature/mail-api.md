# Mail API

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
