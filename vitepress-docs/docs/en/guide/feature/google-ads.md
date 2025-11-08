# Adding Google Ads to Your Website

## Command Line Deployment

Modify the `.env.prod` file

Add the following two variables, refer to [Google AdSense](https://www.google.com/adsense/start/) for specific values

```txt
VITE_GOOGLE_AD_CLIENT=ca-pub-123456
VITE_GOOGLE_AD_SLOT=123456
```

Then execute the following commands to redeploy pages.

```bash
pnpm build --emptyOutDir
# For first deployment, you'll be prompted to create a project, fill in production for the production branch
pnpm run deploy
```

## GitHub Action Deployment

Modify `FRONTEND_ENV`, add the following two variables, refer to [Google AdSense](https://www.google.com/adsense/start/) for specific values, then redeploy pages.

```txt
VITE_GOOGLE_AD_CLIENT=ca-pub-123456
VITE_GOOGLE_AD_SLOT=123456
```
