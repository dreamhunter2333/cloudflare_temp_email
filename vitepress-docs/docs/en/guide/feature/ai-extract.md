# AI Email Recognition

> [!NOTE]
> This feature is supported from version v1.1.0
>
> This feature is inspired by the [Alle project](https://github.com/bestruirui/Alle/blob/62e74629ded0c7966c12d4e1c54f0bcc2e54f12c/src/lib/email/extract.ts#L54)

## Features

The AI email recognition feature uses Cloudflare Workers AI to automatically analyze incoming email content and intelligently extract important information, including:

- **Verification Code** (auth_code) - OTP, security code, confirmation code, etc.
- **Authentication Link** (auth_link) - Login, verify, activate, password reset links
- **Service Link** (service_link) - GitHub, GitLab, deployment notifications and other service-related links
- **Subscription Link** (subscription_link) - Unsubscribe, manage subscription links
- **Other Link** (other_link) - Other valuable links

Extraction results are automatically saved to the `metadata` field in the database, and the frontend can directly display extracted verification codes or links.

## Configuration Variables

| Variable Name              | Type      | Description                                                                                                                      | Example                          |
| -------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `ENABLE_AI_EMAIL_EXTRACT`  | Text/JSON | Whether to enable AI email recognition feature                                                                                   | `true`                           |
| `AI_EXTRACT_MODEL`         | Text      | AI model name, choose from [models supporting JSON mode](https://developers.cloudflare.com/workers-ai/features/json-mode/#supported-models) | `@cf/meta/llama-3.1-8b-instruct-fast` |

We recommend `@cf/meta/llama-3.1-8b-instruct-fast` as the default model because it supports the JSON Mode used by this feature, and Cloudflare says `-fast` variants will remain active. The cheaper `@cf/meta/llama-3.1-8b-instruct-fp8-fast` is not currently listed as a JSON Mode supported model, so it is not recommended for this feature. Cloudflare's newer recommended model `@cf/zai-org/glm-4.7-flash` is suitable for multilingual scenarios, but confirm structured JSON output support in your account/region before using it for this feature. The previous default model `@cf/meta/llama-3.1-8b-instruct` will be deprecated by Cloudflare on 2026-05-30 and is no longer recommended.

## Content Length Limit

To avoid AI model token limits, the maximum email content length for processing is **4000 characters**. Email content exceeding this limit will be truncated before AI analysis.

## Workers AI Binding

Configure Workers AI binding in `wrangler.toml`:

```toml
[ai]
binding = "AI"
```

Or add in Cloudflare Dashboard Worker settings:
- **Variable name**: `AI`
- **Type**: Workers AI

## Fallback Without a Workers AI Binding

If `ENABLE_AI_EMAIL_EXTRACT` is enabled but **no Workers AI binding is configured** (e.g. a self-hosted deployment without Workers AI), the system automatically falls back to a built-in **regex verification-code extractor**:

- Extracts **verification codes** (`auth_code`) only; links are not extracted (link extraction requires AI)
- Zero dependency, zero cost, runs locally inside the Worker
- Supports common verification-code formats in English, Chinese, Japanese and Korean
- Rejects years (e.g. `2026`) and `YYYYMMDD` dates to reduce false positives
- Results are written to `metadata` and reuse the same Telegram / webhook placeholders (`aiExtractType` is `auth_code` in this case)

When a Workers AI binding is configured, AI extraction is still preferred (recognizing both codes and links) and this fallback does not apply.

## Address Allowlist (Optional)

To control costs and resource usage, you can configure an address allowlist in the Admin console's **AI Extract Settings** page:

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
