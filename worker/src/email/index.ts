import { Context } from "hono";

import { getEnvStringList } from "../utils";
import { sendMailToTelegram } from "../telegram_api";
import { Bindings, HonoCustomType } from "../types";
import { auto_reply } from "./auto_reply";
import { isBlocked } from "./black_list";
import { triggerWebhook } from "../common";


async function email(message: ForwardableEmailMessage, env: Bindings, ctx: ExecutionContext) {
    if (await isBlocked(message.from, env)) {
        message.setReject("Reject from address");
        console.log(`Reject message from ${message.from} to ${message.to}`);
        return;
    }
    const rawEmail = await new Response(message.raw).text();
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
    try {
        await triggerWebhook(
            { env: env } as Context<HonoCustomType>,
            message.to, rawEmail, message_id
        );
    } catch (error) {
        console.log("send webhook error", error);
    }

    // auto reply email
    await auto_reply(message, env);
}

export { email }
