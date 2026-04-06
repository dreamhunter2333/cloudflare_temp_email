# Cloudflare Pages Frontend

> [!warning] Notice
> Choose one of the following methods

## Deploy Worker with Frontend Assets

Refer to [Deploy Worker](/en/guide/cli/worker#deploy-worker-with-frontend-optional)

## Separate Frontend and Backend Deployment

> [!warning] Important: SPA Mode
> This project is a Single-Page Application (SPA). If you deploy manually via the Cloudflare dashboard, **you must set "Not Found handling" to `Single-page application (SPA)` in the advanced options**, otherwise refreshing the page or directly accessing sub-paths like `/admin` will return a 404 error.
> When deploying via CLI (`wrangler pages deploy`), this is handled automatically and no extra configuration is needed.

The first deployment will prompt you to create a project. For the `production` branch, enter `production`.

```bash
cd frontend
pnpm install
cp .env.example .env.prod
```

Modify the `.env.prod` file.

Change `VITE_API_BASE` to the `worker` `url` created in the previous step. Do not add `/` at the end.

For example: `VITE_API_BASE=https://xxx.xxx.workers.dev`

```bash
pnpm build --emptyOutDir
# The first deployment will prompt you to create a project, for production branch enter production
pnpm run deploy
```

After deployment, you can see your project in the Cloudflare console. You can configure a custom domain for `pages`.

![pages](/readme_assets/pages.png)

## Forward Backend Requests Through Page Functions

Forwarding requests from page functions to the worker backend can achieve faster response times.

The first deployment will prompt you to create a project. For the `production` branch, enter `production`.

If your worker backend name is not `cloudflare_temp_email`, please modify `pages/wrangler.toml`.

```bash
cd frontend
pnpm install
# If you want to enable Cloudflare Zero Trust, you need to use pnpm build:pages:nopwa to disable caching
pnpm build:pages
cd ../pages
pnpm run deploy
```
