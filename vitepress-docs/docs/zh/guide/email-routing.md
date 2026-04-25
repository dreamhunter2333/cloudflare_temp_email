# Cloudflare Email Routing

> [!IMPORTANT] 域名是部署的前提条件
> 本项目的收件能力**完全依赖** Cloudflare Email Routing。开始部署 Worker / Pages 之前，你必须先准备好域名并把 Email Routing 配通：
>
> - 域名 DNS 已托管在 Cloudflare。
> - 已在 Cloudflare 控制台为该域名启用 Email Routing，并完成 `电子邮件 DNS 记录` 的下发。
> - 已配置 Catch-all 路由规则，目标指向你部署的 Worker（部署完 Worker 之后才能选到）。
>
> 没有完成上述配置，即使 Worker / Pages 部署成功，也**收不到邮件、无法接收任何验证码**。

1. 在 CF 控制台网页的对应域名的 `Email Routing` 下，配置 `电子邮件 DNS 记录`, 如果是多个域名，需要配置多个域名的 `电子邮件 DNS 记录`

2. 在将电子邮件地址绑定到您的 Worker 之前，您需要启用电子邮件路由并拥有至少一个经过验证的电子邮件地址(目标地址)。

3. 配置每个域名的 `Email Routing` 的路由规则中的  `Catch-all 地址` 发送到 `worker`

![email](/readme_assets/email.png)

> [!WARNING] 子域需要单独配置
> 如果你要用**子域名**（如 `mail.example.com`）收信，必须在 CF 控制台里对 **该子域** 单独启用 `Email Routing`，并配置邮件 DNS 记录与 Catch-all 规则。仅在一级域名上开启 Email Routing **不会自动覆盖子域名**，子域名也**不会自动继承**父域名的 Email Routing 配置，未单独启用的子域名邮件将**无法投递**。
