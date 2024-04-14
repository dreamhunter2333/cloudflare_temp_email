# Cloudflare workers 后端

## 初始化项目

```bash
cd worker
pnpm install
cp wrangler.toml.template wrangler.toml
```

## 修改 `wrangler.toml` 配置文件

```bash
name = "cloudflare_temp_email"
main = "src/worker.js"
compatibility_date = "2023-12-01"
# 如果你想使用自定义域名，你需要添加 routes 配置
# routes = [
#  { pattern = "temp-email-api.xxxxx.xyz", custom_domain = true },
# ]
node_compat = true

[vars]
PREFIX = "tmp" # 要处理的邮箱名称前缀，不需要后缀可配置为空字符串
# 如果你想要你的网站私有，取消下面的注释，并修改密码
# PASSWORDS = ["123", "456"]
# admin 控制台密码, 不配置则不允许访问控制台
# ADMIN_PASSWORDS = ["123", "456"]
DOMAINS = ["xxx.xxx1" , "xxx.xxx2"] # 你的域名, 支持多个域名
JWT_SECRET = "xxx" # 用于生成 jwt 的密钥
BLACK_LIST = "" # 黑名单，用于过滤发件人，逗号分隔

# D1 数据库的名称和 ID 可以在 cloudflare 控制台查看
[[d1_databases]]
binding = "DB"
database_name = "xxx" # D1 数据库名称
database_id = "xxx" # D1 数据库 ID
```

## 部署

第一次部署会提示创建项目, `production` 分支请填写 `production`

```bash
pnpm run deploy
```

部署成功之后再路由中可以看到 `worker` 的 `url`，控制台也会输出 `worker` 的 `url`

![worker](/readme_assets/worker.png)
