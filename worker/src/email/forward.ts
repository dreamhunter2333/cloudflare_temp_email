import { Context } from "hono";

import { getDomains, getEnvStringList, getJsonObjectValue, getJsonSetting, getMailDomain, includesDomain, isDomainOrSubdomain, normalizeAddressDomain, normalizeDomain } from "../utils";
import { EmailRuleSettings } from "../models";
import { CONSTANTS } from "../constants";

type ReceiveMail = (message: ForwardableEmailMessage, onStored: () => void) => Promise<void>;

// 正则表达式最大长度限制，防止 ReDoS 攻击
const MAX_REGEX_PATTERN_LENGTH = 200;

/**
 * 安全地测试单个正则表达式
 */
function safeRegexTest(pattern: string, input: string): boolean {
    try {
        // 限制正则复杂度：最大长度限制
        if (pattern.length > MAX_REGEX_PATTERN_LENGTH) {
            console.warn("address pattern too long, skipped:", pattern.substring(0, 50) + "...");
            return false;
        }
        const regex = new RegExp(pattern, 'i');
        return regex.test(input);
    } catch (regexError) {
        console.error("regex test error for pattern:", pattern, regexError);
        return false;
    }
}

/**
 * 检查地址是否匹配正则规则
 */
function matchAddressPatterns(
    address: string,
    patterns: string[] | undefined | null,
    matchMode: 'any' | 'all' | undefined
): boolean {
    if (!patterns || patterns.length === 0) {
        // 未配置正则，默认匹配
        return true;
    }

    if (matchMode === 'all') {
        // 全部匹配模式：所有正则都必须匹配
        return patterns.every(pattern => safeRegexTest(pattern, address));
    } else {
        // 任一匹配模式（默认）：任一正则匹配即可
        return patterns.some(pattern => safeRegexTest(pattern, address));
    }
}

async function forwardToAddress(
    message: ForwardableEmailMessage,
    env: Bindings,
    rawEmail: string,
    target: string,
    receiveMail: ReceiveMail
): Promise<boolean> {
    const address = normalizeAddressDomain(target);
    if (address === normalizeAddressDomain(message.to)) return false;

    try {
        const domains = getDomains({ env } as Context<HonoCustomType>);
        if (!includesDomain(domains, getMailDomain(address))) {
            await message.forward(target);
            return true;
        }

        const rejections: string[] = [];
        const deliveryResult = { stored: false };
        const raw = new TextEncoder().encode(rawEmail);
        await receiveMail({
            from: message.from,
            to: address,
            headers: new Headers(message.headers),
            raw: new Response(raw).body!,
            rawSize: raw.byteLength,
            setReject: reason => { rejections.push(reason); },
            forward: message.forward.bind(message),
            reply: message.reply.bind(message),
        }, () => { deliveryResult.stored = true; });
        if (rejections.length > 0) {
            console.error("internal delivery rejected", address, rejections.join(", "));
            return false;
        }
        return deliveryResult.stored;
    } catch (error) {
        console.error("forward email error", target, error);
        return false;
    }
}

/**
 * 全局转发：FORWARD_ADDRESS_LIST 仅支持外部地址，通过 Cloudflare 转发，不走站内收件流程
 */
async function forwardToGlobalAddresses(
    message: ForwardableEmailMessage,
    env: Bindings
): Promise<void> {
    try {
        const forwardAddressList = getEnvStringList(env.FORWARD_ADDRESS_LIST);
        for (const forwardAddress of forwardAddressList) {
            await message.forward(forwardAddress);
        }
    } catch (error) {
        console.error("forward email error", error);
    }
}

/**
 * 规则转发：根据域名、来源地址和收件人地址正则规则转发
 */
async function forwardByRules(
    message: ForwardableEmailMessage,
    env: Bindings,
    rawEmail: string,
    receiveMail: ReceiveMail
): Promise<{ deleteOriginal: boolean }> {
    const deleteOriginalResults: boolean[] = [];
    try {
        // 获取环境变量配置
        const subdomainForwardAddressList = getJsonObjectValue<SubdomainForwardAddressList[]>(
            env.SUBDOMAIN_FORWARD_ADDRESS_LIST
        ) || [];

        // 获取数据库配置
        const emailRuleSettings = await getJsonSetting<EmailRuleSettings>(
            { env: env } as Context<HonoCustomType>,
            CONSTANTS.EMAIL_RULE_SETTINGS_KEY
        );

        // 合并两个配置，env 里的配置优先级更高
        const allRules = [
            ...(subdomainForwardAddressList || []),
            ...(emailRuleSettings?.emailForwardingList || []),
        ];

        const messageDomain = getMailDomain(message.to);
        for (const rule of allRules) {
            // 检查来源地址是否匹配正则
            if (!matchAddressPatterns(message.from, rule.sourcePatterns, rule.sourceMatchMode)) {
                continue;
            }
            if (!matchAddressPatterns(message.to, rule.recipientPatterns, rule.recipientMatchMode)) {
                continue;
            }

            // 检查目标地址是否匹配域名，并转发
            // 保持原始逻辑：每个匹配的 domain 都会触发一次转发
            if (rule.domains && rule.domains.length > 0) {
                const normalizedDomains = rule.domains.map(normalizeDomain);
                if (normalizedDomains.some(domain => domain.length === 0)) {
                    if (rule.forward) {
                        const success = await forwardToAddress(message, env, rawEmail, rule.forward, receiveMail);
                        deleteOriginalResults.push(success && rule.deleteOriginal === true);
                    }
                    continue;
                }

                for (const normalizedDomain of normalizedDomains) {
                    if (isDomainOrSubdomain(messageDomain, normalizedDomain) && rule.forward) {
                        const success = await forwardToAddress(message, env, rawEmail, rule.forward, receiveMail);
                        deleteOriginalResults.push(success && rule.deleteOriginal === true);
                    }
                }
            } else {
                // 域名为空，转发所有邮件
                if (rule.forward) {
                    const success = await forwardToAddress(message, env, rawEmail, rule.forward, receiveMail);
                    deleteOriginalResults.push(success && rule.deleteOriginal === true);
                }
            }
        }
    } catch (error) {
        console.error("forward by rules error", error);
    }
    const deleteOriginal = deleteOriginalResults.some(Boolean);
    return { deleteOriginal };
}

/**
 * 执行所有转发逻辑
 */
async function forwardEmail(
    message: ForwardableEmailMessage,
    env: Bindings,
    rawEmail: string,
    receiveMail: ReceiveMail
): Promise<{ deleteOriginal: boolean }> {
    // 全局转发
    await forwardToGlobalAddresses(message, env);

    // 规则转发
    const ruleResult = await forwardByRules(message, env, rawEmail, receiveMail);
    return {
        deleteOriginal: ruleResult.deleteOriginal,
    };
}

export {
    forwardEmail,
    forwardToGlobalAddresses,
    forwardByRules,
    matchAddressPatterns,
};
