/**
 * AI Email Extraction Module
 *
 * This module provides email content analysis using Cloudflare Workers AI.
 * It extracts important information like verification codes, authentication links,
 * service links, and subscription management links from email content.
 */

import { commonParseMail } from "../common";
import { getBooleanValue, getJsonSetting } from "../utils";
import { CONSTANTS } from "../constants";
import { Context } from "hono";
import type { AiExtractSettings } from "../admin_api/ai_extract_settings";

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
5. **Clean Extraction**: Return only the raw extracted content, no extra text

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
    const modelName = env.AI_EXTRACT_MODEL || '@cf/meta/llama-3.1-8b-instruct';

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
 * Main extraction function
 * Checks if AI extraction is enabled, processes the email content, and saves to database
 *
 * @param parsedEmailContext - The parsed email context
 * @param env - Cloudflare Workers environment bindings
 * @param message_id - The email message ID
 * @param address - The recipient email address
 * @returns Promise<void>
 */
export async function extractEmailInfo(
    parsedEmailContext: ParsedEmailContext,
    env: Bindings,
    message_id: string | null,
    address: string
): Promise<void> {
    try {
        // Check if AI extraction is enabled via environment variable
        if (!getBooleanValue(env.ENABLE_AI_EMAIL_EXTRACT)) {
            return;
        }

        // Ensure AI binding is available
        if (!env.AI) {
            console.error('AI binding not available');
            return;
        }

        // Check allowlist if enabled
        const aiSettings = await getJsonSetting<AiExtractSettings>(
            { env: env } as Context<HonoCustomType>,
            CONSTANTS.AI_EXTRACT_SETTINGS_KEY
        );

        if (aiSettings?.enableAllowList && aiSettings.allowList?.length > 0) {
            const isAllowed = aiSettings.allowList.some(pattern => {
                // Support wildcard matching
                if (pattern.includes('*')) {
                    // Escape special regex characters except *
                    const escapedPattern = pattern
                        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                        .replace(/\*/g, '.*');
                    const regex = new RegExp('^' + escapedPattern + '$');
                    return regex.test(address);
                }
                // Exact match
                return address === pattern;
            });

            if (!isAllowed) {
                console.log(`AI extraction skipped for ${address}: not in allowlist`);
                return;
            }
        }

        // Parse email to get content
        const parsedEmail = await commonParseMail(parsedEmailContext);
        const emailContent = parsedEmail?.text || parsedEmail?.html || "";

        if (!emailContent) {
            return;
        }

        // Truncate content if too long (max 4000 characters to avoid token limits)
        const truncatedContent = emailContent.length > 4000
            ? emailContent.substring(0, 4000) + '...[truncated]'
            : emailContent;

        const result = await extractWithCloudflareAI(truncatedContent, env);

        // If extraction found something useful, save it to database
        if (result.type !== 'none' && result.result) {
            const metadata = JSON.stringify({
                ai_extract: result,
                extracted_at: new Date().toISOString()
            });

            // Update the raw_mails record with metadata
            await env.DB.prepare(
                `UPDATE raw_mails SET metadata = ? WHERE message_id = ?`
            ).bind(metadata, message_id).run();

            console.log(`AI extraction completed for ${message_id}: ${result.type}`);
        }
    } catch (e) {
        console.error('AI email extraction error:', e);
    }
}

/**
 * Type definition for extraction result
 */
export type ExtractResult = {
    type: 'auth_code' | 'auth_link' | 'service_link' | 'subscription_link' | 'other_link' | 'none';
    result: string;
    result_text: string;
};
