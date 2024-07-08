---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Temporary mailbox document"
  tagline: "Build CloudFlare to send and receive free temporary domain name mailboxes"
  actions:
  - theme: brand
    text: Try it now
    link: https://mail.awsl.uk/en
  - theme: alt
    text: command line deployment
    link: /en/cli
features:
  - title: Free hosting on CloudFlare, no server required
    details: Cloudflare D1 database, Cloudflare Pages frontend, Cloudflare Workers backend, Cloudflare Email Routing
  - title: Only domain name required for private deployment
    details: Support password login email, access authorization can be used as a private site, support attachment function
  - title: Use rust wasm to parse emails
    details: Use rust wasm to parse emails, support various RFC standards for emails, support attachments, extremely fast
  - title: Support sending emails
    details: Support sending txt or html emails through domain name mailboxes，Support DKIM signature
---
