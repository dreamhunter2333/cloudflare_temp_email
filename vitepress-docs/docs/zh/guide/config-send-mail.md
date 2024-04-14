
# 配置发送邮件

1. 找到域名 `DNS` 记录的 `TXT` 的 `SPF` 记录, 增加 `include:relay.mailchannels.net`

    `v=spf1 include:_spf.mx.cloudflare.net include:relay.mailchannels.net ~all`

2. 新建 `_mailchannels` 记录, 类型为 `TXT`, 内容为 `v=mc1 cfid=你的worker域名`

- 此处 worker 域名为后端 api 的域名，比如我部署在 `https://temp-email-api.awsl.uk/`，则填写 `v=mc1 cfid=awsl.uk`

- 如果你的域名是 `https://temp-email-api.xxx.workers.dev`，则填写 `v=mc1 cfid=xxx.workers.dev`
