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

> [!NOTE]
> 这个功能只是在“创建地址”时自动补一个随机二级域名。
>
> 它不会自动帮你创建 Cloudflare 侧的子域名收件路由或 DNS 配置，请先确保基础域名/子域名路由本身已经可用。
