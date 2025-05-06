import { Context } from "hono";

import { getEnvStringList, getJsonObjectValue } from "../utils";
import { sendMailToTelegram } from "../telegram_api";
import { auto_reply } from "./auto_reply";
import { isBlocked } from "./black_list";
import { triggerWebhook, triggerAnotherWorker, commonParseMail } from "../common";
import { check_if_junk_mail } from "./check_junk";
import { remove_attachment_if_need } from "./check_attachment";


async function email(message: ForwardableEmailMessage, env: Bindings, ctx: ExecutionContext) {
    if (await isBlocked(message.from, env)) {
        message.setReject("Reject from address");
        console.log(`Reject message from ${message.from} to ${message.to}`);
        return;
    }
    const rawEmail = await new Response(message.raw).text();
    const parsedEmailContext: ParsedEmailContext = {
        rawEmail: rawEmail
    };

    // check if junk mail
    try {
        const is_junk = await check_if_junk_mail(env, message.to, parsedEmailContext, message.headers.get("Message-ID"));
        if (is_junk) {
            message.setReject("Junk mail");
            console.log(`Junk mail from ${message.from} to ${message.to}`);
            return;
        }
    } catch (error) {
        console.error("check junk mail error", error);
    }

    // remove attachment if configured or size > 2MB
    try {
        await remove_attachment_if_need(env, parsedEmailContext, message.from, message.to, message.rawSize);
    } catch (error) {
        console.error("remove attachment error", error);
    }

    const message_id = message.headers.get("Message-ID");
    // save email
    try {
        const { success } = await env.DB.prepare(
            `INSERT INTO raw_mails (source, address, raw, message_id) VALUES (?, ?, ?, ?)`
        ).bind(
            message.from, message.to, parsedEmailContext.rawEmail, message_id
        ).run();
        if (!success) {
            message.setReject(`Failed save message to ${message.to}`);
            console.error(`Failed save message from ${message.from} to ${message.to}`);
        }
    }
    catch (error) {
        console.error("save email error", error);
    }

    // forward email
    try {
        const forwardAddressList = getEnvStringList(env.FORWARD_ADDRESS_LIST)
        for (const forwardAddress of forwardAddressList) {
            await message.forward(forwardAddress);
        }
    } catch (error) {
        console.error("forward email error", error);
    }

    // forward subdomain email
    try {
        // 遍历 FORWARD_ADDRESS_LIST
        const subdomainForwardAddressList = getJsonObjectValue<SubdomainForwardAddressList[]>(env.SUBDOMAIN_FORWARD_ADDRESS_LIST) || [];
        for (const subdomainForwardAddress of subdomainForwardAddressList) {
            // 检查邮件是否匹配 domains
            if (subdomainForwardAddress.domains && subdomainForwardAddress.domains.length > 0) {
                for (const domain of subdomainForwardAddress.domains) {
                    if (message.to.endsWith(domain)) {
                        // 转发邮件
                        await message.forward(subdomainForwardAddress.forward);
                        // 支持多邮箱转发收件，不进行截止
                        // break;
                    }
                }
            } else {
                // 如果 domains 为空，则转发所有邮件
                await message.forward(subdomainForwardAddress.forward);
            }
        }
    } catch (error) {
        console.error("subdomain forward email error", error);
    }

    // send email to telegram
    try {
        await sendMailToTelegram(
            { env: env } as Context<HonoCustomType>,
            message.to, parsedEmailContext, message_id);
    } catch (error) {
        console.error("send mail to telegram error", error);
    }

    // send webhook
    try {
        await triggerWebhook(
            { env: env } as Context<HonoCustomType>,
            message.to, parsedEmailContext, message_id
        );
    } catch (error) {
        console.error("send webhook error", error);
    }

    // trigger another worker
    try {
        const parsedEmail = (await commonParseMail(parsedEmailContext));
        const parsedText = parsedEmail?.text ?? ""
        const rpcEmail: RPCEmailMessage = {
            from: message.from,
            to: message.to,
            rawEmail: rawEmail,
            headers: message.headers
        }
        await triggerAnotherWorker({ env: env } as Context<HonoCustomType>, rpcEmail, parsedText);
    } catch (error) {
        console.error("trigger another worker error", error);
    }

    // auto reply email
    await auto_reply(message, env);
}

export { email }
