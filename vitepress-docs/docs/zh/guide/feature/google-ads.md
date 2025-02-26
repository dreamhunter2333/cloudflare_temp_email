# 给网页增加 Google Ads

## 命令行部署

修改 `.env.prod` 文件

增加下列两个变量, 具体的值请参考 [Google AdSense](https://www.google.com/adsense/start/) 的说明

```txt
VITE_GOOGLE_AD_CLIENT=ca-pub-123456
VITE_GOOGLE_AD_SLOT=123456
```

然后执行下列命令, 重新部署 pages 即可.

```bash
pnpm build --emptyOutDir
# 第一次部署会提示创建项目, production 分支请填写 production
pnpm run deploy
```

## GitHub Action 部署

修改 `FRONTEND_ENV`, 增加下列两个变量, 具体的值请参考 [Google AdSense](https://www.google.com/adsense/start/) 的说明, 重新部署 pages 即可.

```txt
VITE_GOOGLE_AD_CLIENT=ca-pub-123456
VITE_GOOGLE_AD_SLOT=123456
```
