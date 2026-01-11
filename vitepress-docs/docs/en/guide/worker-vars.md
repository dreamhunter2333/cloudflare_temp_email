# Worker Variables

> [!NOTE] Note
> For CLI deployment syntax, please refer to `worker/wrangler.toml.template`

## Required Variables

| Variable Name              | Type        | Description                                                            | Example                              |
| -------------------------- | ----------- | ---------------------------------------------------------------------- | ------------------------------------ |
| `DOMAINS`                  | JSON        | All domains for temporary email, supports multiple domains             | `["awsl.uk", "dreamhunter2333.xyz"]` |
| `JWT_SECRET`               | Text/Secret | Secret key for generating JWT, used for login and authentication       | `xxx`                                |
| `ADMIN_PASSWORDS`          | JSON        | Admin console passwords, console access disabled if not configured     | `["123", "456"]`                     |
| `ENABLE_USER_CREATE_EMAIL` | Text/JSON   | Whether to allow users to create mailboxes, disabled if not configured | `true`                               |
| `ENABLE_USER_DELETE_EMAIL` | Text/JSON   | Whether to allow users to delete emails, disabled if not configured    | `true`                               |

## Console Related Variables

| Variable Name                  | Type      | Description                                             | Example          |
| ------------------------------ | --------- | ------------------------------------------------------- | ---------------- |
| `PASSWORDS`                    | JSON      | Website private passwords, required after configuration | `["123", "456"]` |
| `DISABLE_ADMIN_PASSWORD_CHECK` | Text/JSON | Warning: Admin console without password or user check   | `false`          |

## Email Related Variables

| Variable Name                         | Type      | Description                                                                                                                                                                                                       | Example                                   |
| ------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `PREFIX`                              | Text      | Default prefix for new `email address` names, can be left unconfigured if no prefix needed                                                                                                                        | `tmp`                                     |
| `MIN_ADDRESS_LEN`                     | Number    | Minimum length of `email address` name                                                                                                                                                                            | `1`                                       |
| `MAX_ADDRESS_LEN`                     | Number    | Maximum length of `email address` name                                                                                                                                                                            | `30`                                      |
| `DISABLE_CUSTOM_ADDRESS_NAME`         | Text/JSON | Disable custom email address names, if set to true, users cannot enter custom names and they will be auto-generated                                                                                               | `true`                                    |
| `ADDRESS_CHECK_REGEX`                 | Text      | Regular expression for `email address` name, used for validation only                                                                                                                                             | `^(?!.*admin).*`                          |
| `ADDRESS_REGEX`                       | Text      | Regular expression to replace illegal symbols in `email address` name, symbols not in the regex will be replaced. Default is `[^a-z0-9]` if not set. Use with caution as some symbols may prevent email reception | `[^a-z0-9]`                               |
| `DEFAULT_DOMAINS`                     | JSON      | Default domains available to users (not logged in or users without assigned roles)                                                                                                                                | `["awsl.uk", "dreamhunter2333.xyz"]`      |
| `CREATE_ADDRESS_DEFAULT_DOMAIN_FIRST` | Text/JSON | Whether to prioritize default domain when creating new addresses, if set to true, will use the first domain when no domain is specified, mainly for telegram bot scenarios                                        | `false`                                   |
| `DOMAIN_LABELS`                       | JSON      | For Chinese domains, you can use DOMAIN_LABELS to display Chinese names                                                                                                                                           | `["中文.awsl.uk", "dreamhunter2333.xyz"]` |
| `ENABLE_AUTO_REPLY`                   | Text/JSON | Allow automatic email replies                                                                                                                                                                                     | `true`                                    |
| `DEFAULT_SEND_BALANCE`                | Text/JSON | Default email sending balance, will be 0 if not set                                                                                                                                                               | `1`                                       |
| `ENABLE_ADDRESS_PASSWORD`             | Text/JSON | Enable address password feature, when enabled, passwords will be auto-generated for new addresses, supports password login and modification                                                                       | `true`                                    |

## Email Reception Related Variables

| Variable Name                   | Type      | Description                                                                                                            | Example                    |
| ------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `BLACK_LIST`                    | Text      | Blacklist for filtering senders, comma separated                                                                       | `gov.cn,edu.cn`            |
| `ENABLE_CHECK_JUNK_MAIL`        | Text/JSON | Whether to enable junk mail checking, used with the following two lists                                                | `false`                    |
| `JUNK_MAIL_CHECK_LIST`          | JSON      | Junk mail check configuration, marked as junk if any item `exists` and `fails`                                         | `["spf", "dkim", "dmarc"]` |
| `JUNK_MAIL_FORCE_PASS_LIST`     | JSON      | Junk mail check configuration, marked as junk if any item `does not exist` or `fails`                                  | `["spf", "dkim", "dmarc"]` |
| `FORWARD_ADDRESS_LIST`          | JSON      | Global forward address list, disabled if not configured, all emails will be forwarded to listed addresses when enabled | `["xxx@xxx.com"]`          |
| `REMOVE_EXCEED_SIZE_ATTACHMENT` | Text/JSON | If attachment exceeds 2MB, remove it, email may lose some information due to parsing                                   | `true`                     |
| `REMOVE_ALL_ATTACHMENT`         | Text/JSON | Remove all attachments, email may lose some information due to parsing                                                 | `true`                     |

> [!NOTE]
> `Junk mail checking` and `attachment removal` require email parsing, free tier CPU is limited, may cause large email parsing timeout
>
> If you want stronger email parsing capabilities
>
> Refer to [Configure worker to use wasm for email parsing](/en/guide/feature/mail_parser_wasm_worker)

## Webhook Related Variables

| Variable Name    | Type      | Description                                       | Example            |
| ---------------- | --------- | ------------------------------------------------- | ------------------ |
| `ENABLE_WEBHOOK` | Text/JSON | Whether to enable webhook                         | `true`             |
| `FRONTEND_URL`   | Text      | Frontend URL, used for sending webhook email URLs | `https://xxxx.xxx` |

> [!NOTE]
> Webhook functionality requires email parsing, free tier CPU is limited, may cause large email parsing timeout
>
> If you want stronger email parsing capabilities
>
> Refer to [Configure worker to use wasm for email parsing](/en/guide/feature/mail_parser_wasm_worker)

## User Related Variables

| Variable Name                         | Type      | Description                                                                                          | Example   |
| ------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------- | --------- |
| `USER_DEFAULT_ROLE`                   | Text      | Default role for new users, only effective when email verification is enabled                        | `vip`     |
| `ADMIN_USER_ROLE`                     | Text      | Admin role configuration, if user role equals ADMIN_USER_ROLE, user can access admin console         | `admin`   |
| `USER_ROLES`                          | JSON      | -                                                                                                    | See below |
| `DISABLE_ANONYMOUS_USER_CREATE_EMAIL` | Text/JSON | Disable anonymous user mailbox creation, if set to true, users can only create addresses after login | `true`    |
| `NO_LIMIT_SEND_ROLE`                  | Text      | Roles that can send unlimited emails, multiple roles separated by comma `vip,admin`                  | `vip`     |

> [!NOTE] USER_ROLES User Role Configuration
>
> - If `domains` is empty, `DEFAULT_DOMAINS` will be used
> - If prefix is null, the default prefix will be used, if prefix is an empty string, no prefix will be used
>
> When deploying through UI, configure `USER_ROLES` in this format: `[{"domains":["awsl.uk","dreamhunter2333.xyz"],"role":"vip","prefix":"vip"},{"domains":["awsl.uk","dreamhunter2333.xyz"],"role":"admin","prefix":""}]`
>
> When deploying via CLI, refer to `worker/wrangler.toml.template` and configure `USER_ROLES` in this format: `[{ domains = ["awsl.uk", "dreamhunter2333.xyz"], role = "vip", prefix = "vip" }, { domains = ["awsl.uk", "dreamhunter2333.xyz"], role = "admin", prefix = "" }]`

## Web Related Variables

| Variable Name              | Type        | Description                                                              | Example               |
| -------------------------- | ----------- | ------------------------------------------------------------------------ | --------------------- |
| `DEFAULT_LANG`             | Text        | Worker error message default language, zh/en                             | `zh`                  |
| `TITLE`                    | Text        | Custom frontend page website title, supports html                        | `Custom Title`        |
| `ANNOUNCEMENT`             | Text        | Custom frontend page announcement, supports html                         | `Custom Announcement` |
| `ALWAYS_SHOW_ANNOUNCEMENT` | Text/JSON   | Whether to always show announcement (even if unchanged), default `false` | `true`                |
| `COPYRIGHT`                | Text        | Custom frontend footer text, supports html                               | `Dream Hunter`        |
| `ADMIN_CONTACT`            | Text        | Admin contact information, can be any string, hidden if not configured   | `xxx@gmail.com`       |
| `DISABLE_SHOW_GITHUB`      | Text/JSON   | Whether to show GitHub link                                              | `true`                |
| `CF_TURNSTILE_SITE_KEY`    | Text/Secret | Turnstile CAPTCHA configuration                                          | `xxx`                 |
| `CF_TURNSTILE_SECRET_KEY`  | Text/Secret | Turnstile CAPTCHA configuration                                          | `xxx`                 |

## Telegram Bot Related Variables

| Variable Name        | Type      | Description                                                                 | Example |
| -------------------- | --------- | --------------------------------------------------------------------------- | ------- |
| `TG_MAX_ADDRESS`     | Number    | Maximum number of mailboxes that can be bound to telegram bot               | `5`     |
| `TG_BOT_INFO`        | Text      | Optional, telegram BOT_INFO, predefined BOT_INFO can reduce webhook latency | `{}`    |
| `TG_ALLOW_USER_LANG` | Text/JSON | Allow users to switch language via `/lang` command, default `false`         | `true`  |

> [!NOTE]
> Telegram functionality requires email parsing, free tier CPU is limited, may cause large email parsing timeout
>
> If you want stronger email parsing capabilities
>
> Refer to [Configure worker to use wasm for email parsing](/en/guide/feature/mail_parser_wasm_worker)

## Email Forwarding Related Variables

| Variable Name                     | Type | Description                                                                              | Example   |
| --------------------------------- | ---- | ---------------------------------------------------------------------------------------- | --------- |
| `SUBDOMAIN_FORWARD_ADDRESS_LIST`  | JSON | Subdomain/rule forwarding configuration, supports filtering by domain and source regex  | See below |

> [!NOTE] SUBDOMAIN_FORWARD_ADDRESS_LIST Configuration
>
> v1.2.0 added `sourcePatterns` and `sourceMatchMode` fields for filtering by sender address regex:
>
> - `domains`: Target domain list, matches all domains if empty
> - `forward`: Forward destination address
> - `sourcePatterns`: Source address regex list (optional)
> - `sourceMatchMode`: Match mode, `any` (match any, default) or `all` (match all)
>
> Regex pattern max length is 200 characters to prevent ReDoS attacks
>
> ```toml
> SUBDOMAIN_FORWARD_ADDRESS_LIST = """
> [
>     {"domains":[""],"forward":"xxx1@xxx.com"},
>     {"domains":["subdomain-1.domain.com","subdomain-2.domain.com"],"forward":"xxx2@xxx.com"},
>     {"domains":["example.com"],"forward":"admin@xxx.com","sourcePatterns":[".*@github.com",".*@gitlab.com"],"sourceMatchMode":"any"}
> ]
> """
> ```

## Other Variables

| Variable Name           | Type      | Description                                                                                                                                                                                                                                                   | Example   |
| ----------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `ENABLE_ANOTHER_WORKER` | Text/JSON | Whether to enable other workers to process emails                                                                                                                                                                                                             | `false`   |
| `ANOTHER_WORKER_LIST`   | JSON      | - Configuration for other workers to process emails, multiple workers can be configured <br/> - Filter by keywords, call the bound worker's method (default method name is rpcEmail)<br/> - keywords are required, otherwise the worker will not be triggered | See below |

> [!NOTE]
> `ANOTHER_WORKER_LIST` configuration example
>
> ```toml
> #ANOTHER_WORKER_LIST ="""
> #[
> #    {
> #        "binding":"AUTH_INBOX",
> #        "method":"rpcEmail",
> #        "keywords":[
> #            "验证码","激活码","激活链接","确认链接","验证邮箱","确认邮件","账号激活","邮件验证","账户确认","安全码","认证码","安全验证","登陆码","确认码","启用账户","激活账户","账号验证","注册确认",
> #            "account","activation","verify","verification","activate","confirmation","email","code","validate","registration","login","code","expire","confirm"
> #        ]
> #    }
> #]
> #
> ```
