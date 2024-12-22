import { Context, Hono } from 'hono'
import { Jwt } from 'hono/utils/jwt'
import { createMimeMessage } from 'mimetext';
import { Resend } from 'resend';

import { CONSTANTS } from '../constants'
import { getJsonSetting, getDomains, getIntValue, getBooleanValue, getStringValue } from '../utils';
import { GeoData } from '../models'
import { handleListQuery } from '../common'
import { HonoCustomType } from '../types';


export const api = new Hono<HonoCustomType>()

api.post('/api/requset_send_mail_access', async (c) => {
    const { address } = c.get("jwtPayload")
    if (!address) {
        return c.text("No address", 400)
    }
    try {
        const default_balance = getIntValue(c.env.DEFAULT_SEND_BALANCE, 0);
        const { success } = await c.env.DB.prepare(
            `INSERT INTO address_sender (address, balance, enabled) VALUES (?, ?, ?)`
        ).bind(
            address, default_balance, default_balance > 0 ? 1 : 0
        ).run();
        if (!success) {
            return c.text("Failed to request send mail access", 500)
        }
    } catch (e) {
        const message = (e as Error).message;
        if (message && message.includes("UNIQUE")) {
            return c.text("Already requested", 400)
        }
        return c.text("Failed to request send mail access", 500)
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
    if (!address) {
        throw new Error("No address")
    }
    // check domain
    const mailDomain = address.split("@")[1];
    const domains = getDomains(c);
    if (!domains.includes(mailDomain)) {
        throw new Error("Invalid domain")
    }
    const user_role = c.get("userRolePayload");
    const is_no_limit_send_balance = user_role && user_role === getStringValue(c.env.NO_LIMIT_SEND_ROLE);
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
            throw new Error("No balance")
        }
    }
    const {
        from_name, to_mail, to_name,
        subject, content, is_html
    } = reqJson;
    if (!to_mail) {
        throw new Error("Invalid to mail")
    }
    // check SEND_BLOCK_LIST_KEY
    const sendBlockList = await getJsonSetting(c, CONSTANTS.SEND_BLOCK_LIST_KEY) as string[];
    if (sendBlockList && sendBlockList.some((item) => to_mail.includes(item))) {
        throw new Error("to_mail address is blocked")
    }
    if (!subject) {
        throw new Error("Invalid subject")
    }
    if (!content) {
        throw new Error("Invalid content")
    }
    // send to verified address list, do not update balance
    const resendEnabled = c.env.RESEND_TOKEN || c.env[
        `RESEND_TOKEN_${mailDomain.replace(/\./g, "_").toUpperCase()}`
    ];
    let sendByVerifiedAddressList = false;
    if (c.env.SEND_MAIL) {
        const verifiedAddressList = await getJsonSetting(c, CONSTANTS.VERIFIED_ADDRESS_LIST_KEY) || [];
        if (verifiedAddressList.includes(to_mail)) {
            await sendMailToVerifyAddress(c, address, reqJson);
            sendByVerifiedAddressList = true;
        }
    }
    if (sendByVerifiedAddressList) {
        // do not update balance
    }
    // send by resend
    else if (resendEnabled) {
        await sendMailByResend(c, address, reqJson);
    }
    else {
        throw new Error("Please enable resend or verified address list")
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
    const { token } = await c.req.json();
    try {
        const { address } = await Jwt.verify(token, c.env.JWT_SECRET, "HS256");
        if (!address) {
            return c.text("No address", 400)
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
    if (!getBooleanValue(c.env.ENABLE_USER_DELETE_EMAIL)) {
        return c.text("User delete email is disabled", 403)
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
