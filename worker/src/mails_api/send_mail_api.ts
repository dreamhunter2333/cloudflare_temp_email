import { Context, Hono } from 'hono'
import { Jwt } from 'hono/utils/jwt'
import { createMimeMessage } from 'mimetext';
import { Resend } from 'resend';
import { WorkerMailer, WorkerMailerOptions } from 'worker-mailer';

import i18n from '../i18n';
import { CONSTANTS } from '../constants'
import { getJsonSetting, getDomains, getIntValue, getBooleanValue, getStringValue, getJsonObjectValue, getSplitStringListValue } from '../utils';
import { GeoData } from '../models'
import { handleListQuery } from '../common'


export const api = new Hono<HonoCustomType>()

api.post('/api/requset_send_mail_access', async (c) => {
    const msgs = i18n.getMessagesbyContext(c);
    const { address } = c.get("jwtPayload")
    if (!address) {
        return c.text(msgs.AddressNotFoundMsg, 400)
    }
    try {
        const default_balance = getIntValue(c.env.DEFAULT_SEND_BALANCE, 0);
        const { success } = await c.env.DB.prepare(
            `INSERT INTO address_sender (address, balance, enabled) VALUES (?, ?, ?)`
        ).bind(
            address, default_balance, default_balance > 0 ? 1 : 0
        ).run();
        if (!success) {
            return c.text(msgs.OperationFailedMsg, 500)
        }
    } catch (e) {
        const message = (e as Error).message;
        if (message && message.includes("UNIQUE")) {
            return c.text(msgs.AlreadyRequestedMsg, 400)
        }
        return c.text(msgs.OperationFailedMsg, 500)
    }
    return c.json({ status: "ok" })
})

export const sendMailToVerifyAddress = async (
    c: Context<HonoCustomType>, address: string,
    reqJson: {
        from_name: string, to_mail: string, to_name: string,
        subject: string, content: string, is_html: boolean
    }
): Promise<void> => {
    const {
        from_name, to_mail, to_name,
        subject, content, is_html
    } = reqJson;
    const msg = createMimeMessage();
    msg.setSender(from_name ? { name: from_name, addr: address } : address);
    msg.setRecipient(to_name ? { name: to_name, addr: to_mail } : to_mail);
    msg.setSubject(subject);
    msg.addMessage({
        contentType: is_html ? 'text/html' : 'text/plain',
        data: content
    });
    const { EmailMessage } = await import('cloudflare:email');
    const message = new EmailMessage(address, to_mail, msg.asRaw());
    await c.env.SEND_MAIL.send(message);
}

const sendMailByResend = async (
    c: Context<HonoCustomType>, address: string,
    reqJson: {
        from_name: string, to_mail: string, to_name: string,
        subject: string, content: string, is_html: boolean
    }
): Promise<void> => {
    const mailDomain = address.split("@")[1];
    const token = c.env[
        `RESEND_TOKEN_${mailDomain.replace(/\./g, "_").toUpperCase()}`
    ] || c.env.RESEND_TOKEN;
    const resend = new Resend(token);
    const { data, error } = await resend.emails.send({
        from: reqJson.from_name ? `${reqJson.from_name} <${address}>` : address,
        to: reqJson.to_name ? `${reqJson.to_name} <${reqJson.to_mail}>` : reqJson.to_mail,
        subject: reqJson.subject,
        ...(reqJson.is_html ? {
            html: reqJson.content,
        } : {
            text: reqJson.content,
        })
    });
    if (error) {
        throw new Error(`Resend error: ${error.name} ${error.message}`);
    }
    console.log(`Resend success: ${JSON.stringify(data)}`);
}

const sendMailBySmtp = async (
    c: Context<HonoCustomType>, address: string,
    reqJson: {
        from_name: string, to_mail: string, to_name: string,
        subject: string, content: string, is_html: boolean
    },
    smtpOptions: WorkerMailerOptions
): Promise<void> => {
    await WorkerMailer.send(
        smtpOptions,
        {
            from: {
                name: reqJson.from_name,
                email: address
            },
            to: {
                name: reqJson.to_name,
                email: reqJson.to_mail
            },
            subject: reqJson.subject,
            text: reqJson.is_html ? undefined : reqJson.content,
            html: reqJson.is_html ? reqJson.content : undefined
        }
    )
}

export const sendMail = async (
    c: Context<HonoCustomType>, address: string,
    reqJson: {
        from_name: string, to_mail: string, to_name: string,
        subject: string, content: string, is_html: boolean
    },
    options?: {
        isAdmin?: boolean
    }
): Promise<void> => {
    const msgs = i18n.getMessagesbyContext(c);
    if (!address) {
        throw new Error(msgs.AddressNotFoundMsg)
    }
    // check domain
    const mailDomain = address.split("@")[1];
    const domains = getDomains(c);
    if (!domains.includes(mailDomain)) {
        throw new Error(msgs.InvalidDomainMsg)
    }
    const user_role = c.get("userRolePayload");
    const no_limit_roles = getSplitStringListValue(c.env.NO_LIMIT_SEND_ROLE);
    const is_no_limit_send_balance = user_role && no_limit_roles.includes(user_role);
    // no need find noLimitSendAddressList if is_no_limit_send_balance
    const noLimitSendAddressList = is_no_limit_send_balance ?
        [] : await getJsonSetting(c, CONSTANTS.NO_LIMIT_SEND_ADDRESS_LIST_KEY) || [];
    const isNoLimitSendAddress = noLimitSendAddressList?.includes(address);
    const needCheckBalance = !is_no_limit_send_balance && !options?.isAdmin && !isNoLimitSendAddress;
    if (needCheckBalance) {
        // check permission
        const balance = await c.env.DB.prepare(
            `SELECT balance FROM address_sender
            where address = ? and enabled = 1`
        ).bind(address).first<number>("balance");
        if (!balance || balance <= 0) {
            throw new Error(msgs.NoBalanceMsg)
        }
    }
    const {
        from_name, to_mail, to_name,
        subject, content, is_html
    } = reqJson;
    if (!to_mail) {
        throw new Error(msgs.InvalidToMailMsg)
    }
    // check SEND_BLOCK_LIST_KEY
    const sendBlockList = await getJsonSetting(c, CONSTANTS.SEND_BLOCK_LIST_KEY) as string[];
    if (sendBlockList && sendBlockList.some((item) => to_mail.includes(item))) {
        throw new Error(msgs.AddressBlockedMsg)
    }
    if (!subject) {
        throw new Error(msgs.SubjectEmptyMsg)
    }
    if (!content) {
        throw new Error(msgs.ContentEmptyMsg)
    }

    // send to verified address list, do not update balance
    const resendEnabled = c.env.RESEND_TOKEN || c.env[
        `RESEND_TOKEN_${mailDomain.replace(/\./g, "_").toUpperCase()}`
    ];
    // send by smtp
    const smtpConfigMap = getJsonObjectValue<Record<string, WorkerMailerOptions>>(c.env.SMTP_CONFIG);
    const smtpConfig = smtpConfigMap ? smtpConfigMap[mailDomain] : null;
    // send by verified address list
    let sendByVerifiedAddressList = false;
    if (c.env.SEND_MAIL) {
        const verifiedAddressList = await getJsonSetting(c, CONSTANTS.VERIFIED_ADDRESS_LIST_KEY) || [];
        if (verifiedAddressList.includes(to_mail)) {
            await sendMailToVerifyAddress(c, address, reqJson);
            sendByVerifiedAddressList = true;
        }
    }

    // send mail workflow
    if (sendByVerifiedAddressList) {
        // do not update balance
    }
    // send by resend
    else if (resendEnabled) {
        await sendMailByResend(c, address, reqJson);
    }
    else if (smtpConfig) {
        await sendMailBySmtp(c, address, reqJson, smtpConfig);
    }
    else {
        if (c.env.SEND_MAIL) {
            throw new Error(`${msgs.EnableResendOrSmtpWithVerifiedMsg} (${mailDomain})`);
        }
        throw new Error(`${msgs.EnableResendOrSmtpMsg} (${mailDomain})`);
    }

    // update balance
    if (!sendByVerifiedAddressList && needCheckBalance) {
        try {
            const { success } = await c.env.DB.prepare(
                `UPDATE address_sender SET balance = balance - 1 where address = ?`
            ).bind(address).run();
            if (!success) {
                console.warn(`Failed to update balance for ${address}`);
            }
        } catch (e) {
            console.warn(`Failed to update balance for ${address}`);
        }
    }
    // save to sendbox
    try {
        const reqIp = c.req.raw.headers.get("cf-connecting-ip")
        const geoData = new GeoData(reqIp, c.req.raw.cf as any);
        const body = {
            version: "v2",
            ...reqJson,
            geoData: geoData,
        };
        const { success: success2 } = await c.env.DB.prepare(
            `INSERT INTO sendbox (address, raw) VALUES (?, ?)`
        ).bind(address, JSON.stringify(body)).run();
        if (!success2) {
            console.warn(`Failed to save to sendbox for ${address}`);
        }
    } catch (e) {
        console.warn(`Failed to save to sendbox for ${address}`);
    }
}

api.post('/api/send_mail', async (c) => {
    const { address } = c.get("jwtPayload")
    const reqJson = await c.req.json();
    try {
        await sendMail(c, address, reqJson);
    } catch (e) {
        console.error("Failed to send mail", e);
        return c.text(`Failed to send mail ${(e as Error).message}`, 400)
    }
    return c.json({ status: "ok" })
})

api.post('/external/api/send_mail', async (c) => {
    const msgs = i18n.getMessagesbyContext(c);
    const { token } = await c.req.json();
    try {
        const { address } = await Jwt.verify(token, c.env.JWT_SECRET, "HS256");
        if (!address) {
            return c.text(msgs.AddressNotFoundMsg, 400)
        }
        const reqJson = await c.req.json();
        await sendMail(c, address as string, reqJson);
        return c.json({ status: "ok" })
    } catch (e) {
        console.error("Failed to send mail", e);
        return c.text(`Failed to send mail ${(e as Error).message}`, 400)
    }
})

export const getSendbox = async (
    c: Context<HonoCustomType>,
    address: string, limit: string, offset: string
): Promise<Response> => {
    if (!address) {
        return c.json({ "error": "No address" }, 400)
    }
    return await handleListQuery(c,
        `SELECT * FROM sendbox where address = ? `,
        `SELECT count(*) as count FROM sendbox where address = ? `,
        [address], limit, offset
    );
}

api.get('/api/sendbox', async (c) => {
    const { address } = c.get("jwtPayload")
    const { limit, offset } = c.req.query();
    return getSendbox(c, address, limit, offset);
})

api.delete('/api/sendbox/:id', async (c) => {
    const msgs = i18n.getMessagesbyContext(c);
    if (!getBooleanValue(c.env.ENABLE_USER_DELETE_EMAIL)) {
        return c.text(msgs.UserDeleteEmailDisabledMsg, 403)
    }
    const { address } = c.get("jwtPayload")
    const { id } = c.req.param();
    const { success } = await c.env.DB.prepare(
        `DELETE FROM sendbox WHERE address = ? and id = ? `
    ).bind(address, id).run();
    return c.json({
        success: success
    })
})
