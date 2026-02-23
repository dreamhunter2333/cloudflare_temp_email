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
        # "x-custom-auth": "<your-website-password>", # If custom password is enabled
        "Content-Type": "application/json"
    }
)
```

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

headers = {"x-admin-auth": "<your-Admin-password>"}

response = requests.get(url, headers=headers, params=querystring)

print(response.json())
```

**Note**: Keyword filtering has been removed from the backend API. If you need to filter emails by content, please use the frontend filter input in the UI, which filters the currently displayed page.

## Admin Delete Mail API

Delete a single mail by mail ID.

```python
import requests

mail_id = 1
url = f"https://<your-worker-address>/admin/mails/{mail_id}"

headers = {"x-admin-auth": "<your-Admin-password>"}

response = requests.delete(url, headers=headers)

print(response.json())
```

## Admin Delete Address API

Delete an email address by address ID (also deletes associated mails, sender permissions, and user bindings).

```python
import requests

address_id = 1
url = f"https://<your-worker-address>/admin/delete_address/{address_id}"

headers = {"x-admin-auth": "<your-Admin-password>"}

response = requests.delete(url, headers=headers)

print(response.json())
```

## Admin Clear Inbox API

Clear all received mails for an address by address ID.

```python
import requests

address_id = 1
url = f"https://<your-worker-address>/admin/clear_inbox/{address_id}"

headers = {"x-admin-auth": "<your-Admin-password>"}

response = requests.delete(url, headers=headers)

print(response.json())
```

## Admin Clear Sent Items API

Clear all sent mails for an address by address ID.

```python
import requests

address_id = 1
url = f"https://<your-worker-address>/admin/clear_sent_items/{address_id}"

headers = {"x-admin-auth": "<your-Admin-password>"}

response = requests.delete(url, headers=headers)

print(response.json())
```

## User Mail API

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

headers = {"x-user-token": "<your-user-JWT-token>"}

response = requests.get(url, headers=headers, params=querystring)

print(response.json())
```

**Note**: Keyword filtering has been removed from the backend API. If you need to filter emails by content, please use the frontend filter input in the UI, which filters the currently displayed page.
