# 配置 webhook

> [!NOTE]
> 如果要使用 webhook，请先绑定 `KV` 并且 `worker` 变量配置 `ENABLE_WEBHOOK = true`
>
> 如果你想 webhook 的解析邮件能力更强，参考 [配置 worker 使用 wasm 解析邮件](/zh/guide/feature/mail_parser_wasm_worker)

## 前提条件

你需要自建一个 `webhook 服务` 或者 使用 `第三方平台`，这个服务需要能够接收 `POST` 请求，并且能够解析 `json` 数据。

本项目使用了 [songquanpeng/message-pusher](https://github.com/songquanpeng/message-pusher) 示例作为 webhook 服务。

- 可以使用 [msgpusher.com](https://msgpusher.com) 提供的服务
- 也可以自建 `message-pusher` 服务，参考 [songquanpeng/message-pusher](https://github.com/songquanpeng/message-pusher)

## admin 配置全局 webhook

![telegram](/feature/admin-mail-webhook.png)

## admin 允许邮箱使用 webhook

![telegram](/feature/admin-webhook-settings.png)

## 某个邮箱配置 webhook

![telegram](/feature/address-webhook.png)

## 邮件过滤

![Webhook 过滤规则编辑器](/feature/webhook-filter.png)

在管理员邮件 Webhook 或邮箱 Webhook 页面添加过滤条件。两个 Webhook 各自判断，不互相限制；不匹配只跳过该 Webhook，邮件仍照常保存，不影响黑名单、转发和 Telegram 通知。无需新增环境变量或执行数据库迁移。

规则保存在现有配置的 `filter` 字段，与 `url`、`headers`、`body` 平级，不放进 Body 模板。旧配置没有 `filter`，或值为 `null` 时，保持全部推送。可视化编辑与 JSON 编辑使用同一结构：

```json
{
  "filter": {
    "operator": "and",
    "children": [
      { "field": "from", "operator": "endsWith", "value": "@example.com" },
      {
        "operator": "or",
        "children": [
          { "field": "subject", "operator": "contains", "value": "告警" },
          { "field": "subject", "operator": "regex", "value": "^DOWN\\b", "options": { "flags": "i" } }
        ]
      },
      {
        "operator": "not",
        "children": [{ "field": "text", "operator": "contains", "value": "维护通知" }]
      }
    ]
  }
}
```

页面的 JSON 编辑框只填写 `filter` 内部的表达式，不需要再包一层 `filter`。

### 字段和操作符

| 字段 | 含义 |
| --- | --- |
| `from` | SMTP 信封发件邮箱和邮件头 From 中的全部邮箱地址，不包含显示名称 |
| `envelopeFrom` | SMTP 信封发件邮箱 |
| `headerFrom` | 邮件头 From 中的全部邮箱地址 |
| `to` | 实际投递地址，不是邮件头 To |
| `subject` | 解析后的主题 |
| `text` / `html` | 解析后的纯文本 / HTML 正文；缺失时为空字符串，不扫描 MIME 原文或附件内容 |
| `header.List-ID` 等 | 指定邮件头的全部值；头名称不区分大小写，可在字段选择框直接输入 |

- `and` / `or` 的 `children` 为非空条件列表；`not` 的 `children` 必须恰好有一个条件。子条件可以继续嵌套，根节点也可以直接是一条字段匹配条件。
- 文本操作符为 `equals`、`contains`、`startsWith`、`endsWith`，默认不区分大小写；可视化下拉框为每种匹配提供普通和“区分大小写”两个选项，后者保存为 `options: { "caseSensitive": true }`，兼容已有 JSON 规则。空 `value` 是合法值，例如 `equals` 空字符串匹配空正文。
- `regex` 使用 [RE2JS](https://github.com/le0pard/re2js) 的 RE2 正则语法，默认区分大小写。`options.flags` 支持 `i`（忽略大小写）、`m`（多行锚点）、`s`（点匹配换行）。不支持 JavaScript 正则的反向引用、前瞻等语法，保存时会校验；不执行用户脚本。
- 对多个邮箱或同名邮件头，任意一个值匹配即成立；外层 `not` 则要求全部不匹配。缺失邮件头为空列表，不匹配任何值。From 条件不是发件人真实性认证，不能代替 SPF/DKIM/DMARC。
- 最多 8 层、100 个节点，字段名最多 100 字符、匹配值最多 500 字符。未知字段、操作符、选项、非法正则和空条件组会被拒绝，不会覆盖原有配置。
- 解析或求值失败会跳过该 Webhook 并记录错误，不会因 `not` 而放行。旧配置无规则时仍使用原处理流程。原有 Body 变量及渲染方式不变。

### 测试和复用

测试弹框保留“随机邮件 / 指定 ID”。“仅检查规则”不发送请求；“测试”在匹配后真实发送，不匹配时提示已跳过。使用过滤规则时必须有真实邮件；指定 ID 仍检查邮箱归属。

现有 `/api/webhook/test` 和 `/admin/mail_webhook/test` 接收配置及可选 `mail_id`，新增可选布尔字段 `check_only`。仅检查或未匹配时返回 `{ "success": true, "matched": true/false, "skipped": true }`；真实发送的成功/失败响应保持原行为。`check_only` 仅用于测试，不属于持久配置。

后端通用模块 `worker/src/utils/filter.ts` 通过 `compileFilter(expression, isFieldAllowed, operators)` 编译并校验规则，返回接收字符串/字符串列表字段映射的匹配函数；扩展操作符只需注册参数编译函数。`webhook_filter.ts` 单独负责邮件字段映射。前端 `FilterEditor.vue` 接收 `v-model`、`fields` 和 `operators`（包括选项编辑配置），不依赖 Webhook API；其他功能可提供自己的字段和操作符复用编辑器。

## Webhook 模板示例

### Telegram Bot 推送

通过 Webhook 直接调用 Telegram Bot API 推送邮件通知，适合不想部署完整 Telegram Bot 集成或需要自定义推送格式的场景。

- **URL**: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/sendMessage`
- **Method**: `POST`
- **Headers**:

```json
{
    "Content-Type": "application/json"
}
```

- **Body**:

```json
{
    "chat_id": "YOUR_CHAT_ID",
    "text": "New Email\nFrom: ${from}\nTo: ${to}\nSubject: ${subject}\nURL: ${url}"
}
```

> [!TIP]
> 获取 `chat_id`：向 Bot 发送一条消息，然后访问 `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates` 查看返回结果中的 `chat.id` 字段

### 企业微信机器人推送

- **URL**: `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY`
- **Method**: `POST`
- **Headers**:

```json
{
    "Content-Type": "application/json"
}
```

- **Body**:

```json
{
    "msgtype": "text",
    "text": {
        "content": "New Email\nFrom: ${from}\nTo: ${to}\nSubject: ${subject}\nURL: ${url}"
    }
}
```

### Discord Webhook 推送

- **URL**: `https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN`
- **Method**: `POST`
- **Headers**:

```json
{
    "Content-Type": "application/json"
}
```

- **Body**:

```json
{
    "content": "**New Email**\nFrom: ${from}\nTo: ${to}\nSubject: ${subject}\nURL: ${url}"
}
```

## webhook 数据格式

Body 中可以将附件链接直接插入最终文本：

- `${attachmentLinks}`：所有附件的纯 URL，每行一个，不按文件类型过滤。
- `${attachmentMarkdownLinks}`：所有附件的 Markdown 链接 `[文件名](URL)`，每行一个，不按文件类型过滤。

例如 `{"content":"附件：\n${attachmentMarkdownLinks}"}`。无附件或未配置后端地址时，展开的链接列表为空。链接如何展示由接收平台决定。页面上的 Webhook 测试按钮也支持这些变量，使用所选测试邮件的附件。

`${attachments}` 返回所有附件的 JSON 数组，每项包含 `filename`、`mimeType`、`url`。将此变量直接放在 JSON 值的位置，**不要加引号**：

```json
{"attachments": ${attachments}}
```

例如返回 `{"attachments":[{"filename":"a.png","mimeType":"image/png","url":"https://temp-email-api.example.com/open_api/a/123/0/..."}]}`。无附件时为 `[]`。附件链接使用 `BACKEND_URL`，接收端可直接使用每项 `url`；附件序号也参与签名，不能修改路径读取其他附件。链接本身是临时访问凭证，请使用 HTTPS 传输并避免公开分享。

要获取 url 需要配置 worker 的 `FRONTEND_URL` 为你的前端地址，或者你可以通过 `id` 自己拼接 url = `${FRONTEND_URL}?mail_id=${id}`

```json
{
    "id": "${id}",
    "url": "${url}",
    "from": "${from}",
    "to": "${to}",
    "subject": "${subject}",
    "raw": "${raw}",
    "parsedText": "${parsedText}",
    "parsedHtml": "${parsedHtml}",
    "attachments": ${attachments},
    "aiExtractType": "${aiExtractType}",
    "aiExtractResult": "${aiExtractResult}",
    "aiExtractResultText": "${aiExtractResultText}",
}
```

启用 AI 邮件内容提取后，Webhook 模板可使用 `aiExtractType`、`aiExtractResult`、`aiExtractResultText` 占位符。未提取到结果时这些字段为空字符串。

点击“测试”会弹出选择框：默认随机选择邮件，也可以选择“指定 ID”并输入邮件 ID。指定邮件不存在时会报错，不会回退随机；邮箱页面只能使用当前邮箱的邮件，管理员页面可指定任意邮件。现有测试接口 `/api/webhook/test` 和 `/admin/mail_webhook/test` 的请求 Body 支持可选正整数 `mail_id`，不传则沿用随机逻辑。页面仅在测试请求中传入该参数，不会保存到 Webhook 配置。

每项 `url` 直接访问后端附件接口，使用 `JWT_SECRET` 签名并在 24 小时后失效。签名使用 52 字符的小写 Base32 编码，校验兼容签名部分的大小写，不截断 HMAC-SHA256。非 PNG、JPEG、GIF、WebP 的附件会作为文件下载。邮件被删除或附件在入库前被配置移除时，无法通过接口读取附件。

在 Worker 中配置 `BACKEND_URL = "https://temp-email-api.example.com"`，使用后端公网根地址（支持末尾斜杠），不需要前端代理。未配置时附件的 `url` 为空；邮件页面链接仍使用 `FRONTEND_URL`。

关闭 `ENABLE_WEBHOOK` 后，附件下载接口返回 403，即使链接签名尚未过期也无法下载；请求不会进入邮件数据库查询和解析流程。附件下载本身不依赖 KV，Webhook 配置的保存和读取仍需要 KV。
