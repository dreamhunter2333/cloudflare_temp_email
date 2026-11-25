# Adding Google Ads to Your Website

Google Ads uses the following two variables. See [Google AdSense](https://www.google.com/adsense/start/) for the values:

```ini
VITE_GOOGLE_AD_CLIENT=ca-pub-123456
VITE_GOOGLE_AD_SLOT=123456
```

Ads are not loaded when either variable is empty. See [Frontend Variables](/en/guide/frontend-vars) for their types and defaults.

## CLI Deployment

Add both variables to `frontend/.env.prod`, then rebuild and deploy:

```bash
pnpm build --emptyOutDir
# For first deployment, you'll be prompted to create a project, fill in production for the production branch
pnpm run deploy
```

See [CLI Frontend Deployment](/en/guide/cli/pages) for the complete steps.

## GitHub Actions Deployment

Add both variables to the existing `FRONTEND_ENV` secret, then run the `Deploy Frontend` workflow again.

See [GitHub Actions Deployment](/en/guide/actions/github-action) for the complete steps.

## Manual ZIP Deployment

Edit `app-config` in the archive's `index.html` and use the field names without the `VITE_` prefix:

```html
<script id="app-config" type="application/json">
{
  "GOOGLE_AD_CLIENT": "ca-pub-123456",
  "GOOGLE_AD_SLOT": "123456"
}
</script>
```

See [Manual ZIP Deployment](/en/guide/ui/pages) for the complete steps.
