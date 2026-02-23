# Cloudflare Email Routing

1. 在 CF 控制台网页的对应域名的 `Email Routing` 下，配置 `电子邮件 DNS 记录`, 如果是多个域名，需要配置多个域名的 `电子邮件 DNS 记录`

2. 在将电子邮件地址绑定到您的 Worker 之前，您需要启用电子邮件路由并拥有至少一个经过验证的电子邮件地址(目标地址)。

3. 配置每个域名的 `Email Routing` 的路由规则中的  `Catch-all 地址` 发送到 `worker`

![email](/readme_assets/email.png)
