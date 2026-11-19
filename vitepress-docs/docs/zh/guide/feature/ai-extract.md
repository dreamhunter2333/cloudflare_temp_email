# AI 邮件识别

> [!NOTE]
> 此功能从 v1.1.0 版本开始支持
>
> 本功能参考自 [Alle 项目](https://github.com/bestruirui/Alle/blob/62e74629ded0c7966c12d4e1c54f0bcc2e54f12c/src/lib/email/extract.ts#L54)

## 功能说明

邮件识别功能会自动分析收到的邮件内容，提取其中的重要信息，并支持两种互斥的识别模式：

| 模式 | 识别内容 | 隐私 | 依赖 |
| ---- | -------- | ---- | ---- |
| `local`（默认） | 仅**验证码** (auth_code) | 在 Worker 内用内置规则识别，邮件内容**不会发送给任何 AI 模型** | 无，零成本 |
| `ai` | 验证码、认证链接、服务链接、订阅管理链接、其他链接 | 邮件内容会发送给你 Cloudflare 账号下的 Workers AI 模型 | Workers AI 绑定 |

`ai` 模式可识别的类型：

- **验证码** (auth_code) - OTP、安全码、确认码等
- **认证链接** (auth_link) - 登录、验证、激活、重置密码链接
- **服务链接** (service_link) - GitHub、GitLab、部署通知等服务相关链接
- **订阅管理链接** (subscription_link) - 退订、管理订阅等链接
- **其他链接** (other_link) - 其他有价值的链接

提取结果会自动保存到数据库的 `metadata` 字段中，前端可以直接展示提取的验证码或链接，Telegram 推送与 Webhook 占位符也会复用该结果。

## 配置变量

| 变量名                    | 类型      | 说明                                                                                                                           | 示例                             |
| ------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| `ENABLE_AI_EMAIL_EXTRACT` | 文本/JSON | 是否启用邮件识别功能（总开关，两种模式都需要）                                                                                   | `true`                           |
| `AI_EXTRACT_MODE`         | 文本      | 识别模式：`local` 仅用内置规则，`ai` 优先使用 Workers AI。不填默认为 `local`，填写其他值会记录错误日志并跳过识别                        | `local`                          |
| `AI_EXTRACT_MODEL`        | 文本      | 仅 `ai` 模式生效。AI 模型名称，从[支持 JSON 模式的模型](https://developers.cloudflare.com/workers-ai/features/json-mode/#supported-models)中选择 | `@cf/meta/llama-3.1-8b-instruct-fast` |

> [!WARNING] 从旧版本升级
> 旧版本在配置了 Workers AI 绑定时会自动使用 AI 识别。现在不填 `AI_EXTRACT_MODE` 时默认使用本地规则，如需继续使用 AI 识别，请显式设置 `AI_EXTRACT_MODE = "ai"`。

两种模式的主要行为：

- `local` 模式即使配置了 Workers AI 绑定，也不会调用 AI
- `ai` 模式未配置 Workers AI 绑定或调用模型失败时，会记录错误日志并跳过本封邮件的识别，不会改用本地规则
- `ai` 模式下如果地址未命中 AI 提取白名单，只会跳过 Workers AI 调用，仍会改用本地规则尝试提取验证码

## 本地规则模式（local）

- 仅提取**验证码**（`auth_code`），不提取链接
- 零依赖、零成本，在 Worker 内本地完成，邮件内容不会离开 Worker
- 同时识别**邮件标题**和正文，标题中的验证码（如 `123456 is your verification code`）也能提取
- 支持中文、英文、日文、韩文，以及俄语、西班牙语、葡萄牙语、法语、德语、意大利语、土耳其语、希伯来语的常见写法，例如：
  - 关键词在前：`验证码：123456`、`Apple ID代码为：724818`、`認証コードは 123456 です`、`인증번호 [123456]`、`Ваш код: 123456`
  - 验证码在前：`123456 是您的验证码`、`116352（动态验证码）`、`G-123456 is your Google verification code`、`123456 est votre code de sécurité`
  - 关键词与验证码之间有其他词：`Your OTP for payment of Rs 5000 is 482913`
- 支持带分隔符、空格、零宽字符或全角数字的验证码（如 `123-456`、`8 4 9 2 0 1`、`K9X-4B2`、`１２３４５６`），结果会去掉分隔符和 `G-` 这类字母前缀
- 字母数字混合的验证码必须包含数字，纯字母验证码（如 `QGFDAE`）不会识别，以免把 `EXPIRED` 这类单词误判为验证码
- 自动排除：年份与 `YYYYMMDD` 日期、超过 8 位的数字（如电话号码）、小数与金额、时间、URL 和邮箱地址中的数字，以及 promo / tracking / order / reference / voucher code 等非验证码
- 没有明确关键词时，只有在验证类邮件中、且数字**单独成行**或紧跟「输入 / use / enter」时才会识别，避免把订单号、客服电话、邮编误判为验证码
- 标题最多取前 1000 个字符，与正文合并后只分析前 20000 个字符，保证大邮件的 CPU 耗时可控

## AI 模式（ai）

推荐使用 `@cf/meta/llama-3.1-8b-instruct-fast` 作为默认模型，它支持当前实现依赖的 JSON Mode，且 Cloudflare 说明 `-fast` 变体会保持可用。价格更低的 `@cf/meta/llama-3.1-8b-instruct-fp8-fast` 目前不在 JSON Mode 支持列表中，不建议用于本功能。Cloudflare 推荐的新模型 `@cf/zai-org/glm-4.7-flash` 适合多语言场景，但用于本功能前请先确认它在你的账号/区域支持结构化 JSON 输出。旧默认模型 `@cf/meta/llama-3.1-8b-instruct` 已于 2026-05-30 被 Cloudflare 弃用，不建议继续使用。

### 内容长度限制

为避免 AI 模型 token 限制，邮件内容最大处理长度为 **4000 字符**。超过此长度的邮件内容将被截断后再进行 AI 分析。

### Workers AI 绑定

需要在 `wrangler.toml` 中配置 Workers AI 绑定：

```toml
AI_EXTRACT_MODE = "ai"

[ai]
binding = "AI"
```

或在 Cloudflare Dashboard 的 Worker 设置中添加：
- **Variable name**: `AI`
- **Type**: Workers AI

## 地址白名单（可选）

为了控制成本和资源使用，可以在 Admin 控制台的 **AI 提取设置** 页面配置地址白名单。白名单只控制 Workers AI 调用，不限制本地规则模式；`ai` 模式下未命中白名单的地址仍会使用本地规则尝试提取验证码。

### 配置说明

- **未启用白名单**：所有邮箱地址都可使用 Workers AI 提取
- **启用白名单**：仅白名单中的邮箱地址会调用 Workers AI；未命中的地址会跳过 Workers AI，并回退到本地验证码提取

### 白名单格式

每行一个地址，支持通配符 `*` 匹配任意字符：

- **精确匹配**：`user@example.com` - 仅匹配该邮箱
- **域名通配符**：`*@example.com` - 匹配 example.com 域名下的所有邮箱
- **用户通配符**：`admin*@example.com` - 匹配 admin 开头的邮箱
- **任意位置通配符**：`*test*@example.com` - 匹配包含 test 的邮箱
- **多个通配符**：`admin*@*.com` - 匹配所有 .com 域名下 admin 开头的邮箱

### 配置示例

```text
user@example.com
*@mydomain.com
admin*@company.com
```

此配置将只对以下邮箱调用 Workers AI：
- `user@example.com`（精确匹配）
- 所有 `@mydomain.com` 的邮箱（如 `test@mydomain.com`、`admin@mydomain.com`）
- 所有 `admin` 开头的 `@company.com` 邮箱（如 `admin@company.com`、`admin123@company.com`）

## 按需摘要和翻译 {#mail-processing}

设置 `ENABLE_MAIL_PROCESSING = true` 并配置有效的 `MAIL_PROCESSING_PROVIDER` 后，邮件操作栏会显示「摘要」和「翻译」。摘要可关闭；翻译会在阅读区替换标题和正文，点击「查看原文」即可恢复。默认跟随界面语言；展开邮箱设置底部的「邮件 AI 助手」可另选翻译目标语言，仅保存在当前浏览器。打开邮件不会调用模型，不保存结果、不修改原文，也无需数据库迁移。

| 接入方式 | 配置值 | 所需配置 |
| --- | --- | --- |
| Workers AI | `workers-ai` | 给 Worker 添加 `AI` 绑定，默认模型为 `@cf/meta/llama-3.1-8b-instruct-fast`。 |
| OpenAI Chat Completions | `openai-chat` | 设置 `MAIL_PROCESSING_MODEL` 和 `MAIL_PROCESSING_API_KEY` Secret。 |
| OpenAI Responses | `openai-responses` | 设置 `MAIL_PROCESSING_MODEL` 和 `MAIL_PROCESSING_API_KEY` Secret。 |
| Claude Messages | `claude-messages` | 设置 `MAIL_PROCESSING_MODEL` 和 `MAIL_PROCESSING_API_KEY` Secret。 |

`ENABLE_MAIL_PROCESSING` 默认关闭，不影响 `ENABLE_AI_EMAIL_EXTRACT`。关闭开关或未正确配置接入方式时，摘要和翻译均不可用。外部服务可通过 `MAIL_PROCESSING_BASE_URL` 指定 HTTPS API 前缀，例如 `https://api.openai.com/v1`；后端负责追加接口路径。

可在 Worker 设置 `MAIL_PROCESSING_SUMMARY_PROMPT` 和 `MAIL_PROCESSING_TRANSLATION_PROMPT`，分别替换两种操作的默认风格指令。实际操作和目标语言仍以请求为准。

邮箱用户点击后，邮件主题和正文文本会发送到所选服务。不会发送附件。超过 12,000 字符的输入会被拒绝；公开部署建议启用 Worker 限流。

站点模型共用后台 **AI 提取设置** 的地址白名单。未启用白名单时，所有邮箱可使用站点模型；启用白名单时，只有命中的邮箱才会看到 AI 操作并能使用站点模型。站点模型和提示词通过 Worker 配置。
