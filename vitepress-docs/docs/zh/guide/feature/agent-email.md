# AI Agent 使用临时邮箱

面向 OpenClaw / Codex / Cursor 等 AI Agent，让它们用用户提供的 `Address JWT + API 地址`直接消费临时邮箱：列收件箱、取单封、提取验证码/魔法链接。

## 前提条件

用户需要先在浏览器中打开前端页面（如 `https://mail.example.com`），**创建或登录一个邮箱地址**。这一步可能需要通过 Turnstile 人机验证，Agent 无法自动完成。

创建/登录成功后，**Address JWT** 会显示在前端界面上，可直接复制。用户需要提供给 Agent：

1. **Address JWT** — 从前端界面复制
2. **API 地址** — 与前端同源，如 `https://mail.example.com`
3. *(可选)* **站点密码** — 仅当部署启用了 `x-custom-auth` 时需要

### 凭证持久化

为避免每次都要输入，Agent 会将凭证保存到 `~/.cf-temp-mail/credentials.json`：

```json
{
  "base": "https://mail.example.com",
  "jwt": "<ADDRESS_JWT>",
  "site_password": ""
}
```

首次使用时如果文件存在则直接读取，不存在则向用户索要后保存。每次请求前通过 `GET /api/settings` 校验 JWT，若返回 `401` 则提示用户 JWT 已过期并更新文件。

## 为什么需要 `parsed_mail` API

`/api/mails` 与 `/api/mail/:id` 按设计返回原始 RFC822（`raw` 字段），Agent 侧需要自己解析 MIME 才能拿到 `subject`/`text`/`html`。

为方便 Agent 直接消费，项目新增了**服务端解析**的只读接口，复用前端同款的 `postal-mime` 解析逻辑：

| 任务         | 方法 | 路径                                 | 返回                                      |
| ------------ | ---- | ------------------------------------ | ----------------------------------------- |
| 地址信息     | GET  | `/api/settings`                      | `{ address, send_balance }`               |
| 列出解析邮件 | GET  | `/api/parsed_mails?limit=&offset=`   | `{ results: [parsedMail], count }`        |
| 取单封解析   | GET  | `/api/parsed_mail/:id`               | `parsedMail`                              |

`limit` 范围 `1..100`，`offset` 从 0 开始。

`parsedMail` 结构：

```json
{
  "id": 42,
  "message_id": "<...>",
  "source": "noreply@foo.com",
  "to": "abc@yourdomain.com",
  "created_at": "2026-04-21 10:00:00",
  "sender":  "Foo <noreply@foo.com>",
  "subject": "Your code is 123456",
  "text":    "Your code is 123456\n",
  "html":    "<p>Your code is <b>123456</b></p>",
  "attachments": [
    { "filename": "a.pdf", "mimeType": "application/pdf", "disposition": "attachment", "size": 12345 }
  ]
}
```

**附件二进制不包含**在 `parsed_*` 响应里，只有元数据。需要原始字节时再退回 `/api/mail/:id` 自己解析。

## 必要的请求头

- `Authorization: Bearer <JWT>` — 所有 `/api/*` 请求必须携带
- `x-custom-auth: <SITE_PASSWORD>` — 仅当站点启用了私有密码
- `x-lang: en` 或 `zh` — 可选，报错信息语言

::: warning 不要把 Address JWT 当 User JWT 用
Address JWT 走 `Authorization: Bearer`，用户 JWT 走 `x-user-token`，两种凭证不可混用，否则返回 `401 InvalidAddressCredentialMsg`。
:::

## 示例

### 1. 自检 JWT

```bash
curl -s "$BASE/api/settings" -H "Authorization: Bearer $JWT"
# → { "address": "abc123@example.com", "send_balance": 0 }
```

返回 `401` 说明 JWT 错/过期/和 `BASE` 不匹配，请用户重新提供。

### 2. 列表（解析后）

```bash
curl -s "$BASE/api/parsed_mails?limit=20&offset=0" \
  -H "Authorization: Bearer $JWT"
```

### 3. 发送邮件

需要 `send_balance > 0`（通过 `/api/settings` 查看），且部署方已配置发送方式（Resend / SMTP / Cloudflare Email Routing binding）。

| 任务             | 方法   | 路径                            | 请求体 / 返回                              |
| ---------------- | ------ | ------------------------------- | ------------------------------------------ |
| 申请发信权限     | POST   | `/api/request_send_mail_access` | `{}` → `{ status: "ok" }`                 |
| 发送邮件         | POST   | `/api/send_mail`                | `sendMailBody` → `{ status: "ok" }`       |
| 列出已发送       | GET    | `/api/sendbox?limit=&offset=`   | `{ results: [...], count }`               |
| 删除已发送       | DELETE | `/api/sendbox/:id`              | `{ success: true }`                       |

`sendMailBody`：

```json
{
  "from_name": "My Name",
  "to_mail": "recipient@example.com",
  "to_name": "Recipient",
  "subject": "Hello",
  "content": "<p>Hi</p>",
  "is_html": true
}
```

`from_name` 和 `to_name` 可选（空字符串即可）。`is_html: false` 发送纯文本。

```bash
curl -s -X POST "$BASE/api/send_mail" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"from_name":"","to_mail":"someone@example.com","to_name":"","subject":"Test","content":"Hello","is_html":false}'
```

## 回退方案：本地解析 raw

若 `/api/parsed_mails` / `/api/parsed_mail/:id` 返回 `404`（较早部署未包含）或解析异常，回退到 `/api/mails` / `/api/mail/:id` 取 `raw`，**在本地按前端同款策略解析**：`mail-parser-wasm` 优先，失败时退回 `postal-mime`（实现参见 `frontend/src/utils/email-parser.js`）。

```bash
npm i mail-parser-wasm postal-mime
```

```js
async function parseRaw(raw) {
    try {
        const { parse_message } = await import('mail-parser-wasm');
        const m = parse_message(raw);
        if (m?.subject && (m?.body_html || m?.text)) {
            return {
                sender: m.sender || '',
                subject: m.subject || '',
                text: m.text || '',
                html: m.body_html || '',
                attachments: (m.attachments || []).map(a => ({
                    filename: a.filename || a.content_id || '',
                    mimeType: a.content_type || '',
                    size: a.content?.length ?? 0,
                })),
            };
        }
    } catch { /* fall through */ }
    const PostalMime = (await import('postal-mime')).default;
    const p = await PostalMime.parse(raw);
    const sender = p.from?.name && p.from?.address
        ? `${p.from.name} <${p.from.address}>`
        : (p.from?.address || '');
    return {
        sender,
        subject: p.subject || '',
        text: p.text || '',
        html: p.html || '',
        attachments: (p.attachments || []).map(a => ({
            filename: a.filename || a.contentId || '',
            mimeType: a.mimeType || '',
            size: a.content?.length ?? 0,
        })),
    };
}

const row = await (await fetch(`${BASE}/api/mail/${id}`, {
    headers: { Authorization: `Bearer ${JWT}` },
})).json();
const parsed = await parseRaw(row.raw);
```

需要附件字节时直接用 `postal-mime`——`parsed.attachments[i].content` 是 `Uint8Array`。

## 轮询纪律

- 初始 3s 起步，指数退避，封顶 10s
- 按 `id` 去重
- 不要快于每秒 1 次
- 遇到 `429` 必须 sleep 后重试

## `cf-temp-mail-agent-mail` Skill

仓库内置了 Agent 技能：`skills/cf-temp-mail-agent-mail/`，把上述流程封装成 AI Agent 可直接调用的形式，支持 Claude Code / Cursor / Codex / OpenClaw 等。

安装方式任选其一：

```bash
# 方式 1：npx skills（推荐，自动适配多种 agent）
npx skills add dreamhunter2333/cloudflare_temp_email --skill cf-temp-mail-agent-mail
# 加 -g 安装到全局
npx skills add dreamhunter2333/cloudflare_temp_email --skill cf-temp-mail-agent-mail -g

# 方式 2：npx degit 拷贝到你的 agent skills 目录
npx degit dreamhunter2333/cloudflare_temp_email/skills/cf-temp-mail-agent-mail <your-agent-skills-dir>/cf-temp-mail-agent-mail

# 方式 3：克隆后复制
git clone --depth 1 https://github.com/dreamhunter2333/cloudflare_temp_email.git /tmp/cf-temp-mail
cp -r /tmp/cf-temp-mail/skills/cf-temp-mail-agent-mail <your-agent-skills-dir>/
```

详情见 [SKILL.md](https://github.com/dreamhunter2333/cloudflare_temp_email/blob/main/skills/cf-temp-mail-agent-mail/SKILL.md)。

## 常见错误

- `401 InvalidAddressCredentialMsg` — JWT 错/过期/header 填错，让用户重新提供
- `401 CustomAuthPasswordMsg` — 站点启用了 `x-custom-auth`，附带 `SITE_PASSWORD`
- `400 InvalidLimitMsg` / `InvalidOffsetMsg` — `limit` 必须 1..100，`offset ≥ 0`
- `429` — 被限流，退避后重试
