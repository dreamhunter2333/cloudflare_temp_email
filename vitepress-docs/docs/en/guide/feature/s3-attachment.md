# Configure S3 Attachments

## Configuration

> [!NOTE]
> If you don't need S3 attachments, you can skip this step

Create an R2 bucket in Cloudflare. You can also use other S3 services (please submit an issue if you encounter bugs).

Reference: [Configure Cloudflare R2 cors](https://developers.cloudflare.com/r2/buckets/cors/#add-cors-policies-from-the-dashboard)

Reference: [Cloudflare R2 s3 token](https://developers.cloudflare.com/r2/api/s3/tokens/) to create a token, obtain `ENDPOINT`, `Access Key ID` and `Secret Access Key`, then execute the following commands to add them to secrets

> [!NOTE]
> You can also add `secrets` in the Cloudflare worker UI interface

```bash
cd worker
pnpm wrangler secret put S3_ENDPOINT
pnpm wrangler secret put S3_ACCESS_KEY_ID
pnpm wrangler secret put S3_SECRET_ACCESS_KEY
# Note: Replace bucket with your bucket name
pnpm wrangler secret put S3_BUCKET
```

## Usage

Save attachment

![S3 save](/feature/s3-save.png)

Download attachment

![S3 download](/public/feature/s3-download.png)
