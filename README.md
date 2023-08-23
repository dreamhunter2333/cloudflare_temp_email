# cloudflare_temp_email

This is a temporary email service that uses Cloudflare Workers to create a temporary email address and view the received email in web browser.

[Live Demo](https://temp-email.dreamhunter2333.xyz/)

## Deploy

[Install/Update Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

## DB - Cloudflare D1

```bash
# create a database, and copy the output to wrangler.toml in the next step
wrangler d1 create dev
wrangler d1 execute dev --file=db/schema.sql
```

![d1](readme_assets/d1.png)

### Backend - Cloudflare workers

```bash
cd worker
npm install
# copy wrangler.toml.template to wrangler.toml and modify it
cp worker/wrangler.toml.template worker/wrangler.toml
# deploy
wrangler deploy
```

you can find and test the api url in the  workers dashboard

![worker](readme_assets/worker.png)

config email forward

![email](readme_assets/email.png)

### Frontend - Cloudflare pages

```bash
cd frontend
pnpm install
# add .env.local and modify VITE_API_BASE to your api url
cp .env.example .env.local
pnpm build --emptyOutDir
cd ..
wrangler pages deploy dist --branch production
```

![pages](readme_assets/pages.png)
