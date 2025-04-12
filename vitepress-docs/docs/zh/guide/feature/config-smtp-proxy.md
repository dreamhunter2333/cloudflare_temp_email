# 搭建 SMTP IMAP 代理服务

::: warning 注意
如果你使用了 `resend`, 可直接使用 `resend` 的 `SMTP` 服务，不需要使用此服务
:::

## 为什么需要 SMTP IMAP 代理服务

`SMTP` `IMAP` 的应用场景更加广泛

## 如何搭建 SMTP IMAP 代理服务

### Local Run

```bash
cd smtp_proxy_server/
# 复制配置文件, 并修改配置文件
# 你的 worker 地址，proxy_url=https://temp-email-api.xxx.xxx
# 你的 SMTP 服务端口，port=8025
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

修改 docker-compose.yaml 中的环境变量, 注意选择合适的 `tag`

`proxy_url` 为 `worker` 的 URL 地址

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

## 使用 Thunderbird 登录

下载 [Thunderbird](https://www.thunderbird.net/en-US/)

密码填写 `邮箱地址凭证`

![imap](/feature/imap.png)
