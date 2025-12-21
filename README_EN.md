<!-- markdownlint-disable-file MD033 MD045 -->
# Cloudflare Temp Email - Free Temporary Email Service

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
  <a href="README.md">🇨🇳 中文文档</a> |
  <a href="README_EN.md">🇺🇸 English Document</a>
</p>

> This project is for learning and personal use only. Please do not use it for any illegal activities, or you will be responsible for the consequences.

**🎉 A fully-featured temporary email service!**

- 🆓 **Completely Free** - Built on Cloudflare's free services with zero cost
- ⚡ **High Performance** - Rust WASM email parsing for extremely fast response
- 🎨 **Modern UI** - Responsive design with multi-language support and easy operation
- 🔐 **Address Password** - Support setting individual passwords for email addresses to enhance security (enabled via `ENABLE_ADDRESS_PASSWORD`)

## 📚 Deployment Documentation - Quick Start

[📖 Documentation](https://temp-mail-docs.awsl.uk) | [🚀 Github Action Deployment Guide](https://temp-mail-docs.awsl.uk/en/guide/actions/github-action.html)

<a href="https://temp-mail-docs.awsl.uk/en/guide/actions/github-action.html">
  <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare Workers" height="32">
</a>

## 📝 Changelog

See [CHANGELOG](CHANGELOG.md) for the latest updates.

## 🎯 Live Demo

Try it now → [https://mail.awsl.uk/](https://mail.awsl.uk/)

<details>
<summary>📊 Service Status Monitoring (Click to expand/collapse)</summary>

|                                            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Backend](https://temp-email-api.awsl.uk/) | [![Deploy Backend Production](https://github.com/dreamhunter2333/cloudflare_temp_email/actions/workflows/backend_deploy.yaml/badge.svg)](https://github.com/dreamhunter2333/cloudflare_temp_email/actions/workflows/backend_deploy.yaml) ![](https://uptime.aks.awsl.icu/api/badge/10/status) ![](https://uptime.aks.awsl.icu/api/badge/10/uptime) ![](https://uptime.aks.awsl.icu/api/badge/10/ping) ![](https://uptime.aks.awsl.icu/api/badge/10/avg-response) ![](https://uptime.aks.awsl.icu/api/badge/10/cert-exp) ![](https://uptime.aks.awsl.icu/api/badge/10/response) |
| [Frontend](https://mail.awsl.uk/)          | [![Deploy Frontend](https://github.com/dreamhunter2333/cloudflare_temp_email/actions/workflows/frontend_deploy.yaml/badge.svg)](https://github.com/dreamhunter2333/cloudflare_temp_email/actions/workflows/frontend_deploy.yaml) ![](https://uptime.aks.awsl.icu/api/badge/12/status) ![](https://uptime.aks.awsl.icu/api/badge/12/uptime) ![](https://uptime.aks.awsl.icu/api/badge/12/ping) ![](https://uptime.aks.awsl.icu/api/badge/12/avg-response) ![](https://uptime.aks.awsl.icu/api/badge/12/cert-exp) ![](https://uptime.aks.awsl.icu/api/badge/12/response)         |

</details>

<details>
<summary>⭐ Star History (Click to expand/collapse)</summary>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=dreamhunter2333/cloudflare_temp_email&type=Date&theme=dark" />
  <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=dreamhunter2333/cloudflare_temp_email&type=Date" />
  <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=dreamhunter2333/cloudflare_temp_email&type=Date" />
</picture>

</details>

<details open>
<summary>📖 Table of Contents (Click to expand/collapse)</summary>

- [Cloudflare Temp Email - Free Temporary Email Service](#cloudflare-temp-email---free-temporary-email-service)
  - [📚 Deployment Documentation - Quick Start](#-deployment-documentation---quick-start)
  - [📝 Changelog](#-changelog)
  - [🎯 Live Demo](#-live-demo)
  - [✨ Core Features](#-core-features)
    - [📧 Email Processing](#-email-processing)
    - [👥 User Management](#-user-management)
    - [🔧 Admin Features](#-admin-features)
    - [🌐 Multi-language \& Interface](#-multi-language--interface)
    - [🤖 Integration \& Extensions](#-integration--extensions)
  - [🏗️ Technical Architecture](#️-technical-architecture)
    - [🏛️ System Architecture](#️-system-architecture)
    - [🛠️ Tech Stack](#️-tech-stack)
    - [📦 Main Components](#-main-components)
  - [🌟 Join the Community](#-join-the-community)

</details>

## ✨ Core Features

<details open>
<summary>✨ Core Features Details (Click to expand/collapse)</summary>

### 📧 Email Processing

- [x] Use `rust wasm` to parse emails, with fast parsing speed. Almost all emails can be parsed. Even emails that Node.js parsing modules fail to parse can be successfully parsed by rust wasm
- [x] **AI Email Recognition** - Use Cloudflare Workers AI to automatically extract verification codes, authentication links, service links and other important information from emails
- [x] Support sending emails with `DKIM` verification
- [x] Support multiple sending methods such as `SMTP` and `Resend`
- [x] Add attachment viewing feature with support for displaying attachment images
- [x] Support S3 attachment storage and deletion
- [x] Spam detection and blacklist/whitelist configuration
- [x] Email forwarding feature with global forwarding address support

### 👥 User Management

- [x] Use `credentials` to log in to previously used mailboxes
- [x] Add complete user registration and login functionality. Users can bind email addresses and automatically obtain email JWT credentials to switch between different mailboxes after binding
- [x] Support `OAuth2` third-party login (Github, Authentik, etc.)
- [x] Support `Passkey` passwordless login
- [x] User role management with support for multi-role domain and prefix configuration
- [x] User inbox viewing with address and keyword filtering support

### 🔧 Admin Features

- [x] Complete admin console
- [x] Create mailboxes without prefix in `admin` backend
- [x] Admin user management page with user address viewing feature
- [x] Scheduled cleanup function with support for multiple cleanup strategies
- [x] Get mailboxes with custom names, `admin` can configure blacklist
- [x] Add access password for use as a private site

### 🌐 Multi-language & Interface

- [x] Both frontend and backend support multi-language
- [x] Modern UI design with responsive layout
- [x] Google Ads integration support
- [x] Use shadow DOM to prevent style pollution
- [x] Support URL JWT parameter auto-login

### 🤖 Integration & Extensions

- [x] Complete `Telegram Bot` support, `Telegram` push notifications, and Telegram Bot mini app
- [x] Add `SMTP proxy server` supporting `SMTP` for sending emails and `IMAP` for viewing emails
- [x] Webhook support and message push integration
- [x] Support `CF Turnstile` CAPTCHA verification
- [x] Rate limiting configuration to prevent abuse

</details>

## 🏗️ Technical Architecture

<details>
<summary>🏗️ Technical Architecture Details (Click to expand/collapse)</summary>

### 🏛️ System Architecture

- **Database**: Cloudflare D1 as the main database
- **Frontend Deployment**: Deploy frontend using Cloudflare Pages
- **Backend Deployment**: Deploy backend using Cloudflare Workers
- **Email Routing**: Use Cloudflare Email Routing

### 🛠️ Tech Stack

- **Frontend**: Vue 3 + Vite + TypeScript
- **Backend**: TypeScript + Cloudflare Workers
- **Email Parsing**: Rust WASM (mail-parser-wasm)
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare KV + R2 (optional S3)
- **Proxy Service**: Python SMTP/IMAP Proxy Server

### 📦 Main Components

- **Worker**: Core backend service
- **Frontend**: Vue 3 user interface
- **Mail Parser WASM**: Rust email parsing module
- **SMTP Proxy Server**: Python email proxy service
- **Pages Functions**: Cloudflare Pages middleware
- **Documentation**: VitePress documentation site

</details>

### Important Notes

- When adding domain records in Resend, if your DNS provider is hosting your 3rd level domain a.b.com, please remove the 2nd level domain prefix b from the default name generated by Resend, otherwise it will add a.b.b.com, causing verification to fail. After adding the record, you can verify it using:
```bash
nslookup -qt="mx" a.b.com 1.1.1.1
```

## 🌟 Join the Community

- [Telegram](https://t.me/cloudflare_temp_email)
