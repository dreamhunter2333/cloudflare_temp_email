# AI Email Recognition

> [!NOTE]
> This feature is supported from version v1.1.0
>
> This feature is inspired by the [Alle project](https://github.com/bestruirui/Alle/blob/62e74629ded0c7966c12d4e1c54f0bcc2e54f12c/src/lib/email/extract.ts#L54)

## Features

The email recognition feature automatically analyzes incoming email content and extracts important information. It supports two mutually exclusive modes:

| Mode | Extracts | Privacy | Requires |
| ---- | -------- | ------- | -------- |
| `local` (default) | **Verification codes** (auth_code) only | Built-in rules run inside the Worker; mail content is **never sent to any AI model** | Nothing, zero cost |
| `ai` | Verification codes, auth links, service links, subscription links, other links | Mail content is sent to the Workers AI model in your Cloudflare account | Workers AI binding |

Types recognized in `ai` mode:

- **Verification Code** (auth_code) - OTP, security code, confirmation code, etc.
- **Authentication Link** (auth_link) - Login, verify, activate, password reset links
- **Service Link** (service_link) - GitHub, GitLab, deployment notifications and other service-related links
- **Subscription Link** (subscription_link) - Unsubscribe, manage subscription links
- **Other Link** (other_link) - Other valuable links

Extraction results are automatically saved to the `metadata` field in the database, the frontend can directly display extracted verification codes or links, and Telegram pushes and webhook placeholders reuse the same result.

## Configuration Variables

| Variable Name              | Type      | Description                                                                                                                      | Example                          |
| -------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `ENABLE_AI_EMAIL_EXTRACT`  | Text/JSON | Whether to enable email recognition (master switch, required by both modes)                                                        | `true`                           |
| `AI_EXTRACT_MODE`          | Text      | Recognition mode: `local` uses built-in rules only, `ai` uses Workers AI only. Defaults to `local` when unset; any other value logs an error and skips recognition | `local` |
| `AI_EXTRACT_MODEL`         | Text      | `ai` mode only. AI model name, choose from [models supporting JSON mode](https://developers.cloudflare.com/workers-ai/features/json-mode/#supported-models) | `@cf/meta/llama-3.1-8b-instruct-fast` |

> [!WARNING] Upgrading from older versions
> Older versions automatically used AI recognition whenever a Workers AI binding was configured. Now, when `AI_EXTRACT_MODE` is unset, local rules are used by default. To keep using AI recognition, explicitly set `AI_EXTRACT_MODE = "ai"`.

The two modes **never fall back to each other**:

- `local` mode never calls AI, even if a Workers AI binding is configured
- `ai` mode logs an error and skips recognition for that mail when the Workers AI binding is missing or the model call fails; it does not switch to local rules

## Local Rule Mode (local)

- Extracts **verification codes** (`auth_code`) only; links are not extracted
- Zero dependency, zero cost, runs locally inside the Worker; mail content never leaves the Worker
- Supports common formats in English, Chinese, Japanese and Korean, e.g. `验证码：123456`, `123456 is your Instagram code`, `認証コードは 123456 です`, `인증번호 [123456]`, `G-123456 is your Google verification code`
- Supports grouped codes (e.g. `123-456`, `591 204`); separators and letter prefixes such as `G-` are removed from the result
- Rejects years (e.g. `2026`) and `YYYYMMDD` dates, and ignores promo codes, zip codes and other non-verification codes
- Without an explicit keyword, a number is only recognized in a verification-looking mail when it is **on its own line** or right after "use / enter / 输入", so order numbers, hotlines and zip codes are not mistaken for codes

## AI Mode (ai)

We recommend `@cf/meta/llama-3.1-8b-instruct-fast` as the default model because it supports the JSON Mode used by this feature, and Cloudflare says `-fast` variants will remain active. The cheaper `@cf/meta/llama-3.1-8b-instruct-fp8-fast` is not currently listed as a JSON Mode supported model, so it is not recommended for this feature. Cloudflare's newer recommended model `@cf/zai-org/glm-4.7-flash` is suitable for multilingual scenarios, but confirm structured JSON output support in your account/region before using it for this feature. The previous default model `@cf/meta/llama-3.1-8b-instruct` will be deprecated by Cloudflare on 2026-05-30 and is no longer recommended.

### Content Length Limit

To avoid AI model token limits, the maximum email content length for processing is **4000 characters**. Email content exceeding this limit will be truncated before AI analysis.

### Workers AI Binding

Configure Workers AI binding in `wrangler.toml`:

```toml
AI_EXTRACT_MODE = "ai"

[ai]
binding = "AI"
```

Or add in Cloudflare Dashboard Worker settings:
- **Variable name**: `AI`
- **Type**: Workers AI

## Address Allowlist (Optional)

To control costs and resource usage, you can configure an address allowlist in the Admin console's **AI Extract Settings** page (applies to both `local` and `ai` modes):

### Configuration

- **Allowlist Disabled**: AI extraction will process all email addresses
- **Allowlist Enabled**: AI extraction will only process addresses in the allowlist

### Allowlist Format

One address per line, supporting wildcard `*` to match any characters:

- **Exact Match**: `user@example.com` - Only matches this specific email
- **Domain Wildcard**: `*@example.com` - Matches all emails under example.com domain
- **User Wildcard**: `admin*@example.com` - Matches emails starting with admin
- **Wildcard Anywhere**: `*test*@example.com` - Matches emails containing test
- **Multiple Wildcards**: `admin*@*.com` - Matches emails starting with admin under any .com domain

### Configuration Example

```text
user@example.com
*@mydomain.com
admin*@company.com
```

This configuration will only perform AI extraction for:
- `user@example.com` (exact match)
- All emails under `@mydomain.com` (e.g., `test@mydomain.com`, `admin@mydomain.com`)
- All emails starting with `admin` under `@company.com` (e.g., `admin@company.com`, `admin123@company.com`)
