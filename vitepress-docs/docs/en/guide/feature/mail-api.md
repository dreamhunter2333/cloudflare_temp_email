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

Supports `address` filter and `keyword` filter

```python
import requests

url = "https://<your-worker-address>/admin/mails"

querystring = {
    "limit":"20",
    "offset":"0",
    # address and keyword are optional parameters
    "address":"xxxx@awsl.uk",
    "keyword":"xxxx"
}

headers = {"x-admin-auth": "<your-Admin-password>"}

response = requests.get(url, headers=headers, params=querystring)

print(response.json())
```

## User Mail API

Supports `address` filter and `keyword` filter

```python
import requests

url = "https://<your-worker-address>/user_api/mails"

querystring = {
    "limit":"20",
    "offset":"0",
    # address and keyword are optional parameters
    "address":"xxxx@awsl.uk",
    "keyword":"xxxx"
}

headers = {"x-admin-auth": "<your-Admin-password>"}

response = requests.get(url, headers=headers, params=querystring)

print(response.json())
```
