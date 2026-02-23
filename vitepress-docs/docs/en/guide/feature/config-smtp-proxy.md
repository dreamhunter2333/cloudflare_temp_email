# Setting Up SMTP IMAP Proxy Service

::: warning Notice
If you are using `resend`, you can directly use `resend`'s `SMTP` service without needing this service
:::

## Why Do You Need SMTP IMAP Proxy Service

`SMTP` and `IMAP` have a wider range of application scenarios

## How to Set Up SMTP IMAP Proxy Service

### Local Run

```bash
cd smtp_proxy_server/
# Copy configuration file and modify it
# Your worker address, proxy_url=https://temp-email-api.xxx.xxx
# Your SMTP service port, port=8025
cp .env.example .env
python3 -m venv venv
./venv/bin/python3 -m pip install -r requirements.txt
./venv/bin/python3 main.py
```

### Docker Run

```bash
cd smtp_proxy_server/
docker-compose up -d
```

Modify the environment variables in docker-compose.yaml, note to choose the appropriate `tag`

`proxy_url` is the URL address of the `worker`

```yaml
services:
  smtp_proxy_server:
    image: ghcr.io/dreamhunter2333/cloudflare_temp_email/smtp_proxy_server:latest
    # build:
    #   context: .
    #   dockerfile: dockerfile
    container_name: "smtp_proxy_server"
    ports:
      - "8025:8025"
      - "11143:11143"
    environment:
      - proxy_url=https://temp-email-api.xxx.xxx
      - port=8025
      - imap_port=11143
```

## Using Thunderbird to Login

Download [Thunderbird](https://www.thunderbird.net/en-US/)

For password, enter the `email address credential`

![imap](/feature/imap.png)
