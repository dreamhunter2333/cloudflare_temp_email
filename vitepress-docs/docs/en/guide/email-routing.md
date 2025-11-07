# Cloudflare Email Routing

1. In the CF console for the corresponding domain under `Email Routing`, configure the `Email DNS records`. If there are multiple domains, you need to configure `Email DNS records` for each domain.

2. Before binding an email address to your Worker, you need to enable email routing and have at least one verified email address (destination address).

3. Configure the `Catch-all address` in the routing rules of each domain's `Email Routing` to send to `worker`.

![email](/readme_assets/email.png)
