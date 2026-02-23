---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Temporary Email Docs"
  tagline: "Build Free CloudFlare Temporary Domain Email with Send & Receive"
  actions:
    - theme: brand
      text: Try it now
      link: https://mail.awsl.uk/
    - theme: alt
      text: CLI Deployment
      link: /en/guide/quick-start
    - theme: alt
      text: Deploy via UI
      link: /en/guide/quick-start
    - theme: alt
      text: Deploy via Github Actions
      link: /en/guide/quick-start

features:
  - title: Private deployment with only a domain name, free hosting on CloudFlare, no server required
    details: Support password login for mailboxes, user registration, access password for private sites, attachment support.
  - title: Email parsing using Rust WASM
    details: Parse emails with Rust WASM, support various RFC email standards, support attachments, extremely fast
  - title: Telegram Bot and Webhook support
    details: Forward emails to Telegram or webhook, Telegram Bot supports mailbox binding, view emails, Telegram Mini App
  - title: Send emails (UI/API/SMTP)
    details: Send txt or html emails via domain mailboxes, DKIM signature support, send via UI/API/SMTP
---
