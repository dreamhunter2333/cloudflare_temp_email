# AI 邮件识别

> [!NOTE]
> 此功能从 v1.1.0 版本开始支持
>
> 本功能参考自 [Alle 项目](https://github.com/bestruirui/Alle/blob/62e74629ded0c7966c12d4e1c54f0bcc2e54f12c/src/lib/email/extract.ts#L54)

## 功能说明

AI 邮件识别功能使用 Cloudflare Workers AI 自动分析收到的邮件内容，智能提取重要信息，包括：

- **验证码** (auth_code) - OTP、安全码、确认码等
- **认证链接** (auth_link) - 登录、验证、激活、重置密码链接
- **服务链接** (service_link) - GitHub、GitLab、部署通知等服务相关链接
- **订阅管理链接** (subscription_link) - 退订、管理订阅等链接
- **其他链接** (other_link) - 其他有价值的链接

提取结果会自动保存到数据库的 `metadata` 字段中，前端可以直接展示提取的验证码或链接。

## 配置变量

| 变量名                    | 类型      | 说明                                                                                                                           | 示例                             |
| ------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| `ENABLE_AI_EMAIL_EXTRACT` | 文本/JSON | 是否启用 AI 邮件识别功能                                                                                                       | `true`                           |
| `AI_EXTRACT_MODEL`        | 文本      | AI 模型名称，从[支持 JSON 模式的模型](https://developers.cloudflare.com/workers-ai/features/json-mode/#supported-models)中选择 | `@cf/meta/llama-3.1-8b-instruct` |

## 内容长度限制

为避免 AI 模型 token 限制，邮件内容最大处理长度为 **4000 字符**。超过此长度的邮件内容将被截断后再进行 AI 分析。

## Workers AI 绑定

需要在 `wrangler.toml` 中配置 Workers AI 绑定：

```toml
[ai]
binding = "AI"
```

或在 Cloudflare Dashboard 的 Worker 设置中添加：
- **Variable name**: `AI`
- **Type**: Workers AI

## 地址白名单（可选）

为了控制成本和资源使用，可以在 Admin 控制台的 **AI 提取设置** 页面配置地址白名单：

### 配置说明

- **未启用白名单**：所有邮箱地址都可使用 AI 提取功能
- **启用白名单**：仅白名单中的邮箱地址会进行 AI 提取

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

此配置将只对以下邮箱进行 AI 提取：
- `user@example.com`（精确匹配）
- 所有 `@mydomain.com` 的邮箱（如 `test@mydomain.com`、`admin@mydomain.com`）
- 所有 `admin` 开头的 `@company.com` 邮箱（如 `admin@company.com`、`admin123@company.com`）
