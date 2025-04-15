# Cloudflare Worker 后端

> [!warning] 注意
> `worker.dev` 域名在中国无法访问，请自定义域名

## 初始化项目

```bash
cd worker
pnpm install
cp wrangler.toml.template wrangler.toml
```

## 创建 KV 缓存

> [!NOTE]
> 如果你要启用注册用户功能，并需要发送邮件验证，则需要创建 `KV` 缓存, 不需要可跳过此步骤
> 如果需要 Telegram Bot，需要创建 `KV` 缓存，不需要可跳过此步骤

通过命令行创建 KV 缓存，或者在 Cloudflare 控制台创建，然后复制对应配置到 `wrangler.toml` 文件中

```bash
wrangler kv:namespace create DEV
```

## 修改 `wrangler.toml` 配置文件

> [!NOTE] 注意
> 更多变量的配置请查看 [worker变量说明](/zh/guide/worker-vars)

```toml
name = "cloudflare_temp_email"
main = "src/worker.ts"
compatibility_date = "2024-09-23"
compatibility_flags = [ "nodejs_compat" ]

# 如果你想使用自定义域名，你需要添加 routes 配置
# routes = [
#  { pattern = "temp-email-api.xxxxx.xyz", custom_domain = true },
# ]

# 如果你想要部署带有前端资源的 worker, 你需要添加 assets 配置
# [assets]
# directory = "../frontend/dist/"
# binding = "ASSETS"
# run_worker_first = true

# 如果你想要使用定时任务清理邮件，取消下面的注释，并修改 cron 表达式
# [triggers]
# crons = [ "0 0 * * *" ]

# 通过 Cloudflare 发送邮件
# send_email = [
#    { name = "SEND_MAIL" },
# ]

[vars]
# 邮箱名称前缀，不需要后缀可配置为空字符串或者不配置
PREFIX = "tmp"
# 用于临时邮箱的所有域名, 支持多个域名
DOMAINS = ["xxx.xxx1" , "xxx.xxx2"]
# 用于生成 jwt 的密钥, jwt 用于给用户登录以及鉴权
JWT_SECRET = "xxx"

# admin 控制台密码, 不配置则不允许访问控制台
# ADMIN_PASSWORDS = ["123", "456"]

# 是否允许用户创建邮件, 不配置则不允许
ENABLE_USER_CREATE_EMAIL = true
# 允许用户删除邮件, 不配置则不允许
ENABLE_USER_DELETE_EMAIL = true

# D1 数据库的名称和 ID 可以在 cloudflare 控制台查看
[[d1_databases]]
binding = "DB"
database_name = "xxx" # D1 数据库名称
database_id = "xxx" # D1 数据库 ID

# kv config 用于用户注册发送邮件验证码，如果不启用用户注册或不启用注册验证，可以不配置
# [[kv_namespaces]]
# binding = "KV"
# id = "xxxx"

# 新建地址限流配置 /api/new_address
# [[unsafe.bindings]]
# name = "RATE_LIMITER"
# type = "ratelimit"
# namespace_id = "1001"
# # 10 requests per minute
# simple = { limit = 10, period = 60 }

# 绑定其他 worker 处理邮件，例如通过 auth-inbox ai 能力解析验证码或激活链接
# [[services]]
# binding = "AUTH_INBOX"
# service = "auth-inbox"
```

## 部署带有前端页面的 worker(可选)

> [!NOTE]
> 如果不需要 [带有前端页面的 worker]，可以跳过此步骤
> 参考之后部署前端文档，可以进行前后端分离部署

确认已构建前端资源到 `frontend/dist` 目录

```bash
cd frontend
pnpm install --no-frozen-lockfile
pnpm build:pages
```

`worker` 目录下的 `wrangler.toml` 文件中添加下面的配置

```toml
[assets]
directory = "../frontend/dist/"
binding = "ASSETS"
run_worker_first = true
```

## Telegram Bot 配置

> [!NOTE]
> 如果不需要 Telegram Bot, 可跳过此步骤

请先创建一个 Telegram Bot，然后获取 `token`，然后执行下面的命令，将 `token` 添加到 secrets 中

```bash
pnpm wrangler secret put TELEGRAM_BOT_TOKEN
```

## 部署

第一次部署会提示创建项目, `production` 分支请填写 `production`

```bash
pnpm run deploy
```

部署成功之后再路由中可以看到 `worker` 的 `url`，控制台也会输出 `worker` 的 `url`

![worker](/readme_assets/worker.png)

> [!NOTE]
> 打开 `worker` 的 `url`，如果显示 `OK` 说明部署成功
>
> 打开 `/health_check`，如果显示 `OK` 说明部署成功
