<!-- markdownlint-disable-file MD033 MD045 -->
# Cloudflare Temp Email

<p align="center">
  <a href="README.md">🇨🇳 中文</a> |
  <a href="README_EN.md">🇺🇸 English</a>
</p>

**A fully-featured temporary email service built on Cloudflare's free services.**

> This project is for learning and personal use only.

## 🚀 Quick Start

- [📖 Documentation](https://temp-mail-docs.awsl.uk/en/)
- [🎯 Live Demo](https://mail.awsl.uk/)
- [📝 CHANGELOG](CHANGELOG.md)

<p align="center">
  <a href="https://temp-mail-docs.awsl.uk/en/guide/actions/github-action.html">
    <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare Workers">
  </a>
</p>

## ✨ Key Features

- **� Email Processing**: Rust WASM parser, SMTP/IMAP support, attachments, auto-reply
- **👥 User Management**: OAuth2 login, Passkey authentication, role management
- **🌐 Admin Panel**: Complete admin console, user management, scheduled cleanup
- **🤖 Integrations**: Telegram Bot, webhooks, CAPTCHA, rate limiting
- **� Modern UI**: Multi-language, responsive design, JWT auto-login

## 🏗️ Tech Stack

- **Frontend**: Vue 3 + TypeScript + Vite
- **Backend**: Cloudflare Workers + D1 Database
- **Email**: Cloudflare Email Routing + Rust WASM Parser
- **Storage**: Cloudflare KV + R2 (optional S3)

## 🌟 Community

- [Telegram](https://t.me/cloudflare_temp_email)

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.
