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

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `proxy_url` | `http://localhost:8787` | Worker 后端 URL |
| `port` | `8025` | SMTP 端口 |
| `imap_port` | `11143` | IMAP 端口 |
| `smtp_tls_cert` | 空 | SMTP TLS 证书文件路径（PEM），配置后启用 STARTTLS |
| `smtp_tls_key` | 空 | SMTP TLS 私钥文件路径（PEM） |
| `imap_tls_cert` | 空 | IMAP TLS 证书文件路径（PEM），配置后启用 STARTTLS |
| `imap_tls_key` | 空 | IMAP TLS 私钥文件路径（PEM） |
| `imap_cache_size` | `500` | 每个邮箱的消息缓存上限 |
| `imap_http_timeout` | `30.0` | 后端 HTTP 请求超时时间（秒） |

## 启用 STARTTLS

分别配置 SMTP 和 IMAP 的 TLS 证书环境变量后，对应服务会自动支持 STARTTLS。SMTP 和 IMAP 可以使用同一套证书。

```bash
# .env 示例
smtp_tls_cert=/path/to/cert.pem
smtp_tls_key=/path/to/key.pem
imap_tls_cert=/path/to/cert.pem
imap_tls_key=/path/to/key.pem
```

Docker Compose 中配置：

```yaml
environment:
  - smtp_tls_cert=/certs/cert.pem
  - smtp_tls_key=/certs/key.pem
  - imap_tls_cert=/certs/cert.pem
  - imap_tls_key=/certs/key.pem
volumes:
  - ./certs:/certs:ro
```

## IMAP 登录方式

支持两种登录方式：

| 方式 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| JWT 凭证 | 邮箱地址 | JWT token | 从前端获取的地址凭证，直接认证 |
| 地址+密码 | 邮箱地址 | 地址密码 | 通过后端 `/api/address_login` 验证 |

系统会自动识别密码格式：以 `eyJ` 开头的三段式字符串视为 JWT，其他视为密码并调用后端验证。

## 使用 Thunderbird 登录

下载 [Thunderbird](https://www.thunderbird.net/en-US/)

密码填写 `邮箱地址凭证` 或 `邮箱地址密码`

![imap](/feature/imap.png)
