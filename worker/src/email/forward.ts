import { Context } from "hono";

import { getEnvStringList, getJsonObjectValue, getJsonSetting } from "../utils";
import { EmailRuleSettings } from "../models";
import { CONSTANTS } from "../constants";

// 正则表达式最大长度限制，防止 ReDoS 攻击
const MAX_REGEX_PATTERN_LENGTH = 200;

/**
 * 安全地测试单个正则表达式
 */
function safeRegexTest(pattern: string, input: string): boolean {
    try {
        // 限制正则复杂度：最大长度限制
        if (pattern.length > MAX_REGEX_PATTERN_LENGTH) {
            console.warn("source pattern too long, skipped:", pattern.substring(0, 50) + "...");
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
 * 检查来源地址是否匹配正则规则
 */
function matchSourcePatterns(
    from: string,
    sourcePatterns: string[] | undefined | null,
    sourceMatchMode: 'any' | 'all' | undefined
): boolean {
    if (!sourcePatterns || sourcePatterns.length === 0) {
        // 未配置来源正则，默认匹配
        return true;
    }

    const matchMode = sourceMatchMode || 'any';

    if (matchMode === 'all') {
        // 全部匹配模式：所有正则都必须匹配
        return sourcePatterns.every(pattern => safeRegexTest(pattern, from));
    } else {
        // 任一匹配模式（默认）：任一正则匹配即可
        return sourcePatterns.some(pattern => safeRegexTest(pattern, from));
    }
}

/**
 * 全局转发：转发到 FORWARD_ADDRESS_LIST 中的所有地址
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
 * 规则转发：根据域名和来源地址正则规则转发
 */
async function forwardByRules(
    message: ForwardableEmailMessage,
    env: Bindings
): Promise<void> {
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

        for (const rule of allRules) {
            // 检查来源地址是否匹配正则
            if (!matchSourcePatterns(message.from, rule.sourcePatterns, rule.sourceMatchMode)) {
                continue;
            }

            // 检查目标地址是否匹配域名，并转发
            // 保持原始逻辑：每个匹配的 domain 都会触发一次转发
            if (rule.domains && rule.domains.length > 0) {
                for (const domain of rule.domains) {
                    if (message.to.endsWith(domain) && rule.forward) {
                        await message.forward(rule.forward);
                    }
                }
            } else {
                // 域名为空，转发所有邮件
                if (rule.forward) {
                    await message.forward(rule.forward);
                }
            }
        }
    } catch (error) {
        console.error("forward by rules error", error);
    }
}

/**
 * 执行所有转发逻辑
 */
async function forwardEmail(
    message: ForwardableEmailMessage,
    env: Bindings
): Promise<void> {
    // 全局转发
    await forwardToGlobalAddresses(message, env);

    // 规则转发
    await forwardByRules(message, env);
}

export {
    forwardEmail,
    forwardToGlobalAddresses,
    forwardByRules,
    matchSourcePatterns,
};
