import { Context } from "hono";

import { getEnvStringList } from "../utils";
import { sendMailToTelegram } from "../telegram_api";
import { Bindings, HonoCustomType, RPCEmailMessage } from "../types";
import { auto_reply } from "./auto_reply";
import { isBlocked } from "./black_list";
import { triggerWebhook, triggerAnotherWorker, commonParseMail} from "../common";
import { check_if_junk_mail } from "./check_junk";


async function email(message: ForwardableEmailMessage, env: Bindings, ctx: ExecutionContext) {
    if (await isBlocked(message.from, env)) {
        message.setReject("Reject from address");
        console.log(`Reject message from ${message.from} to ${message.to}`);
        return;
    }
    const rawEmail = await new Response(message.raw).text();

    // check if junk mail
    try {
        const is_junk = await check_if_junk_mail(env, message.to, rawEmail, message.headers.get("Message-ID"));
        if (is_junk) {
            message.setReject("Junk mail");
            console.log(`Junk mail from ${message.from} to ${message.to}`);
            return;
        }
    } catch (error) {
        console.log("check junk mail error", error);
    }

    const message_id = message.headers.get("Message-ID");
    // save email
    const { success } = await env.DB.prepare(
        `INSERT INTO raw_mails (source, address, raw, message_id) VALUES (?, ?, ?, ?)`
    ).bind(
        message.from, message.to, rawEmail, message_id
    ).run();
    if (!success) {
        message.setReject(`Failed save message to ${message.to}`);
        console.log(`Failed save message from ${message.from} to ${message.to}`);
    }

    // forward email
    try {
        const forwardAddressList = getEnvStringList(env.FORWARD_ADDRESS_LIST)
        for (const forwardAddress of forwardAddressList) {
            await message.forward(forwardAddress);
        }
    } catch (error) {
        console.log("forward email error", error);
    }

    // send email to telegram
    try {
        await sendMailToTelegram(
            { env: env } as Context<HonoCustomType>,
            message.to, rawEmail, message_id);
    } catch (error) {
        console.log("send mail to telegram error", error);
    }

    // send webhook
    let parsedText;
    try {
        parsedText = await triggerWebhook(
            { env: env } as Context<HonoCustomType>,
            message.to, rawEmail, message_id
        );
    } catch (error) {
        console.log("send webhook error", error);
    }

    // trigger another worker
    try {
        const headersMap = new Map<string, string>();
        if(message.headers) {
            message.headers.forEach((value, key) => {headersMap.set(key, value);});
        }
        if (!parsedText){
          parsedText = (await commonParseMail(rawEmail))?.text ?? ""
        }
        const rpcEmail: RPCEmailMessage = {
            from: message.from,
            to: message.to,
            rawEmail: rawEmail,
            headers: headersMap
        }
        await triggerAnotherWorker({ env: env } as Context<HonoCustomType>, rpcEmail, parsedText);
    } catch (error) {
        console.error("trigger another worker error", error);
    }

    // auto reply email
    await auto_reply(message, env);
}

export { email }
