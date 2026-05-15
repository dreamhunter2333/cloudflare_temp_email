<!-- markdownlint-disable-file MD033 MD045 -->
# Cloudflare 临时邮箱 - 免费搭建临时邮件服务

<p align="center">
  <a href="https://temp-mail-docs.awsl.uk" target="_blank">
    <img alt="docs" src="https://img.shields.io/badge/docs-grey?logo=vitepress">
  </a>
  <a href="https://github.com/dreamhunter2333/cloudflare_temp_email/releases/latest" target="_blank">
    <img src="https://img.shields.io/github/v/release/dreamhunter2333/cloudflare_temp_email">
  </a>
  <a href="https://github.com/dreamhunter2333/cloudflare_temp_email/blob/main/LICENSE" target="_blank">
    <img alt="MIT License" src="https://img.shields.io/github/license/dreamhunter2333/cloudflare_temp_email">
  </a>
  <a href="https://github.com/dreamhunter2333/cloudflare_temp_email/graphs/contributors" target="_blank">
   <img alt="GitHub contributors" src="https://img.shields.io/github/contributors/dreamhunter2333/cloudflare_temp_email">
  </a>
  <a href="">
    <img alt="GitHub top language" src="https://img.shields.io/github/languages/top/dreamhunter2333/cloudflare_temp_email">
  </a>
  <a href="">
    <img src="https://img.shields.io/github/last-commit/dreamhunter2333/cloudflare_temp_email">
  </a>
</p>

<p align="center">
  <a href="https://hellogithub.com/repository/2ccc64bb1ba346b480625f584aa19eb1" target="_blank">
    <img src="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=2ccc64bb1ba346b480625f584aa19eb1&claim_uid=FxNypXK7UQ9OECT" alt="Featured｜HelloGitHub" height="30"/>
  </a>
</p>

<p align="center">
  <a href="README.md">中文文档</a> |
  <a href="README_EN.md">English Document</a>
</p>

> 本项目仅供学习和个人用途，请勿将其用于任何违法行为，否则后果自负。

**一个功能完整的临时邮箱服务！**

- **完全免费** - 基于 Cloudflare 免费服务构建，零成本运行
- **高性能** - Rust WASM 邮件解析，响应速度极快
- **现代化界面** - 响应式设计，支持多语言，操作简便
- **地址密码** - 支持为邮箱地址设置独立密码，增强安全性
- **Agent 友好** - 内置邮箱 [`skill`](skills/cf-temp-mail-agent-mail/SKILL.md)，方便 AI agent 使用邮箱
- **移动端管理** - 社区客户端 [CloudMail](https://github.com/Lur1N77777/CloudMail)，支持 Android 管理后台和邮箱管理

## 部署文档 - 快速开始

[部署文档](https://temp-mail-docs.awsl.uk) | [Github Action 部署文档](https://temp-mail-docs.awsl.uk/zh/guide/actions/github-action.html)

<a href="https://temp-mail-docs.awsl.uk/zh/guide/actions/github-action.html">
  <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare Workers" height="32">
</a>

## 更新日志

查看 [CHANGELOG](CHANGELOG.md) 了解最新更新内容。

## 在线体验

立即体验 → [https://mail.awsl.uk/](https://mail.awsl.uk/)

<details>
<summary>服务状态监控（点击收缩/展开）</summary>

|                                            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Backend](https://temp-email-api.awsl.uk/) | [![Deploy Backend Production](https://github.com/dreamhunter2333/cloudflare_temp_email/actions/workflows/backend_deploy.yaml/badge.svg)](https://github.com/dreamhunter2333/cloudflare_temp_email/actions/workflows/backend_deploy.yaml) ![](https://uptime.aks.awsl.icu/api/badge/10/status) ![](https://uptime.aks.awsl.icu/api/badge/10/uptime) ![](https://uptime.aks.awsl.icu/api/badge/10/ping) ![](https://uptime.aks.awsl.icu/api/badge/10/avg-response) ![](https://uptime.aks.awsl.icu/api/badge/10/cert-exp) ![](https://uptime.aks.awsl.icu/api/badge/10/response) |
| [Frontend](https://mail.awsl.uk/)          | [![Deploy Frontend](https://github.com/dreamhunter2333/cloudflare_temp_email/actions/workflows/frontend_deploy.yaml/badge.svg)](https://github.com/dreamhunter2333/cloudflare_temp_email/actions/workflows/frontend_deploy.yaml) ![](https://uptime.aks.awsl.icu/api/badge/12/status) ![](https://uptime.aks.awsl.icu/api/badge/12/uptime) ![](https://uptime.aks.awsl.icu/api/badge/12/ping) ![](https://uptime.aks.awsl.icu/api/badge/12/avg-response) ![](https://uptime.aks.awsl.icu/api/badge/12/cert-exp) ![](https://uptime.aks.awsl.icu/api/badge/12/response)         |

</details>

<details>
<summary>Star History（点击收缩/展开）</summary>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=dreamhunter2333/cloudflare_temp_email&type=Date&theme=dark" />
  <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=dreamhunter2333/cloudflare_temp_email&type=Date" />
  <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=dreamhunter2333/cloudflare_temp_email&type=Date" />
</picture>

</details>

<details open>
<summary>目录（点击收缩/展开）</summary>

- [Cloudflare 临时邮箱 - 免费搭建临时邮件服务](#cloudflare-临时邮箱---免费搭建临时邮件服务)
  - [部署文档 - 快速开始](#部署文档---快速开始)
  - [更新日志](#更新日志)
  - [在线体验](#在线体验)
  - [核心功能](#核心功能)
    - [邮件处理](#邮件处理)
    - [用户管理](#用户管理)
    - [管理功能](#管理功能)
    - [多语言与界面](#多语言与界面)
    - [集成与扩展](#集成与扩展)
  - [技术架构](#技术架构)
    - [系统架构](#系统架构)
    - [技术栈](#技术栈)
    - [主要组件](#主要组件)
  - [加入社区](#加入社区)

</details>

## 核心功能

<details open>
<summary>核心功能详情（点击收缩/展开）</summary>

### 邮件处理

- [x] 使用 `rust wasm` 解析邮件，解析速度快，几乎所有邮件都能解析，node 的解析模块解析邮件失败的邮件，rust wasm 也能解析成功
- [x] **AI 邮件识别** - 使用 Cloudflare Workers AI 自动提取邮件中的验证码、认证链接、服务链接等重要信息
- [x] 支持为指定基础域名创建随机二级域名邮箱地址，更适合收件隔离场景
- [x] 支持发送邮件，支持 `DKIM` 验证
- [x] 支持 `SMTP` 和 `Resend` 等多种发送方式 
- [x] 增加查看 `附件` 功能，支持附件图片显示
- [x] 支持 S3 附件存储和删除功能
- [x] 垃圾邮件检测和黑白名单配置
- [x] 邮件转发功能，支持全局转发地址

### 用户管理

- [x] 使用 `凭证` 重新登录之前的邮箱
- [x] 添加完整的用户注册登录功能，可绑定邮箱地址，绑定后可自动获取邮箱JWT凭证切换不同邮箱
- [x] 支持 `OAuth2` 第三方登录（Github、Authentik 等）
- [x] 支持 `Passkey` 无密码登录
- [x] 用户角色管理，支持多角色域名和前缀配置
- [x] 用户收件箱查看，支持地址和关键词过滤

### 管理功能

- [x] 完整的 admin 控制台
- [x] `admin` 后台创建无前缀邮箱
- [x] admin 用户管理页面，增加用户地址查看功能
- [x] 定时清理功能，支持多种清理策略
- [x] 获取自定义名字的邮箱，`admin` 可配置黑名单
- [x] 增加访问密码，可作为私人站点

### 多语言与界面

- [x] 前后台均支持多语言
- [x] 现代化 UI 设计，支持响应式布局
- [x] 支持 Google Ads 集成
- [x] 使用 shadow DOM 防止样式污染
- [x] 支持 URL JWT 参数自动登录

### 集成与扩展

- [x] 完整的 `Telegram Bot` 支持，以及 `Telegram` 推送，Telegram Bot 小程序
- [x] 添加 `SMTP proxy server`，支持 `SMTP` 发送邮件，`IMAP` 查看邮件
- [x] Webhook 支持，消息推送集成
- [x] 支持 `CF Turnstile` 人机验证
- [x] 限流配置，防止滥用
- [x] **Agent 友好**：内置 [`cf-temp-mail-agent-mail`](skills/cf-temp-mail-agent-mail/SKILL.md) skill，AI agent 可直接消费邮箱，详见 [文档](vitepress-docs/docs/zh/guide/feature/agent-email.md)
- [x] 社区移动端管理客户端：[CloudMail](https://github.com/Lur1N77777/CloudMail) 基于 Expo / React Native，面向本项目兼容 API，提供 Android 管理员后台、地址管理、收件/发件/未知邮件、验证码快捷复制、OLED 黑主题和本地分组。

</details>

## 技术架构

<details>
<summary>技术架构详情（点击收缩/展开）</summary>

### 系统架构

- **数据库**: Cloudflare D1 作为主数据库
- **前端部署**: 使用 Cloudflare Pages 部署前端
- **后端部署**: 使用 Cloudflare Workers 部署后端
- **邮件转发**: 使用 Cloudflare Email Routing

### 技术栈

- **前端**: Vue 3 + Vite + TypeScript
- **后端**: TypeScript + Cloudflare Workers
- **邮件解析**: Rust WASM (mail-parser-wasm)
- **数据库**: Cloudflare D1 (SQLite)
- **存储**: Cloudflare KV + R2 (可选 S3)
- **代理服务**: Python SMTP/IMAP Proxy Server

### 主要组件

- **Worker**: 核心后端服务
- **Frontend**: Vue 3 用户界面
- **Mail Parser WASM**: Rust 邮件解析模块
- **SMTP Proxy Server**: Python 邮件代理服务
- **Pages Functions**: Cloudflare Pages 中间件
- **Documentation**: VitePress 文档站点

</details>

### 提醒

- 在Resend添加域名记录时，如果您域名解析服务商正在托管您的3级域名a.b.com，请删除Resend生成的默认name中二级域名前缀b，否则将会添加a.b.b.com，导致验证失败。添加记录后，可通过
```bash
nslookup -qt="mx" a.b.com 1.1.1.1
```
进行验证。 

## 加入社区

- [Telegram](https://t.me/cloudflare_temp_email)
