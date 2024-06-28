# cloudflare temp email

This is a temporary email service that uses Cloudflare Workers to create a temporary email address and view the received email in web browser.

## Features

- [x] Cloudflare D1 as a database
- [x] Deploy the front end with Cloudflare Pages
- [x] Deploy the backend with Cloudflare Workers
- [x] Email forwarding using Cloudflare Email Routing
- [x] Use password to login to the previous mailbox again.
- [x] Get Custom Name Email
- [x] Support multiple languages
- [x] Add access authorization, which can be used as a private site
- [x] Add auto reply feature
- [x] Add attachment viewing function
- [x] use rust wasm to parse email
- [x] support send email
- [x] support DKIM

## Deploy

[Install/Update Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

```bash
npm install wrangler -g
git clone https://github.com/dreamhunter2333/cloudflare_temp_email.git
# Switch to the latest tag or the branch you want to deploy. You can also use the main branch directly.
# git checkout $(git describe --tags $(git rev-list --tags --max-count=1))
```

## DB - Cloudflare D1

```bash
# create a database, and copy the output to wrangler.toml in the next step
wrangler d1 create dev
wrangler d1 execute dev --file=db/schema.sql
# schema update, if you have initialized the database before this date, you can execute this command to update
# wrangler d1 execute dev --file=db/2024-01-13-patch.sql
# wrangler d1 execute dev --file=db/2024-04-03-patch.sql
# create a namespace, and copy the output to wrangler.toml in the next step
wrangler kv:namespace create DEV
```

![d1](/readme_assets/d1.png)

### Backend - Cloudflare workers

The first deployment will prompt you to create a project. Please fill in `production` for the `production` branch.

```bash
cd worker
pnpm install
cp wrangler.toml.template wrangler.toml
# deploy
pnpm run deploy
```

`wrangler.toml`

```toml
name = "cloudflare_temp_email"
main = "src/worker.ts"
compatibility_date = "2023-08-14"
node_compat = true

# enable cron if you want set auto clean up
# [triggers]
# crons = [ "0 0 * * *" ]

# send mail by cf mail
# send_email = [
#    { name = "SEND_MAIL" },
# ]

[vars]
# TITLE = "Custom Title" # The title of the site
PREFIX = "tmp" # The mailbox name prefix to be processed
# (min, max) length of the adderss, if not set, the default is (1, 30)
# MIN_ADDRESS_LEN = 1
# MAX_ADDRESS_LEN = 30
# If you want your site to be private, uncomment below and change your password
# PASSWORDS = ["123", "456"]
# admin console password, if not configured, access to the console is not allowed
# ADMIN_PASSWORDS = ["123", "456"]
# admin contact information. If not configured, it will not be displayed. Any string can be configured.
# ADMIN_CONTACT = "xx@xx.xxx"
DOMAINS = ["xxx.xxx1" , "xxx.xxx2"] # your domain name
# For chinese domain name, you can use DOMAIN_LABELS to show chinese domain name
# DOMAIN_LABELS = ["中文.xxx", "xxx.xxx2"]
JWT_SECRET = "xxx" # Key used to generate jwt
BLACK_LIST = "" # Blacklist, used to filter senders, comma separated
# Allow users to create email addresses
ENABLE_USER_CREATE_EMAIL = true
# Allow users to delete messages
ENABLE_USER_DELETE_EMAIL = true
# Allow automatic replies to emails
ENABLE_AUTO_REPLY = false
# Allow webhook
# ENABLE_WEBHOOK = true
# Footer text
# COPYRIGHT = "Dream Hunter"
# default send balance, if not set, it will be 0
# DEFAULT_SEND_BALANCE = 1
# Turnstile verification configuration
# CF_TURNSTILE_SITE_KEY = ""
# CF_TURNSTILE_SECRET_KEY = ""
# dkim config
# DKIM_SELECTOR = "mailchannels" # Refer to the DKIM section mailchannels._domainkey for mailchannels
# DKIM_PRIVATE_KEY = "" # Refer to the contents of priv_key.txt in the DKIM section
# telegram bot
# TG_MAX_ACCOUNTS = 5
# global forward address list, if set, all emails will be forwarded to these addresses
# FORWARD_ADDRESS_LIST = ["xxx@xxx.com"]

[[d1_databases]]
binding = "DB"
database_name = "xxx" # D1 database name
database_id = "xxx" # D1 database ID

# kv config for send email verification code
# [[kv_namespaces]]
# binding = "KV"
# id = "xxxx"

# Create a new address current limiting configuration
# [[unsafe.bindings]]
# name = "RATE_LIMITER"
# type = "ratelimit"
# namespace_id = "1001"
# # 10 requests per minute
# simple = { limit = 10, period = 60 }
```

you can find and test the worker's url in the  workers dashboard

![worker](/readme_assets/worker.png)

## Cloudflare Email Routing

Before you can bind an email address to your Worker, you need to enable Email Routing and have at least one verified email address.

enable email route and config email forward catch-all to the worker

![email](/readme_assets/email.png)

### Frontend - Cloudflare pages

The first deployment will prompt you to create a project. Please fill in `production` for the `production` branch.

```bash
cd frontend
pnpm install
# add .env.local and modify VITE_API_BASE to your worker's url
# VITE_API_BASE=https://xxx.xxx.workers.dev - don't put / in the end
cp .env.example .env.local
pnpm build --emptyOutDir
pnpm run deploy
```

![pages](/readme_assets/pages.png)

## Configure sending emails

Find the `SPF` record of `TXT` in the domain name `DNS` record, and add `include:relay.mailchannels.net`

```bash
v=spf1 include:_spf.mx.cloudflare.net include:relay.mailchannels.net ~all
```

Create a new `_mailchannels` record, the type is `TXT`, the content is `v=mc1 cfid=your worker domain name`

- The worker domain name here is the domain name of the back-end api. For example, if I deploy it at `https://temp-email-api.awsl.uk/`, fill in `v=mc1 cfid=awsl.uk`
- If your domain name is `https://temp-email-api.xxx.workers.dev`, fill in `v=mc1 cfid=xxx.workers.dev`

## Configure DKIM

Ref: [Adding-a-DKIM-Signature](https://support.mailchannels.com/hc/en-us/articles/7122849237389-Adding-a-DKIM-Signature)

Creating a DKIM private and public key:
Private key as PEM file and base64 encoded txt file:

```bash
openssl genrsa 2048 | tee priv_key.pem | openssl rsa -outform der | openssl base64 -A > priv_key.txt
```

Public key as DNS record:

```bash
echo -n "v=DKIM1;p=" > pub_key_record.txt && \
openssl rsa -in priv_key.pem -pubout -outform der | openssl base64 -A >> pub_key_record.txt
```

Add `TXT` record in `Cloudflare` all your mail domain `DNS`

- `_dmarc`: `v=DMARC1; p=none; adkim=r; aspf=r;`
- `mailchannels._domainkey`: `v=DKIM1; p=<content of the file pub_key_record.txt>`
