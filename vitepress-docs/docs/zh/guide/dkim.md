# 配置 DKIM

如果你不想配置 DKIM，可以跳过这一节。

参考: [Adding-a-DKIM-Signature](https://support.mailchannels.com/hc/en-us/articles/7122849237389-Adding-a-DKIM-Signature)

Creating a DKIM private and public key:
Private key as PEM file and base64 encoded txt file:

```bash
openssl genrsa 2048 | tee priv_key.pem | openssl rsa -outform der | openssl base64 -A > priv_key.txt
```

Public key as DNS record:

```bash
echo -n "v=DKIM1;p=" > pub_key_record.txt && \
openssl rsa -in priv_key.pem -pubout -outform der | openssl base64 -A >> pub_key_record.txt
```

在 `Cloudflare` 的 `DNS` 记录中添加 `TXT` 记录

例如:

- `_dmarc`: `v=DMARC1; p=none; adkim=r; aspf=r;`
- `mailchannels._domainkey`: `v=DKIM1; p=<content of the file pub_key_record.txt>`

那我在 `wrangler.toml` 中的配置应该是这样的:

```toml
DKIM_SELECTOR = "mailchannels"
DKIM_PRIVATE_KEY = "<priv_key.txt 的内容>"
```
