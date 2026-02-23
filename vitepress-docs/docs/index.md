---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "临时邮箱文档"
  tagline: "搭建 CloudFlare 免费收发 临时域名邮箱"
  actions:
    - theme: brand
      text: 立即试用
      link: https://mail.awsl.uk/
    - theme: alt
      text: 命令行部署
      link: /zh/guide/quick-start
    - theme: alt
      text: 通过用户界面部署
      link: /zh/guide/quick-start
    - theme: alt
      text: 通过 Github Actions 部署
      link: /zh/guide/quick-start

features:
  - title: 仅需域名即可私有部署, 免费托管在 CloudFlare，无需服务器
    details: 支持 password 登录邮箱, 用户注册，使用访问密码可作为私人站点，支持附件功能。
  - title:  使用 rust wasm 解析邮件
    details: 使用 rust wasm 解析邮件，支持邮件各种RFC标准，支持附件, 速度极快
  - title:  支持 Telegram Bot 和 Webhook
    details: 邮件可转发到 Telegram 或者 webhook, Telegram Bot 支持绑定邮箱，查看邮件, Telegram 小程序
  - title: 支持发送邮件(UI/API/SMTP)
    details: 支持通过域名邮箱发送 txt 或者 html 邮件，支持 DKIM 签名, UI/API/SMTP 发送邮件
---
