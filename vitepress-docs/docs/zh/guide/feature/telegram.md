# 配置 Telegram Bot

> [!NOTE]
> 如果要使用 Telegram Bot, 请先绑定 `KV`
>
> 如果不需要 Telegram Bot, 可跳过此步骤

## Telegram Bot 配置

请先创建一个 Telegram Bot，然后获取 `token`，然后执行下面的命令，将 `token` 添加到 secrets 中

你也可以在 Cloudflare 的 UI 界面中添加 `secrets`

```bash
pnpm wrangler secret put TELEGRAM_BOT_TOKEN
```

## Bot

- 可设置白名单用户
- 点击`初始化`即可完成配置。
- 点击`查看状态`，可以查看当前配置的状态。

![telegram](/feature/telegram.png)

## Mini App

```bash
cd frontend
pnpm install
cp .env.example .env.prod
# --project-name 可以单独为 mini app 创建一个 pages, 你也可以公用一个 pages，但是可能遇到 js 加载不了的问题
pnpm run deploy:telegram --project-name=<你的项目名称>
```

部署完成后，请在 admin 后台的 `设置` -> `电报小程序` 页面 `电报小程序 URL`。

请在 `@BotFather` 处执行 `/setmenubutton`，然后输入你的网页地址，设置左下角的 `Open App` 按钮。

你也可以在 `@BotFather` 处执行 `/newapp` 新建 app 来获得 mini app 的链接
