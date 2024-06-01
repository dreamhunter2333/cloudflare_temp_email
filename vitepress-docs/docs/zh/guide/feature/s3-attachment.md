# 配置 S3 附件

## 配置

> [!NOTE]
> 如果不需要 S3 附件, 可跳过此步骤

在 Cloudflare 创建一个 R2 bucket, 你也可以使用其他的 S3 服务(如有 bug 请提 issue)

参考: [配置 Cloudflare R2 的 cors](https://developers.cloudflare.com/r2/buckets/cors/#add-cors-policies-from-the-dashboard)

参考 [Cloudflare R2  s3 toke](https://developers.cloudflare.com/r2/api/s3/tokens/) 创建 token, 拿到 `ENDPOINT`, `Access Key ID` 和 `Secret Access Key`，然后执行下面的命令添加到 secrets 中

> [!NOTE]
> 你也可以在 Cloudflare worker 的 UI 界面中添加 `secrets`

```bash
cd worker
pnpm wrangler secret put S3_ENDPOINT
pnpm wrangler secret put S3_ACCESS_KEY_ID
pnpm wrangler secret put S3_SECRET_ACCESS_KEY
# 请注意这里的 bucket 是你的 bucket 名称
pnpm wrangler secret put S3_BUCKET
```

## 使用

保存附件

![S3 save](/feature/s3-save.png)

下载附件

![S3 download](/public/feature/s3-download.png)
