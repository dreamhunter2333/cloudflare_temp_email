# 给网页增加 Google Ads

Google Ads 使用以下两个变量，具体值请参考 [Google AdSense](https://www.google.com/adsense/start/)：

```ini
VITE_GOOGLE_AD_CLIENT=ca-pub-123456
VITE_GOOGLE_AD_SLOT=123456
```

任意一个变量为空时都不会加载广告。变量类型和默认值请查看 [前端变量说明](/zh/guide/frontend-vars)。

## CLI 部署

在 `frontend/.env.prod` 中添加上述两个变量，然后重新构建并部署：

```bash
pnpm build --emptyOutDir
# 第一次部署会提示创建项目, production 分支请填写 production
pnpm run deploy
```

完整步骤请查看 [CLI 部署前端](/zh/guide/cli/pages)。

## GitHub Actions 部署

在已有的 `FRONTEND_ENV` Secret 中添加上述两个变量，然后重新运行 `Deploy Frontend` workflow。

完整步骤请查看 [GitHub Actions 部署](/zh/guide/actions/github-action)。

## 手动 ZIP 部署

编辑压缩包中 `index.html` 的 `app-config`，使用不带 `VITE_` 前缀的字段名：

```html
<script id="app-config" type="application/json">
{
  "GOOGLE_AD_CLIENT": "ca-pub-123456",
  "GOOGLE_AD_SLOT": "123456"
}
</script>
```

完整步骤请查看 [手动 ZIP 部署](/zh/guide/ui/pages)。
