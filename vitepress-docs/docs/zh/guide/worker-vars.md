# Worker 变量说明

> [!NOTE] 注意
> 通过 CLI 部署时的写法请参考 `worker/wrangler.toml.template`

## 必填变量

| 变量名                     | 类型        | 说明                                       | 示例                                 |
| -------------------------- | ----------- | ------------------------------------------ | ------------------------------------ |
| `DOMAINS`                  | JSON        | 用于临时邮箱的所有域名, 支持多个域名       | `["awsl.uk", "dreamhunter2333.xyz"]` |
| `JWT_SECRET`               | 文本/Secret | 用于签名 JWT 的密钥，JWT 用于登录鉴权。请使用随机字符串，例如通过 `openssl rand -hex 32` 生成  | `a1b2c3d4...`                        |
| `ADMIN_PASSWORDS`          | JSON        | admin 控制台密码, 不配置则不允许访问控制台 | `["123", "456"]`                     |
| `ENABLE_USER_CREATE_EMAIL` | 文本/JSON   | 是否允许用户创建邮箱, 不配置则不允许       | `true`                               |
| `ENABLE_USER_DELETE_EMAIL` | 文本/JSON   | 是否允许用户删除邮件, 不配置则不允许       | `true`                               |

> [!IMPORTANT] DOMAINS 与 DEFAULT_DOMAINS 必须先在 Cloudflare 配置好
> 这里填写的所有域名（包括下文「邮箱相关变量」里的 `DEFAULT_DOMAINS`、`USER_ROLES.domains`、`RANDOM_SUBDOMAIN_DOMAINS` 等）必须是你**已经在 Cloudflare Email Routing 中启用并配置过 Catch-all 规则**的域名，否则邮件无法投递到 Worker。
> 配置步骤见 [Cloudflare Email Routing](/zh/guide/email-routing)。

## 后台相关变量

| 变量名                         | 类型      | 说明                                 | 示例             |
| ------------------------------ | --------- | ------------------------------------ | ---------------- |
| `PASSWORDS`                    | JSON      | 网站私有密码, 配置后需要密码才能访问 | `["123", "456"]` |
| `DISABLE_ADMIN_PASSWORD_CHECK` | 文本/JSON | 警告: 管理员控制台没有密码或用户检查 | `false`          |

## 邮箱相关变量

| 变量名                                | 类型      | 说明                                                                                                                              | 示例                                      |
| ------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `PREFIX`                              | 文本      | 新建 `邮箱名称` 的默认前缀，不需要前缀可不配置                                                                                    | `tmp`                                     |
| `MIN_ADDRESS_LEN`                     | 数字      | `邮箱名称` 的最小长度                                                                                                             | `1`                                       |
| `MAX_ADDRESS_LEN`                     | 数字      | `邮箱名称` 的最大长度                                                                                                             | `30`                                      |
| `DISABLE_CUSTOM_ADDRESS_NAME`         | 文本/JSON | 禁用自定义邮箱地址名称，如果设置为 true，则用户无法输入自定义邮箱名称，将由后台自动生成                                           | `true`                                    |
| `ADDRESS_CHECK_REGEX`                 | 文本      | `邮箱名称` 的正则表达式, 只用于检查                                                                                               | `^(?!.*admin).*`                          |
| `ADDRESS_REGEX`                       | 文本      | `邮箱名称` 替换非法符号的正则表达式, 不在其中的符号将被替换，如果不设置，默认为 `[^a-z0-9]`, 需谨慎使用, 有些符号可能导致无法收件 | `[^a-z0-9]`                               |
| `DEFAULT_DOMAINS`                     | JSON      | 默认用户可用的域名(未登录或未分配角色的用户)                                                                                      | `["awsl.uk", "dreamhunter2333.xyz"]`      |
| `CREATE_ADDRESS_DEFAULT_DOMAIN_FIRST` | 文本/JSON | 创建新地址时是否优先使用默认域名，如果设置为 true，当未指定域名时将使用第一个域名, 主要用于 telegram bot 场景                     | `false`                                   |
| `ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH` | 文本/JSON | 是否允许创建邮箱 API 使用“基础域名后缀匹配”。开启后，如果允许域名里有 `example.com`，则 `/api/new_address` 与 `/admin/new_address` 可以接受 `foo.example.com`、`a.b.example.com` 这类子域名 | `true` |
| `RANDOM_SUBDOMAIN_DOMAINS`            | JSON      | 允许启用随机子域名的基础域名列表，启用后可把 `name@abc.com` 创建成 `name@随机串.abc.com`                                         | `["abc.com"]`                             |
| `RANDOM_SUBDOMAIN_LENGTH`             | 数字      | 随机子域名长度，默认 `8`，范围 `1-63`                                                                                            | `8`                                       |
| `DOMAIN_LABELS`                       | JSON      | 对于中文域名，可以使用 DOMAIN_LABELS 显示域名的中文展示名称                                                                       | `["中文.awsl.uk", "dreamhunter2333.xyz"]` |
| `ENABLE_AUTO_REPLY`                   | 文本/JSON | 允许自动回复邮件。发件人过滤（`source_prefix`）支持三种模式：留空匹配所有发件人、填写前缀进行 `startsWith` 匹配、使用 `/regex/` 语法进行正则匹配（如 `/@example\.com$/`） | `true`                                    |
| `DEFAULT_SEND_BALANCE`                | 文本/JSON | 默认发送邮件余额；当值大于 `0` 时，用户打开前端设置页或首次发送邮件时会自动初始化该额度。如果不设置，将为 `0`                                                                                              | `1`                                       |
| `ENABLE_ADDRESS_PASSWORD`             | 文本/JSON | 启用邮箱地址密码功能，启用后创建新地址时会自动生成密码，并支持密码登录和修改                                                      | `true`                                    |
| `SEND_MAIL_DOMAINS`                   | JSON      | 限制 `SEND_MAIL` binding 可用于哪些发件域名；留空或不配置时允许所有域名                                                            | `["example.com", "mail.example.com"]`     |

> [!NOTE]
> `RANDOM_SUBDOMAIN_DOMAINS` 只负责“创建地址时自动补随机子域名”，不会自动帮你创建 Cloudflare
> 侧的子域名路由。
>
> 子域名地址通常更适合收件；如果要发件，仍建议优先使用主域名。
>
> `ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH` 与随机子域名功能不同：它允许 API 调用方**直接指定**
> `foo.example.com` 这类子域名；而随机子域名功能是系统在创建时自动补一个随机前缀。
>
> `ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH` 的优先级为：当 env 明确设置为 `false` 时，全局硬禁用；
> 其他情况下优先使用后台持久化设置，后台未设置时再回退到 env 值。
>
> 管理后台提供三种显式状态：**跟随环境变量**、**强制开启**、**强制关闭**。当你选择
> “跟随环境变量”并保存时，会清空后台覆盖，恢复到“未设置”的回退行为。
>
> `SEND_MAIL_DOMAINS` 只影响 `SEND_MAIL` binding 的兜底发信路径和 `/admin/send_mail_by_binding`。
> 它不影响 Resend、SMTP、`verifiedAddressList` 等其他发信通道。

## 接受邮件相关变量

| 变量名                          | 类型      | 说明                                                                       | 示例                       |
| ------------------------------- | --------- | -------------------------------------------------------------------------- | -------------------------- |
| `BLACK_LIST`                    | 文本      | 黑名单，用于过滤发件人，逗号分隔                                           | `gov.cn,edu.cn`            |
| `ENABLE_CHECK_JUNK_MAIL`        | 文本/JSON | 是否启用垃圾邮件检查，配合下列两个列表使用                                 | `false`                    |
| `JUNK_MAIL_CHECK_LIST`          | JSON      | 垃圾邮件检查配置, 任何一项 `存在` 且 `不通过` 则被判定为垃圾邮件           | `["spf", "dkim", "dmarc"]` |
| `JUNK_MAIL_FORCE_PASS_LIST`     | JSON      | 垃圾邮件检查配置, 任何一项 `不存在` 或者 `不通过` 则被判定为垃圾邮件       | `["spf", "dkim", "dmarc"]` |
| `FORWARD_ADDRESS_LIST`          | JSON      | 全局转发地址列表，如果不配置则不启用，启用后所有邮件都会转发到列表中的地址 | `["xxx@xxx.com"]`          |
| `REMOVE_EXCEED_SIZE_ATTACHMENT` | 文本/JSON | 如果附件大小超过 2MB，则删除附件，邮件可能由于解析而丢失一些信息           | `true`                     |
| `REMOVE_ALL_ATTACHMENT`         | 文本/JSON | 移除所有附件，邮件可能由于解析而丢失一些信息                               | `true`                     |
| `ENABLE_MAIL_GZIP`             | 文本/JSON | 启用后新邮件将 Gzip 压缩存储到 `raw_blob` 字段，可节省 D1 数据库空间。已有明文 `raw` 数据自动兼容读取。**启用前请先执行数据库迁移（`Admin -> 快速设置 -> 数据库 -> 升级数据库 Schema` 或 `POST /admin/db_migration`），确保 `raw_blob` 列已创建。该功能会增加压缩/解压 CPU 开销，建议使用 Cloudflare Worker 付费 Plan 再开启。** | `true`                     |

> [!NOTE]
> `ENABLE_MAIL_GZIP` 会增加邮件写入压缩与读取解压的 CPU 消耗，免费版 Worker 更容易触发 CPU 限制，建议付费 Plan 再开启
>
> `垃圾邮件检查` 和 `移除附件功能` 需要解析邮件，免费版 CPU 有限，可能会导致大邮件解析超时
>
> 如果你想解析邮件能力更强
>
> 参考 [配置 worker 使用 wasm 解析邮件](/zh/guide/feature/mail_parser_wasm_worker)

## webhook 相关变量

| 变量名           | 类型      | 说明                                  | 示例               |
| ---------------- | --------- | ------------------------------------- | ------------------ |
| `ENABLE_WEBHOOK` | 文本/JSON | 是否启用 webhook                      | `true`             |
| `FRONTEND_URL`   | 文本      | 前端地址，用于发送 webhook 的邮件 url | `https://xxxx.xxx` |

> [!NOTE]
> webhook 功能需要解析邮件，免费版 CPU 有限，可能会导致大邮件解析超时
>
> 如果你想解析邮件能力更强
>
> 参考 [配置 worker 使用 wasm 解析邮件](/zh/guide/feature/mail_parser_wasm_worker)

## 用户相关变量

| 变量名                                | 类型      | 说明                                                                     | 示例    |
| ------------------------------------- | --------- | ------------------------------------------------------------------------ | ------- |
| `USER_DEFAULT_ROLE`                   | 文本      | 新用户默认角色, 仅在启用邮件验证时有效                                   | `vip`   |
| `ADMIN_USER_ROLE`                     | 文本      | admin 角色配置, 如果用户角色等于 ADMIN_USER_ROLE 则可以访问 admin 控制台 | `admin` |
| `USER_ROLES`                          | JSON      | -                                                                        | 见下方  |
| `DISABLE_ANONYMOUS_USER_CREATE_EMAIL` | 文本/JSON | 禁用匿名用户创建邮箱，如果设置为 true，则用户只能在登录后创建邮箱地址    | `true`  |
| `NO_LIMIT_SEND_ROLE`                  | 文本      | 可以无限发送邮件的角色, 多个角色使用逗号分割 `vip,admin`                 | `vip`   |

> [!NOTE] USER_ROLES 用户角色配置说明
>
> - 如果 `domains` 为空将使用 `DEFAULT_DOMAINS`
> - 如果 prefix 为 null 将使用默认前缀, 如果 prefix 为空字符串将不使用前缀
>
> 通过用户界面部署时 `USER_ROLES` 请配置为此格式 `[{"domains":["awsl.uk","dreamhunter2333.xyz"],"role":"vip","prefix":"vip"},{"domains":["awsl.uk","dreamhunter2333.xyz"],"role":"admin","prefix":""}]`
>
> CLI 部署时 `USER_ROLES` 请参考 `worker/wrangler.toml.template` 配置为此格式 `[{ domains = ["awsl.uk", "dreamhunter2333.xyz"], role = "vip", prefix = "vip" }, { domains = ["awsl.uk", "dreamhunter2333.xyz"], role = "admin", prefix = "" }]`

## 网页相关变量

| 变量名                     | 类型        | 说明                                             | 示例                  |
| -------------------------- | ----------- | ------------------------------------------------ | --------------------- |
| `DEFAULT_LANG`             | 文本        | Worker 错误信息默认语言, zh/en                   | `zh`                  |
| `TITLE`                    | 文本        | 自定义前端页面网站标题，支持 html                | `Custom Title`        |
| `ANNOUNCEMENT`             | 文本        | 自定义前端页面公告，支持 html                    | `Custom Announcement` |
| `ALWAYS_SHOW_ANNOUNCEMENT` | 文本/JSON   | 是否总是显示公告(即使无更改), 默认 `false`       | `true`                |
| `COPYRIGHT`                | 文本        | 自定义前端界面页脚文本，支持 html                | `Dream Hunter`        |
| `ADMIN_CONTACT`            | 文本        | admin 联系方式，可配置任意字符串, 不配置则不显示 | `xxx@gmail.com`       |
| `DISABLE_SHOW_GITHUB`      | 文本/JSON   | 是否显示 GitHub 链接                             | `true`                |
| `STATUS_URL`               | 文本        | 状态监控页面 URL，配置后显示 Status 菜单按钮     | `https://status.example.com` |
| `CF_TURNSTILE_SITE_KEY`    | 文本/Secret | Turnstile 人机验证配置（用于新建邮箱、注册验证码等） | `xxx`                 |
| `CF_TURNSTILE_SECRET_KEY`  | 文本/Secret | Turnstile 人机验证配置（用于新建邮箱、注册验证码等） | `xxx`                 |
| `ENABLE_GLOBAL_TURNSTILE_CHECK` | 文本/JSON | 启用全局登录表单的 Turnstile 人机验证（管理员登录、用户登录、邮箱密码登录），需同时配置上述 Turnstile 密钥 | `true` |

## Telegram Bot 相关变量

| 变量名              | 类型      | 说明                                                                   | 示例  |
| ------------------- | --------- | ---------------------------------------------------------------------- | ----- |
| `TG_MAX_ADDRESS`    | 数字      | telegram bot 最多绑定邮箱数量                                          | `5`   |
| `TG_BOT_INFO`       | 文本      | 可不配置，telegram BOT_INFO，预定义的 BOT_INFO 可以降低 webhook 的延迟 | `{}`  |
| `TG_ALLOW_USER_LANG`| 文本/JSON | 是否允许用户通过 `/lang` 命令切换语言，默认 `false`                    | `true`|
| `ENABLE_TG_PUSH_ATTACHMENT`| 布尔值 | 是否启用 Telegram 推送邮件附件，默认 `false`，单文件限制 50MB           | `true`|

> [!NOTE]
> Telegram 功能需要解析邮件，免费版 CPU 有限，可能会导致大邮件解析超时
>
> 如果你想解析邮件能力更强
>
> 参考 [配置 worker 使用 wasm 解析邮件](/zh/guide/feature/mail_parser_wasm_worker)

## 邮件转发相关变量

| 变量名                            | 类型 | 说明                                                                                                       | 示例   |
| --------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------- | ------ |
| `SUBDOMAIN_FORWARD_ADDRESS_LIST`  | JSON | 子域名/规则转发配置，支持按域名和来源地址正则过滤转发                                                       | 见下方 |

> [!NOTE] SUBDOMAIN_FORWARD_ADDRESS_LIST 配置说明
>
> v1.2.0 新增 `sourcePatterns` 和 `sourceMatchMode` 字段，支持按发件人地址正则过滤转发：
>
> - `domains`: 目标域名列表，为空则匹配所有域名
> - `forward`: 转发目标地址
> - `sourcePatterns`: 来源地址正则表达式列表（可选）
> - `sourceMatchMode`: 匹配模式，`any`(任一匹配，默认) 或 `all`(全部匹配)
>
> 正则表达式最大长度 200 字符，防止 ReDoS 攻击
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

## 其他变量

| 变量名                  | 类型      | 说明                                                                                                                                                                              | 示例    |
| ----------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `ENABLE_ANOTHER_WORKER` | 文本/JSON | 是否开启其他 worker 处理邮件                                                                                                                                                      | `false` |
| `ANOTHER_WORKER_LIST`   | JSON      | - 其他 worker 处理邮件的配置，可以配置多个其他 worker <br/> - 通过关键词筛选，调用对应绑定的 worker 的方法（默认方法名为 rpcEmail）<br/> - keywords必填，否则 worker 将不会被触发 | 见下方  |

> [!NOTE]
> `ANOTHER_WORKER_LIST` 的配置示例
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
