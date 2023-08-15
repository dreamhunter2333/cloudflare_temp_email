# cloudflare_temp_email

This is a temporary email service that uses Cloudflare Workers to create a temporary email address that forwards to your real email address.

[Live Demo](https://temp-email.dreamhunter2333.xyz/)

## Deploy

## DB - Cloudflare D1

```bash
# create a database, and copy the config to wrangler.toml in the next step
wrangler d1 create dev
wrangler d1 execute dev --file=db/schema.sql
```

### Backend - Cloudflare workers

```bash
cd backend
npm install
# copy wrangler.toml.template to wrangler.toml and modify it
cp worker/wrangler.toml.template worker/wrangler.toml
# deploy
wrangler deploy
```

### Frontend - Cloudflare pages

```bash
cd frontend
pnpm install
# add .env.local and modify it
cp .env.example .env.local
pnpm build --emptyOutDir
cd ..
wrangler pages deploy dist --branch production
```
