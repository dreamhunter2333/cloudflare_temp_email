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

![Webhook 过滤规则编辑器](/feature/webhook-filter.webp)

在管理员邮件 Webhook 或邮箱 Webhook 页面添加过滤条件。两个 Webhook 各自判断，不互相限制；不匹配只跳过该 Webhook，邮件仍照常保存，不影响黑名单、转发和 Telegram 通知。无需新增环境变量或执行数据库迁移。

规则保存在现有配置的 `filter` 字段，与 `url`、`headers`、`body` 平级，不放进 Body 模板。旧配置没有 `filter`，或值为 `null` 时，保持全部推送。可视化编辑与 JSON 编辑使用同一结构：

```json
{
  "filter": {
    "operator": "and",
    "children": [
      { "field": "from", "operator": "regex", "value": "@example\\.com>$", "options": { "flags": "i" } },
      {
        "operator": "and",
        "children": [
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
    ]
  }
}
```

页面的 JSON 编辑框只填写 `filter` 内部的表达式，不需要再包一层 `filter`。

根节点和每个子项都用同一个“规则类型”下拉框，选择匹配条件、与、或、非。与/或固定两个子项，非固定一个；子项可以继续嵌套。选逻辑节点后先显示空位置，未填写完整不能保存；移除子项只清空位置，移除根节点则取消过滤。与/或互换保留子项，改为其他类型会重新填写该节点。

关闭 Webhook 只保存关闭状态并保留已保存的规则，原本无规则则保持无规则。切换开关不会丢失当前页面的 JSON 或可视化草稿；重新启用后，可修正草稿再保存。

### 字段和操作符

| 字段 | 含义 |
| --- | --- |
| `from` | 解析后的发件人，与 Body 的 `${from}` 一致，例如 `GitHub <notifications@github.com>`；可用包含匹配名称或邮箱 |
| `to` | 实际投递地址，不是邮件头 To |
| `subject` | 解析后的主题 |
| `text` / `html` | 解析后的纯文本 / HTML 正文；缺失时为空字符串，不扫描 MIME 原文或附件内容 |
| `header.List-ID` 等 | 指定邮件头的全部值；头名称不区分大小写，可在字段选择框直接输入 |

- `and` / `or` 的 `children` 必须恰好有两个条件；`not` 必须恰好有一个。子条件可以继续嵌套，根节点也可以直接是一条字段匹配条件。子项不能为 `null`；需要三个以上条件时，通过嵌套组合。
- `regex` 使用原生 JavaScript `RegExp`，默认区分大小写。`options.flags` 支持 `i`（忽略大小写）、`m`（多行锚点）、`s`（点匹配换行）。支持 JavaScript 的前瞻、反向引用等语法，保存时由后端编译校验；不执行用户脚本。
- 原生正则不保证线性执行时间；规则长度和节点限制不能消除回溯风险。请使用简单规则，避免嵌套重复等高开销模式，以免占用 Worker CPU。
- 对同名邮件头，任意一个值匹配即成立；外层 `not` 则要求全部不匹配。缺失邮件头为空列表，不匹配任何值。From 条件不是发件人真实性认证，不能代替 SPF/DKIM/DMARC。
- 最多 8 层、100 个节点，字段名最多 100 字符、匹配值最多 500 字符。前端仅检查编辑器支持的结构、字段和选项，不编译正则；正则语法与 flags 由后端在保存及检查规则时统一校验，错误会在页面提示，不会覆盖已保存配置。原“测试”不受过滤草稿影响。
- 解析或求值失败会跳过该 Webhook 并记录错误，不会因 `not` 而放行。旧配置无规则时仍使用原处理流程。原有 Body 变量及渲染方式不变。

启用附件移除时，沿用原流程重建邮件，再将生成的 From 还原为原邮件的全部 From 邮件头，保留原顺序；原邮件没有 From 时移除生成的这一行，不用 SMTP 信封地址覆盖。From 缺失或无效也照常移除附件，保证实际过滤与存储后的检查使用一致的 `from` 和 `header.From`。其余邮件头、主题和正文编码沿用原处理逻辑，不保证处理前后逐字一致；`to` 始终是实际投递地址。

### 文本操作符与大小写

在“过滤条件”的操作符下拉框直接选择匹配方式，不需要再勾选大小写开关：

| 忽略大小写（默认） | 区分大小写 | 含义 |
| --- | --- | --- |
| 等于 `equals` | 等于 (区分大小写) `equalsCaseSensitive` | 整个字段相等 |
| 包含 `contains` | 包含 (区分大小写) `containsCaseSensitive` | 字段中包含指定文本 |
| 开头匹配 `startsWith` | 开头匹配 (区分大小写) `startsWithCaseSensitive` | 字段以指定文本开头 |
| 结尾匹配 `endsWith` | 结尾匹配 (区分大小写) `endsWithCaseSensitive` | 字段以指定文本结尾 |

例如，邮件主题为 `DOWN service`，匹配值为 `down`：“包含”会匹配，“包含 (区分大小写)”不会匹配；将匹配值改为 `DOWN` 后，两种操作符都会匹配。可点击过滤条件下的“仅检查规则 → 指定 ID → 仅检查规则”验证，不会向 Webhook 发送请求。

JSON 与下拉框使用同一操作符，不需要额外的大小写选项。下面是“包含 (区分大小写)”的条件，可直接填入 JSON 编辑框：

```json
{ "field": "subject", "operator": "containsCaseSensitive", "value": "DOWN" }
```

文本操作符不接受 `options`。空匹配值合法，例如“等于”空字符串可匹配空正文。正则匹配使用 `options.flags`，忽略大小写时填写 `i`。

### 测试和复用

“仅检查规则”在过滤条件区域打开独立弹框，可选择“随机邮件 / 指定 ID”，只检查当前草稿是否匹配，不向 Webhook 发送请求，必须有真实邮件；指定 ID 仍检查邮箱归属。

原“测试”按钮与弹框保持原行为，独立选择邮件并真实发送配置的 Webhook，**不检查过滤条件**；即使条件不匹配或过滤草稿无效，也能测试连接和 Body。两种操作的邮件选择与加载状态互不影响。实际收信仍按已保存的规则决定是否推送。

独立的 POST `/api/webhook/check_filter` 和 `/admin/mail_webhook/check_filter` 只接收 `{ "filter": 规则, "mail_id": 可选邮件ID }`，返回 `{ "success": true, "matched": true/false }`。不需要 URL、Headers 或 Body，不发送请求，也不生成附件链接；不传 `filter` 表示全部匹配。必须存在真实邮件，邮箱接口只能读取当前邮箱的邮件。

设置保存、规则检查和发送测试的 JSON 解析异常由现有全局错误处理返回 500；合法 JSON 的请求结构无效时返回 400。保存和检查也会拒绝无效规则，不会覆盖已保存配置。

现有 `/api/webhook/test` 和 `/admin/mail_webhook/test` 接收配置及可选 `mail_id`，不读取或校验 `filter`，直接沿用原查询与发送逻辑；成功返回 `{ "success": true }`，发送失败响应保持原行为，不提供 `check_only` 参数。随机测试没有邮件时仍使用原测试内容；管理员测试的 `${to}` 仍为 `admin@test.com`。

后端通用模块 `worker/src/utils/filter.ts` 通过 `compileFilter(expression, isFieldAllowed, operators)` 编译并校验规则，返回接收字符串/字符串列表字段映射的匹配函数；扩展操作符只需注册参数编译函数。邮件字段映射和投递列表过滤放在 `common.ts` 原有 Webhook 处理函数旁，检查接口放在各自已有的 Webhook 设置 API 文件，路由直接引用。前端通用 `FilterEditor.vue` 接收 `v-model`、`fields` 和 `operators`（包括选项编辑配置），不依赖 Webhook API；已有 `WebhookComponent.vue` 直接配置字段、操作符和独立检查弹框，不增加 Webhook 专属 Filter 包装层。原发送测试函数与弹框不变。其他功能可提供自己的配置复用编辑器。

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
