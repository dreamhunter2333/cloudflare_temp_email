# 使用 cloudflare 免费服务，搭建临时邮箱

<p align="center">
  <a href="https://hellogithub.com/repository/2ccc64bb1ba346b480625f584aa19eb1" target="_blank">
    <img src="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=2ccc64bb1ba346b480625f584aa19eb1&claim_uid=FxNypXK7UQ9OECT" alt="Featured｜HelloGitHub"/>
  </a>
</p>

<p align="center">
  <a href="https://temp-mail-docs.awsl.uk" target="_blank">
    <img alt="docs" src="https://img.shields.io/badge/docs-grey?style=for-the-badge&logo=vitepress">
  </a>
  <a href="https://github.com/dreamhunter2333/cloudflare_temp_email/releases/latest" target="_blank">
    <img src="https://img.shields.io/github/v/release/dreamhunter2333/cloudflare_temp_email?style=for-the-badge">
  </a>
  <a href="https://github.com/dreamhunter2333/cloudflare_temp_email/blob/main/LICENSE" target="_blank">
    <img alt="MIT License" src="https://img.shields.io/github/license/dreamhunter2333/cloudflare_temp_email?style=for-the-badge">
  </a>
  <a href="https://github.com/dreamhunter2333/cloudflare_temp_email/graphs/contributors" target="_blank">
   <img alt="GitHub contributors" src="https://img.shields.io/github/contributors/dreamhunter2333/cloudflare_temp_email?style=for-the-badge">
  </a>
  <a href="">
    <img alt="GitHub top language" src="https://img.shields.io/github/languages/top/dreamhunter2333/cloudflare_temp_email?style=for-the-badge">
  </a>
  <a href="">
    <img src="https://img.shields.io/github/last-commit/dreamhunter2333/cloudflare_temp_email?style=for-the-badge">
  </a>
</p>

> 本项目仅供学习和个人用途，请勿将其用于任何违法行为，否则后果自负。

## [查看部署文档](https://temp-mail-docs.awsl.uk)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://temp-mail-docs.awsl.uk/zh/guide/actions/github-action.html)

[Github Action 部署文档](https://temp-mail-docs.awsl.uk/zh/guide/actions/github-action.html)

[English Docs](https://temp-mail-docs.awsl.uk/en/)

## [CHANGELOG](CHANGELOG.md)

## [在线演示](https://mail.awsl.uk/)

|                                            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Backend](https://temp-email-api.awsl.uk/) | [![Deploy Backend Production](https://github.com/dreamhunter2333/cloudflare_temp_email/actions/workflows/backend_deploy.yaml/badge.svg)](https://github.com/dreamhunter2333/cloudflare_temp_email/actions/workflows/backend_deploy.yaml) ![](https://uptime.aks.awsl.icu/api/badge/10/status) ![](https://uptime.aks.awsl.icu/api/badge/10/uptime) ![](https://uptime.aks.awsl.icu/api/badge/10/ping) ![](https://uptime.aks.awsl.icu/api/badge/10/avg-response) ![](https://uptime.aks.awsl.icu/api/badge/10/cert-exp) ![](https://uptime.aks.awsl.icu/api/badge/10/response) |
| [Frontend](https://mail.awsl.uk/)          | [![Deploy Frontend](https://github.com/dreamhunter2333/cloudflare_temp_email/actions/workflows/frontend_deploy.yaml/badge.svg)](https://github.com/dreamhunter2333/cloudflare_temp_email/actions/workflows/frontend_deploy.yaml) ![](https://uptime.aks.awsl.icu/api/badge/12/status) ![](https://uptime.aks.awsl.icu/api/badge/12/uptime) ![](https://uptime.aks.awsl.icu/api/badge/12/ping) ![](https://uptime.aks.awsl.icu/api/badge/12/avg-response) ![](https://uptime.aks.awsl.icu/api/badge/12/cert-exp) ![](https://uptime.aks.awsl.icu/api/badge/12/response)         |

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=dreamhunter2333/cloudflare_temp_email&type=Date&theme=dark" />
  <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=dreamhunter2333/cloudflare_temp_email&type=Date" />
  <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=dreamhunter2333/cloudflare_temp_email&type=Date" />
</picture>

- [使用 cloudflare 免费服务，搭建临时邮箱](#使用-cloudflare-免费服务搭建临时邮箱)
  - [查看部署文档](#查看部署文档)
  - [CHANGELOG](#changelog)
  - [在线演示](#在线演示)
  - [功能/TODO](#功能todo)
  - [Reference](#reference)
  - [Join Community](#join-community)

## 功能/TODO

- [x] 使用 `password` 重新登录之前的邮箱
- [x] 获取自定义名字的邮箱，`admin` 可配置黑名单
- [x] 支持多语言
- [x] 增加访问密码，可作为私人站点
- [x] 增加自动回复功能
- [x] 增加查看 `附件` 功能
- [x] 使用 `rust wasm` 解析邮件
- [x] 支持发送邮件
- [x] 支持 `DKIM`
- [x] `admin` 后台创建无前缀邮箱
- [x] 添加 `SMTP proxy server`，支持 `SMTP` 发送邮件, `IMAP` 查看邮件
- [x] 添加完整的用户注册登录功能，可绑定邮箱地址，绑定后可自动获取邮箱JWT凭证切换不同邮箱
- [x] `Telegram Bot` 使用，以及 `Telegram` 推送

## Reference

- Cloudflare D1 作为数据库
- 使用 Cloudflare Pages 部署前端
- 使用 Cloudflare Workers 部署后端
- email 转发使用 Cloudflare Email Routing

## Join Community

- [Discord](https://discord.gg/dQEwTWhA6Q)
- [Telegram](https://t.me/cloudflare_temp_email)
