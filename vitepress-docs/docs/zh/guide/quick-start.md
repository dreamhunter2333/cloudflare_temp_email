# 快速开始

## 开始之前

需要 `良好的网络环境` 和 `cloudflare 账号`， 打开 [cloudflare控制台](https://dash.cloudflare.com/)

请选择下面三种方式之一进行部署

- [通过命令行部署](/zh/guide/cli/pre-requisite)
- [通过用户界面部署](/zh/guide/ui/d1)
- [通过Github Actions 部署](/zh/guide/actions/pre-requisite)

### 也可以参考网友提供的详细的小白教程

- [【教程】小白也能看懂的自建Cloudflare临时邮箱教程（域名邮箱）](https://linux.do/t/topic/316819/1)

## 升级流程

首先确认当前的版本，然后访问 [Release 页面](https://github.com/dreamhunter2333/cloudflare_temp_email/releases/) 和 [CHANGELOG 页面](https://github.com/dreamhunter2333/cloudflare_temp_email/blob/main/CHANGELOG.md) 中找到当前的版本

> [!WARNING] 注意
> 需要注意 `Breaking Changes` 是必须进行 `数据库 sql 执行` 或者 `变量配置` 的

然后查看从当前版本往后的所有更改，需要注意 `Breaking Changes` 是必须进行 `数据库 sql 执行` 或者 `变量配置` 的, 其他的功能更新按需配置即可

然后参考下面的文档使用 `CLI` 或者 `UI` 覆盖部署之前的 `worker` 和 `pages` 即可

### CLI 部署

- [命令行更新 d1](/zh/guide/cli/d1)
- [命令行部署 worker](/zh/guide/cli/worker)
- [命令行部署 pages](/zh/guide/cli/worker)

### UI 部署

- [用户界面更新 d1](/zh/guide/ui/d1)
- [用户界面部署 worker](/zh/guide/ui/worker)
- [用户界面部署 pages](/zh/guide/ui/pages)

### Github Actions 部署

- [Github Actions 部署如何配置自动更新](/zh/guide/actions/auto-update)
