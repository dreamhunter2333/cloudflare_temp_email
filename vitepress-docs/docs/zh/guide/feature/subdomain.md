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

`domain` 应传 `RANDOM_SUBDOMAIN_DOMAINS` 中配置的基础域名，例如 `abc.com`。如果传入 `team.abc.com`，这属于“直接指定子域名”的场景，不会再额外随机生成子域名。

> [!NOTE]
> 这个功能只是在“创建地址”时自动补一个随机二级域名。
>
> 当前没有“全局强制随机二级域名”的后端开关；未传 `enableRandomSubdomain: true` 的 API 调用不会自动随机。
>
> 它不会自动帮你创建 Cloudflare 侧的子域名收件路由或 DNS 配置，请先确保基础域名/子域名路由本身已经可用。

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
