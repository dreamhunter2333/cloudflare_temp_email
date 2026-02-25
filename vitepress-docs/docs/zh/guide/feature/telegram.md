# 配置 Telegram Bot

试用地址：[@cf_temp_mail_bot](https://t.me/cf_temp_mail_bot)

::: warning 注意
worker 默认的 `worker.dev` 域名的证书是不被 telegram 支持的，配置 Telegram Bot 请使用自定义域名
:::

> [!NOTE]
> 如果要使用 Telegram Bot, 请先绑定 `KV`
>
> 如果不需要 Telegram Bot, 可跳过此步骤
>
> 如果你想 Telegram 的解析邮件能力更强，参考 [配置 worker 使用 wasm 解析邮件](/zh/guide/feature/mail_parser_wasm_worker)

## Telegram Bot 配置

请先创建一个 Telegram Bot，然后获取 `token`，然后执行下面的命令，将 `token` 添加到 secrets 中

> [!NOTE]
> 如果你觉得麻烦，也可以直接明文放在 `wrangler.toml` 中 `[vars]` 下面，但是不推荐这样做

如果你是通过 UI 部署的，可以在 Cloudflare 的 UI 界面中添加到 `Variables and Secrets` 下面

```bash
# 切换到 worker 目录
cd worker
pnpm wrangler secret put TELEGRAM_BOT_TOKEN
```

## Bot

- 可设置白名单用户
- 点击`初始化`即可完成配置。
- 点击`查看状态`，可以查看当前配置的状态。

![telegram](/feature/telegram.png)

## 语言切换功能

> [!NOTE]
> 此功能从 v1.2.0 版本开始支持

Telegram Bot 支持中英文切换，用户可以通过 `/lang` 命令设置语言偏好。

### 启用语言切换

需要在 worker 变量中配置 `TG_ALLOW_USER_LANG = true` 才能启用此功能。

### 使用方法

- `/lang zh` - 切换为中文
- `/lang en` - 切换为英文
- `/lang` - 查看当前语言设置

语言偏好会保存到 KV 中，每个用户可以独立设置。

## Mini App

可以通过命令行部署，或者 UI 界面部署

### UI 部署

其他步骤参考 [UI 部署](/zh/guide/cli/pages) 中的 `前后端分离部署`

> [!NOTE]
> 从这里下载 zip, [telegram-frontend.zip](https://github.com/dreamhunter2333/cloudflare_temp_email/releases/latest/download/telegram-frontend.zip)
>
> 修改压缩包里面的 index-xxx.js 文件 ，xx 是随机的字符串
>
> 搜索 `https://temp-email-api.xxx.xxx` ，替换成你worker 的域名，然后部署新的zip文件

### 命令行部署

```bash
cd frontend
pnpm install
cp .env.example .env.prod
# 修改 .env.prod 文件，设置 VITE_IS_TELEGRAM=true
# --project-name 可以单独为 mini app 创建一个 pages, 你也可以公用一个 pages，但是可能遇到 js 加载不了的问题
pnpm run deploy:telegram --project-name=<你的项目名称>
```

> [!WARNING]
> Windows 用户请注意：`npm scripts` 中的 `VITE_IS_TELEGRAM=true` 内联环境变量写法在 Windows 上不生效。
> 请在 `.env.prod` 文件中手动设置 `VITE_IS_TELEGRAM=true`，然后使用普通的 build 命令代替：
> ```bash
> pnpm run build
> ```

- 部署完成后，请在 admin 后台的 `设置` -> `电报小程序` 页面 `电报小程序 URL` 中填写网页 URL。
- 请在 `@BotFather` 处执行 `/setmenubutton`，然后输入你的网页地址，设置左下角的 `Open App` 按钮。
- 请在 `@BotFather` 处执行 `/newapp` 新建 app 来注册 mini app。
