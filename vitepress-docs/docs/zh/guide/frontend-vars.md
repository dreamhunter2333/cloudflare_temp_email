# 前端变量说明

前端配置会公开在浏览器中，请勿填写密码、API 密钥等敏感信息。

## 配置方式

### ENV

通过 CLI 部署时，将变量写入 `frontend/.env.prod`；Worker Assets 或 Page Functions 部署写入 `frontend/.env.pages.local`。通过 GitHub Actions 的 `Deploy Frontend` workflow 部署时，将相同内容写入 Repository Secret `FRONTEND_ENV`；`Deploy Frontend with page function` workflow 不读取该 Secret。

```ini
VITE_API_BASE=https://temp-email-api.example.com
VITE_DEFAULT_LANG=en
```

完整步骤请查看 [CLI 部署](/zh/guide/cli/pages) 和 [GitHub Actions 部署](/zh/guide/actions/github-action)。

### index.html

使用构建好的前端 ZIP 时，可以编辑 `index.html` 中的 `app-config`。字段名不带 `VITE_` 前缀：

```html
<script id="app-config" type="application/json">
{
  "API_BASE": "https://temp-email-api.example.com",
  "DEFAULT_LANG": "en"
}
</script>
```

`app-config` 中填写的字段会覆盖 ENV 构建值；未填写字段或不存在 `app-config` 标签时继续使用 ENV 构建值。完整步骤请查看 [手动 ZIP 部署](/zh/guide/ui/pages)。

## 变量列表

没有所有部署方式都必须配置的前端变量。`VITE_API_BASE` 仅在前后端分离、前端需要直接请求 Worker 域名时配置；Worker Assets 或 Page Functions 等同域部署应留空。

| ENV 变量 | `app-config` 字段 | 是否必须 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `VITE_API_BASE` | `API_BASE` | 视部署方式 | 文本 | 空 | 以 `https://` 开头的后端 API 根地址，不要带结尾 `/`；空值表示使用同域 API |
| `VITE_DEFAULT_LANG` | `DEFAULT_LANG` | 否 | 文本 | `zh` | 默认语言，支持 `zh`、`en`、`es`、`pt-BR`、`ja`、`de` |
| `VITE_CF_WEB_ANALY_TOKEN` | `CF_WEB_ANALY_TOKEN` | 否 | 文本 | 空 | Cloudflare Web Analytics Token |
| `VITE_IS_TELEGRAM` | `IS_TELEGRAM` | 否 | 布尔值 | `false` | 是否启用 Telegram Mini App，详见 [Telegram 配置](/zh/guide/feature/telegram) |
| `VITE_GOOGLE_AD_CLIENT` | `GOOGLE_AD_CLIENT` | 否 | 文本 | 空 | Google AdSense Client ID，详见 [Google Ads 配置](/zh/guide/feature/google-ads) |
| `VITE_GOOGLE_AD_SLOT` | `GOOGLE_AD_SLOT` | 否 | 文本 | 空 | Google AdSense Slot ID，详见 [Google Ads 配置](/zh/guide/feature/google-ads) |
