# cloudflare temp email

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
```

![d1](/readme_assets/d1.png)

### Backend - Cloudflare workers

The first deployment will prompt you to create a project. Please fill in `production` for the `production` branch.

```bash
cd worker
pnpm install
# copy wrangler.toml.template to wrangler.toml
# and add your d1 config and these config
# PREFIX = "tmp" - the email create will be like tmp<xxxxx>@DOMAIN
# IF YOU WANT TO MAKE YOUR SITE PRIVATE, UNCOMMENT THE FOLLOWING LINES
# PASSWORDS = ["123", "456"]
# For admin panel, if not set will no allow to access the admin panel
# ADMIN_PASSWORDS = ["123", "456"]
# DOMAINS = ["xxx.xxx1" , "xxx.xxx2"] you domain name
# JWT_SECRET = "xxx"
# BLACK_LIST = ""
cp wrangler.toml.template wrangler.toml
# deploy
pnpm run deploy
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
