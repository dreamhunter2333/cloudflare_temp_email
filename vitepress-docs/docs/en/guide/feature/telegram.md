# Configure Telegram Bot

Try it here: [@cf_temp_mail_bot](https://t.me/cf_temp_mail_bot)

::: warning Note
The default `worker.dev` domain certificate for worker is not supported by Telegram. Please use a custom domain when configuring Telegram Bot.
:::

> [!NOTE]
> If you want to use Telegram Bot, please bind `KV` first
>
> If you don't need Telegram Bot, you can skip this step
>
> If you want Telegram to have stronger email parsing capabilities, refer to [Configure worker to use wasm for email parsing](/en/guide/feature/mail_parser_wasm_worker)

## Telegram Bot Configuration

Please first create a Telegram Bot, obtain the `token`, then execute the following command to add the `token` to secrets

> [!NOTE]
> If you find it troublesome, you can also put it in plain text under `[vars]` in `wrangler.toml`, but this is not recommended

If you deployed via UI, you can add it under `Variables and Secrets` in the Cloudflare UI interface

```bash
# Switch to worker directory
cd worker
pnpm wrangler secret put TELEGRAM_BOT_TOKEN
```

## Bot

- Can set whitelist users
- Click `Initialize` to complete the configuration.
- Click `View Status` to check the current configuration status.

![telegram](/feature/telegram.png)

## Language Switching

> [!NOTE]
> This feature is available since v1.2.0

Telegram Bot supports Chinese and English switching. Users can set their language preference via the `/lang` command.

### Enable Language Switching

You need to configure `TG_ALLOW_USER_LANG = true` in worker variables to enable this feature.

### Usage

- `/lang zh` - Switch to Chinese
- `/lang en` - Switch to English
- `/lang` - View current language setting

Language preferences are saved to KV, and each user can set their preference independently.

## Mini App

Can be deployed via command line or UI interface

### UI Deployment

For other steps, refer to `Frontend and Backend Separation Deployment` in [UI Deployment](/en/guide/cli/pages)

> [!NOTE]
> Download the zip from here, [telegram-frontend.zip](https://github.com/dreamhunter2333/cloudflare_temp_email/releases/latest/download/telegram-frontend.zip)
>
> Modify the index-xxx.js file in the zip, where xx is a random string
>
> Search for `https://temp-email-api.xxx.xxx`, replace it with your worker domain, then deploy the new zip file

### Command Line Deployment

```bash
cd frontend
pnpm install
cp .env.example .env.prod
# Edit .env.prod and set VITE_IS_TELEGRAM=true
# --project-name can create a separate pages for mini app, you can also share one pages, but may encounter js loading issues
pnpm run deploy:telegram --project-name=<your_project_name>
```

> [!WARNING]
> Windows users: The inline `VITE_IS_TELEGRAM=true` environment variable in npm scripts does not work on Windows.
> Please set `VITE_IS_TELEGRAM=true` in your `.env.prod` file manually, then use the regular build command instead:
> ```bash
> pnpm run build
> ```

- After deployment, please fill in the web URL in the `Settings` -> `Telegram Mini App` page `Telegram Mini App URL` in the admin backend.
- Please execute `/setmenubutton` in `@BotFather`, then enter your web address to set the `Open App` button in the lower left corner.
- Please execute `/newapp` in `@BotFather` to create a new app and register the mini app.
