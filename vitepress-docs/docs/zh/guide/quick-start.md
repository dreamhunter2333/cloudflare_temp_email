# 快速开始

## 开始之前

> [!IMPORTANT] 必须先准备一个域名
> 本项目依赖 Cloudflare Email Routing 接收邮件，**域名是部署前提条件**。
> 你必须先准备一个域名（一级域名或子域名均可），并在 Cloudflare 中托管 DNS、启用 Email Routing、完成对应的电子邮件 DNS 记录下发。Worker 部署完成后，再把 Catch-all 规则绑定到这个 Worker；两步缺一都会导致**无法接收邮件 / 无法完成验证码流程**。
> 详细配置见 [Cloudflare Email Routing](/zh/guide/email-routing)。

需要 `良好的网络环境` 和 `cloudflare 账号`， 打开 [cloudflare控制台](https://dash.cloudflare.com/)

请选择下面三种方式之一进行部署

- [通过命令行部署](/zh/guide/cli/pre-requisite)
- [通过用户界面部署](/zh/guide/ui/d1)
- [通过Github Actions 部署](/zh/guide/actions/pre-requisite)

### 也可以参考网友提供的详细的小白教程

- [【教程】小白也能看懂的自建Cloudflare临时邮箱教程（域名邮箱）](https://linux.do/t/topic/316819/1)

## 了解登录入口

前端的三个入口对应不同对象，使用的凭据也不同：

| 入口 | 用途 | 登录凭据 |
|------|------|----------|
| `/`（或 `/:lang/`） | 打开单个邮箱，查看收件箱、发件箱和邮箱设置 | 邮箱会话 Token（Address JWT）或邮箱密码 |
| `/user`（或 `/:lang/user`） | 登录用户中心，管理一个用户账号下绑定的多个邮箱 | 用户账号邮箱与密码、Passkey 或已配置的 OAuth2 |
| `/admin`（或 `/:lang/admin`） | 进入管理后台 | `ADMIN_PASSWORDS`，或具有 `ADMIN_USER_ROLE` 的用户账号 |

用户账号的登录邮箱不等于收发邮件的邮箱地址。登录用户中心后，需要从邮箱列表选择“进入邮箱”才能打开对应收件箱；只登录某个邮箱也不会自动登录用户中心。

## 升级流程

首先确认当前的版本，然后访问 [Release 页面](https://github.com/dreamhunter2333/cloudflare_temp_email/releases/) 和 [CHANGELOG 页面](https://github.com/dreamhunter2333/cloudflare_temp_email/blob/main/CHANGELOG.md) 中找到当前的版本

> [!WARNING] 注意
> 需要注意 `Breaking Changes` 是必须进行 `数据库 sql 执行` 或者 `变量配置` 的

然后查看从当前版本往后的所有更改，需要注意 `Breaking Changes` 是必须进行 `数据库 sql 执行` 或者 `变量配置` 的, 其他的功能更新按需配置即可

然后参考下面的文档使用 `CLI` 或者 `UI` 覆盖部署之前的 `worker` 和 `pages` 即可

升级不是修改 Cloudflare 控制台里已经运行的旧代码，而是用新版本产物重新覆盖部署：

- 如果使用 UI 部署，请重新下载最新 release 的 `worker.js` 和 `frontend.zip`，按原部署方式覆盖上传。
- 如果使用 GitHub Actions 部署，请先同步 fork 仓库，再重新运行对应 workflow。
- 如果 changelog 标注了数据库变更，请在 admin 后台的 `快速设置 -> 数据库` 执行升级，或按 D1 文档执行对应 SQL。
- 升级后如果前端仍显示旧错误，请用无痕窗口测试或清理浏览器缓存，避免继续加载旧前端资源。

### CLI 部署

- [命令行更新 d1](/zh/guide/cli/d1)
- [命令行部署 worker](/zh/guide/cli/worker)
- [命令行部署 pages](/zh/guide/cli/pages)

### UI 部署

- [用户界面更新 d1](/zh/guide/ui/d1)
- [用户界面部署 worker](/zh/guide/ui/worker)
- [用户界面部署 pages](/zh/guide/ui/pages)

### Github Actions 部署

- [Github Actions 部署如何配置自动更新](/zh/guide/actions/auto-update)
