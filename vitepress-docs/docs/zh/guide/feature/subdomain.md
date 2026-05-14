# 配置子域名邮箱

::: warning 注意
子域名邮箱发送邮件可能无法发送邮件，建议使用主域名邮箱发送邮件，子域名邮箱仅用于接收邮件。

mail channel 已不被支持，下面参考中仅限收件部分。
:::

参考

- [配置子域名邮箱](https://github.com/dreamhunter2333/cloudflare_temp_email/issues/164#issuecomment-2082612710)

## 创建随机二级域名地址

如果你已经配置好了基础域名的收件路由，还可以让用户在创建邮箱时，自动生成随机二级域名地址，例如：

- 基础域名：`abc.com`
- 创建结果：`name@x7k2p9q1.abc.com`

这适合做收件隔离、降低地址被重复命中的概率。

在 `worker` 变量中增加：

```toml
RANDOM_SUBDOMAIN_DOMAINS = ["abc.com"]
RANDOM_SUBDOMAIN_LENGTH = 8
```

- `RANDOM_SUBDOMAIN_DOMAINS`：允许启用随机二级域名的基础域名列表
- `RANDOM_SUBDOMAIN_LENGTH`：随机串长度，范围 `1-63`，默认 `8`

创建地址 API 需要显式传入 `enableRandomSubdomain: true` 才会生成随机二级域名。前端勾选“启用随机二级域名”时会自动传这个字段；如果你自己调用 `/api/new_address` 或 `/admin/new_address`，也需要在请求体中传入：

```json
{
  "name": "test",
  "domain": "abc.com",
  "enableRandomSubdomain": true
}
```

`domain` 必须传 `RANDOM_SUBDOMAIN_DOMAINS` 中配置的基础域名，例如 `abc.com`。如果要创建 `team.abc.com` 这种指定子域名地址，请不要传 `enableRandomSubdomain: true`，而是使用下方“直接指定子域名”的流程。

> [!NOTE]
> 这个功能只是在“创建地址”时自动补一个随机二级域名。
>
> 当前没有“全局强制随机二级域名”的后端开关；未传 `enableRandomSubdomain: true` 的 API 调用不会自动随机。

> [!IMPORTANT] 随机子域名需要 DNS 通配 MX 记录
> 程序只负责生成 `name@<random>.abc.com` 这样的地址，**能不能收到邮件完全取决于 DNS / Email Routing 是否覆盖到 `*.abc.com`**；Cloudflare Email Routing 的子域名配置**不会**从基础域名继承。可参考 Cloudflare 的 [Email Routing — Subdomains](https://developers.cloudflare.com/email-routing/setup/subdomains/) 文档。
>
> 让 `*.abc.com` 可投递有两种做法：
>
> 1. **DNS 通配 MX 记录（最简方案）** — 在 `abc.com` 的 DNS 中，把基础域名上**现有的每一条 MX 记录**都复制一份到 `*` 主机名上，**保留每条记录的 priority 与 target**。这样 `*.abc.com` 会解析到与 apex 相同的 MX 目标，邮件流向同一个 Cloudflare Email Routing zone，并由 apex 的 Catch-all 规则交给 Worker，**Cloudflare 侧不需要额外配置**。
> 2. **Cloudflare 控制台 “Add subdomain”** — 在 Email Routing 后台显式添加该子域名，并单独配置其 DNS 与 Catch-all 路由规则。这只覆盖你添加的那个具体子域名，不适合随机生成的任意子域名。
>
> 随机子域名场景下推荐使用 **方案 (1)**。如果不做这一步，随机子域名功能在前端看起来正常，但实际邮件不会进入 Worker。
>
> 参考 issue：[#1035](https://github.com/dreamhunter2333/cloudflare_temp_email/issues/1035)

## 允许 API 直接指定子域名

如果你不想让系统随机生成子域名，而是希望调用方在创建地址时直接指定 `team.abc.com` 这种子域名，
可以开启：

```toml
ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH = true
```

开启后，只要允许域名里包含基础域名 `abc.com`，那么：

- `name@team.abc.com`
- `name@dev.team.abc.com`

都可以通过 `/api/new_address` 或 `/admin/new_address` 创建。

> [!NOTE]
> 这个能力只放宽“创建地址 API 的域名校验”，不会改动默认域名下拉，也不会自动创建 Cloudflare 侧的
> 子域名邮箱路由。
>
> 如果你在管理后台里保存过这个开关，后续也可以通过“跟随环境变量”把它恢复到未设置状态，再重新回退到 env 默认值。
