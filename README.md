# 使用 cloudflare 免费服务，搭建临时邮箱

## [English](README_EN.md)

[CHANGELOG](CHANGELOG)

[Backend](https://temp-email-api.dreamhunter2333.xyz/)
![](https://uptime.aks.awsl.icu/api/badge/10/status)
![](https://uptime.aks.awsl.icu/api/badge/10/uptime)
![](https://uptime.aks.awsl.icu/api/badge/10/ping)
![](https://uptime.aks.awsl.icu/api/badge/10/avg-response)
![](https://uptime.aks.awsl.icu/api/badge/10/cert-exp)
![](https://uptime.aks.awsl.icu/api/badge/10/response)

[Frontend](https://temp-email.dreamhunter2333.xyz/)
![](https://uptime.aks.awsl.icu/api/badge/12/status)
![](https://uptime.aks.awsl.icu/api/badge/12/uptime)
![](https://uptime.aks.awsl.icu/api/badge/12/ping)
![](https://uptime.aks.awsl.icu/api/badge/12/avg-response)
![](https://uptime.aks.awsl.icu/api/badge/12/cert-exp)
![](https://uptime.aks.awsl.icu/api/badge/12/response)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=dreamhunter2333/cloudflare_temp_email&type=Date&theme=dark" />
  <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=dreamhunter2333/cloudflare_temp_email&type=Date" />
  <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=dreamhunter2333/cloudflare_temp_email&type=Date" />
</picture>

- [使用 cloudflare 免费服务，搭建临时邮箱](#使用-cloudflare-免费服务搭建临时邮箱)
  - [English](#english)
  - [在线演示](#在线演示)
  - [功能/TODO](#功能todo)
  - [什么是临时邮箱](#什么是临时邮箱)
  - [Cloudflare 服务](#cloudflare-服务)
  - [wrangler 的安装](#wrangler-的安装)
  - [D1 数据库](#d1-数据库)
  - [Cloudflare workers 后端](#cloudflare-workers-后端)
  - [Cloudflare Workers 后端](#cloudflare-workers-后端-1)
  - [Cloudflare Email Routing](#cloudflare-email-routing)
  - [Cloudflare Pages 前端](#cloudflare-pages-前端)
  - [参考资料](#参考资料)

## [在线演示](https://temp-email.dreamhunter2333.xyz/)

## 功能/TODO

- [x] Cloudflare D1 作为数据库
- [x] 使用 Cloudflare Pages 部署前端
- [x] 使用 Cloudflare Workers 部署后端
- [x] email 转发使用 Cloudflare Email Routing
- [x] 使用 password 重新登录之前的邮箱
- [x] 获取自定义名字的邮箱
- [x] 支持多语言
- [x] 增加访问授权，可作为私人站点
- [x] 增加自动回复功能
- [x] 增加查看附件功能
- [x] 使用 rust wasm 解析邮件

---

## 什么是临时邮箱

临时邮箱，也被称为一次性邮箱或临时邮件地址，是一种用于临时接收邮件的虚拟邮箱。与常规邮箱不同，临时邮箱旨在提供一种匿名且临时的邮件接收解决方案。

临时邮箱往往由网站或在线服务提供商提供，用户可以在需要注册或接收验证邮件时使用临时邮箱地址，而无需暴露自己的真实邮箱地址。这样做的好处是可以保护个人隐私

---

## Cloudflare 服务

- `D1` 是 `Cloudflare` 的原生无服务器数据库。
- `Pages` 是 `Cloudflare` 的静态网站托管服务, 速度超快，始终保持最新状态。
- `Workers` 是 `Cloudflare` 的 `serverless` 应用服务，可以在全球 300 个数据中心运行代码, 而无需配置或维护基础架构。
- `Cloudflare Email Routing` 可以处理域名的所有电子邮件流量，而无需管理电子邮件服务器。

---

## wrangler 的安装

安装 wrangler

```bash
npm install wrangler -g
```

克隆项目

```bash
git clone https://github.com/dreamhunter2333/cloudflare_temp_email.git
```

---

## D1 数据库

第一次执行登录 wrangler 命令时，会提示登录, 按提示操作即可

```bash
# 创建 D1 并执行 schema.sql
wrangler d1 create dev
wrangler d1 execute dev --file=db/schema.sql
# schema 更新，如果你在此日期之前初始化过数据库，可以执行此命令更新
# wrangler d1 execute dev --file=db/2024-01-13-patch.sql
# wrangler d1 execute dev --file=db/2024-04-03-patch.sql
```

创建完成后，我们在 cloudflare 的控制台可以看到 D1 数据库

![D1](readme_assets/d1.png)

---

## Cloudflare workers 后端

初始化项目

```bash
cd worker
pnpm install
cp wrangler.toml.template wrangler.toml
```

修改 `wrangler.toml` 文件

```bash
name = "cloudflare_temp_email"
main = "src/worker.js"
compatibility_date = "2023-08-14"
node_compat = true

[vars]
PREFIX = "tmp" # 要处理的邮箱名称前缀
# 如果你想要你的网站私有，取消下面的注释，并修改密码
# PASSWORDS = ["123", "456"]
# admin 控制台密码, 不配置则不允许访问控制台
# ADMIN_PASSWORDS = ["123", "456"]
DOMAINS = ["xxx.xxx1" , "xxx.xxx2"] # 你的域名
JWT_SECRET = "xxx" # 用于生成 jwt 的密钥
BLACK_LIST = "" # 黑名单，用于过滤发件人，逗号分隔

[[d1_databases]]
binding = "DB"
database_name = "xxx" # D1 数据库名称
database_id = "xxx" # D1 数据库 ID
```

---

## Cloudflare Workers 后端

部署

```bash
pnpm run deploy
```

部署成功之后再路由中可以看到 `worker` 的 `url`，控制台也会输出 `worker` 的 `url`

![worker](readme_assets/worker.png)

---

## Cloudflare Email Routing

配置对应域名的 `电子邮件 DNS 记录`

配置 `Cloudflare Email Routing` catch-all 发送到 `worker`

![email](readme_assets/email.png)

---

## Cloudflare Pages 前端

```bash
cd frontend
pnpm install
cp .env.example .env.local
```

修改 `.env.local` 文件, 将 `VITE_API_BASE` 修改为 `worker` 的 `url`, 不要在末尾加 `/`

例如: `VITE_API_BASE=https://xxx.xxx.workers.dev`

```bash
pnpm build --emptyOutDir
# 根据提示创建 pages
pnpm run deploy
```

![pages](readme_assets/pages.png)

## 参考资料

- https://developers.cloudflare.com/d1/
- https://developers.cloudflare.com/pages/
- https://developers.cloudflare.com/workers/
- https://developers.cloudflare.com/email-routing/
