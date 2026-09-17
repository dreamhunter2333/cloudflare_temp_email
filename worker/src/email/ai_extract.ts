/**
 * AI Email Extraction Module
 *
 * This module provides email content analysis, either with built-in local rules
 * (verification codes only) or with Cloudflare Workers AI, which also extracts
 * authentication links, service links, and subscription management links.
 */

import { commonParseMail } from "../common";
import { extractCode, joinSubjectAndBody } from "./extract_code";
import { ExtractMode, resolveExtractMode } from "./extract_mode";
import { getBooleanValue, getJsonSetting } from "../utils";
import { CONSTANTS } from "../constants";
import { Context } from "hono";
import type { AiExtractSettings } from "../admin_api/ai_extract_settings";
import type { ExtractResult } from "../models";

// AI Prompt for email analysis
const PROMPT = `
You are an expert email analyzer. Your task is to first UNDERSTAND the email content, then EXTRACT the most relevant information based on priority.

# Step 1: UNDERSTAND the Email
Read the entire email carefully and determine its:
- Overall purpose (verification, marketing, notification, etc.)
- Key context and situation
- What the sender wants the recipient to do
- Any security-sensitive content

# Step 2: EXTRACT Based on Priority
After understanding, extract the most important item according to this priority order:

**Priority 1: auth_code (Authentication Code)**
- Numeric or alphanumeric codes used for login verification
- Keywords: verification code, OTP, security code, confirmation code, auth code, 验证码, 校验码
- Extract ONLY the code itself (remove spaces, hyphens, etc.)
- Example: "123456" from "Your verification code is 123-456"

**Priority 2: auth_link (Authentication Link)**
- Links used for login, email verification, account activation, or password reset
- Keywords: verify, confirm, activate, login, signin, signup, reset, 验证, 激活, 登录
- Must be a real, complete URL (http:// or https://)
- Never fabricate or infer links that don't exist in the content
- Example: "https://example.com/verify?token=abc123"

**Priority 3: service_link (Service Link)**
- Links related to specific services or actions
- Keywords: commit, pull request, issue, repository, deployment, GitHub, GitLab, code review
- Real URLs for technical or service-related notifications
- Example: GitHub commit link, deployment notification link

**Priority 4: subscription_link (Subscription Management Link)**
- Links for managing email subscriptions, typically unsubscribe
- Keywords: unsubscribe, opt-out, manage preferences, 退订, 取消订阅
- Usually found at the bottom of marketing emails
- Real URLs for subscription control

**Priority 5: other_link (Other Valuable Link)**
- Any other link that might be useful or important
- Only extract if no higher-priority items exist
- Must be a real, complete URL from the content

**Priority 6: none**
- No relevant codes, links, or valuable content found
- Email appears to be plain text or irrelevant

# Special Case: Markdown Link Format
If the extracted content is in markdown link format [text](url):

- Extract the text inside the brackets as result_text
- When brackets are empty, analyze the email context and language
- Generate a concise, meaningful description (2-5 words) for result_text
- Match the email's language (Chinese → Chinese description, English → English)

# Critical Rules
1. **Understand First**: Always analyze the email's purpose before extracting
2. **Single Selection**: Choose ONLY ONE type based on the highest priority match
3. **Real Data Only**: Never invent, guess, or fabricate content
4. **Complete URLs**: Links must be full, valid URLs as they appear in the email
5. **No Domain Modification**: Never modify, rewrite, or substitute URL domains. If the exact URL domain is uncertain, return none
6. **Clean Extraction**: Return only the raw extracted content, no extra text

# Output Format (JSON only)
{
  "type": "auth_code|auth_link|service_link|subscription_link|other_link|none",
  "result": "the extracted code/link OR empty string",
  "result_text": "the display text from markdown-format links."
}

IMPORTANT: Return ONLY the JSON, no explanations or additional text.
`;

/**
 * Extract important information from email content using Cloudflare Workers AI
 *
 * @param content - The email content to analyze (plain text or HTML)
 * @param env - Cloudflare Workers environment bindings
 * @returns Promise<ExtractResult> - The extracted information
 */
async function extractWithCloudflareAI(
    content: string,
    env: Bindings
): Promise<ExtractResult> {
    // Get the AI model name from environment variable or use default
    const modelName = env.AI_EXTRACT_MODEL || '@cf/meta/llama-3.1-8b-instruct-fast';

    const result = await env.AI.run(modelName as keyof AiModels, {
        messages: [
            { role: 'system', content: PROMPT },
            { role: 'user', content },
        ],
        response_format: {
            type: 'json_schema',
            json_schema: {
                type: 'object',
                properties: {
                    type: {
                        type: 'string',
                        enum: ['auth_code', 'auth_link', 'service_link', 'subscription_link', 'other_link', 'none']
                    },
                    result: { type: 'string' },
                    result_text: { type: 'string' },
                },
                required: ['type', 'result', 'result_text'],
            },
        },
        stream: false,
    });

    // @ts-expect-error result.response
    const response = result.response;

    if (typeof response === 'string') {
        return JSON.parse(response) as ExtractResult;
    }

    if (response && typeof response === 'object') {
        return response as ExtractResult;
    }

    throw new Error('Unexpected response format from Cloudflare AI');
}

/**
 * Persist an extraction result to the raw_mails metadata column.
 * Shared by the Workers AI mode and the local rule mode.
 *
 * @param env - Cloudflare Workers environment bindings
 * @param message_id - The email message ID
 * @param result - The extraction result to persist
 */
async function saveExtractMetadata(
    env: Bindings,
    message_id: string | null,
    result: ExtractResult
): Promise<void> {
    try {
        const metadata = JSON.stringify({
            ai_extract: result,
            extracted_at: new Date().toISOString()
        });

        // Update the raw_mails record with metadata
        await env.DB.prepare(
            `UPDATE raw_mails SET metadata = ? WHERE message_id = ?`
        ).bind(metadata, message_id).run();
    } catch (e) {
        console.error('AI extraction metadata save error:', e);
    }
}

function decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: "'",
        nbsp: ' ',
    };

    const decodeCodePoint = (value: number, fallback: string) => {
        if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) {
            return fallback;
        }
        return String.fromCodePoint(value);
    };

    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (match, entity) => {
        const normalized = entity.toLowerCase();
        if (normalized.startsWith('#x')) {
            const value = Number.parseInt(normalized.slice(2), 16);
            return decodeCodePoint(value, match);
        }
        if (normalized.startsWith('#')) {
            const value = Number.parseInt(normalized.slice(1), 10);
            return decodeCodePoint(value, match);
        }
        return entities[normalized] ?? match;
    });
}

function htmlToTextForAi(html: string): string {
    return decodeHtmlEntities(
        html
            .replace(/<\s*(script|style|head|svg)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
            .replace(/<!--[\s\S]*?-->/g, ' ')
            .replace(/<a\b[^>]*\bhref=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, ' $3 $2 ')
            .replace(/<\s*br\s*\/?>/gi, '\n')
            .replace(/<\/\s*(p|div|tr|td|th|li|table|section|article|header|footer|h[1-6])\s*>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
    )
        .replace(/[ \t\r\f\v]+/g, ' ')
        .replace(/\n\s+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function getEmailContentForExtract(parsedEmail: Awaited<ReturnType<typeof commonParseMail>>): string {
    if (parsedEmail?.text) {
        return parsedEmail.text;
    }

    if (!parsedEmail?.html) {
        return "";
    }

    return htmlToTextForAi(parsedEmail.html) || parsedEmail.html;
}

function isAddressInAiAllowlist(settings: AiExtractSettings | null | undefined, address: string): boolean {
    if (!settings?.enableAllowList) return true;
    if (!Array.isArray(settings.allowList) || settings.allowList.length === 0) return false;

    return settings.allowList.some(pattern => {
        if (typeof pattern !== 'string') return false;
        if (!pattern.includes('*')) return address === pattern;
        const escapedPattern = pattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*');
        return new RegExp('^' + escapedPattern + '$').test(address);
    });
}

/**
 * Main extraction function
 * Checks if extraction is enabled, processes the email content, and saves to database.
 * `AI_EXTRACT_MODE` selects the preferred extractor:
 * - `local` (default): built-in rules, verification codes only, content never sent to AI
 * - `ai`: Cloudflare Workers AI, verification codes and links; if the address is not
 *   in the AI allowlist, only the AI call is skipped and local code extraction still runs
 *
 * @param parsedEmailContext - The parsed email context
 * @param env - Cloudflare Workers environment bindings
 * @param message_id - The email message ID
 * @param address - The recipient email address
 * @returns Promise<ExtractResult | null>
 */
export async function extractEmailInfo(
    parsedEmailContext: ParsedEmailContext,
    env: Bindings,
    message_id: string | null,
    address: string
): Promise<ExtractResult | null> {
    try {
        // Check if extraction is enabled via environment variable
        if (!getBooleanValue(env.ENABLE_AI_EMAIL_EXTRACT)) {
            return null;
        }

        const mode = resolveExtractMode(env.AI_EXTRACT_MODE);
        if (!mode) {
            console.error(`Email extraction skipped: unsupported AI_EXTRACT_MODE "${env.AI_EXTRACT_MODE}", expected "local" or "ai"`);
            return null;
        }
        const aiSettings = await getJsonSetting<AiExtractSettings>(
            { env: env } as Context<HonoCustomType>,
            CONSTANTS.AI_EXTRACT_SETTINGS_KEY
        );
        const isAiAllowed = isAddressInAiAllowlist(aiSettings, address);

        // Parse email to get content (shared by both modes)
        const parsedEmail = await commonParseMail(parsedEmailContext);
        const emailContent = getEmailContentForExtract(parsedEmail);

        const runLocalExtract = async () => {
            const localContent = joinSubjectAndBody(parsedEmail?.subject, emailContent);
            const code = localContent ? extractCode(localContent) : null;
            if (!code) return null;
            const result: ExtractResult = { type: 'auth_code', result: code, result_text: '' };
            await saveExtractMetadata(env, message_id, result);
            console.log(`Local code extraction completed for ${message_id}`);
            return result;
        };

        // Local mode: built-in rules only, mail content is never sent to any AI model.
        // The subject is included because many services put the code there.
        // Telegram / webhook reuse the same ExtractResult.
        if (mode === ExtractMode.Local) {
            return await runLocalExtract();
        }

        if (!isAiAllowed) {
            console.log(`Workers AI extraction skipped for ${address}: not in AI allowlist; trying local code extraction`);
            return await runLocalExtract();
        }

        if (!env.AI) {
            console.error('Email extraction skipped: AI_EXTRACT_MODE is "ai" but the Workers AI binding "AI" is not configured');
            return null;
        }

        if (!emailContent) {
            return null;
        }

        // Truncate content if too long (max 4000 characters to avoid token limits)
        const truncatedContent = emailContent.length > 4000
            ? emailContent.substring(0, 4000) + '...[truncated]'
            : emailContent;

        const result = await extractWithCloudflareAI(truncatedContent, env);

        // If extraction found something useful, save it to database
        if (result.type !== 'none' && result.result) {
            await saveExtractMetadata(env, message_id, result);
            console.log(`AI extraction completed for ${message_id}: ${result.type}`);
        }
        return result;
    } catch (e) {
        console.error('AI email extraction error:', e);
        return null;
    }
}
