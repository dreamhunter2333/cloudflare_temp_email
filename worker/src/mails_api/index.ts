import { Context, Hono } from 'hono'

import i18n from '../i18n';
import { getBooleanValue, getJsonSetting, checkCfTurnstile, getStringValue, getSplitStringListValue } from '../utils';
import { newAddress, handleListQuery, deleteAddressWithData, getAddressPrefix, getAllowDomains, updateAddressUpdatedAt, generateRandomName } from '../common'
import { CONSTANTS } from '../constants'
import auto_reply from './auto_reply'
import webhook_settings from './webhook_settings';
import s3_attachment from './s3_attachment';

export const api = new Hono<HonoCustomType>()

api.get('/api/auto_reply', auto_reply.getAutoReply)
api.post('/api/auto_reply', auto_reply.saveAutoReply)
api.get('/api/webhook/settings', webhook_settings.getWebhookSettings)
api.post('/api/webhook/settings', webhook_settings.saveWebhookSettings)
api.post('/api/webhook/test', webhook_settings.testWebhookSettings)
api.get('/api/attachment/list', s3_attachment.list)
api.post('/api/attachment/delete', s3_attachment.deleteKey)
api.post('/api/attachment/put_url', s3_attachment.getSignedPutUrl)
api.post('/api/attachment/get_url', s3_attachment.getSignedGetUrl)

api.get('/api/mails', async (c) => {
    const { address } = c.get("jwtPayload")
    if (!address) {
        return c.json({ "error": "No address" }, 400)
    }
    const { limit, offset } = c.req.query();
    if (Number.parseInt(offset) <= 0) await updateAddressUpdatedAt(c, address);
    return await handleListQuery(c,
        `SELECT * FROM raw_mails where address = ?`,
        `SELECT count(*) as count FROM raw_mails where address = ?`,
        [address], limit, offset
    );
})

api.get('/api/mail/:mail_id', async (c) => {
    const { address } = c.get("jwtPayload")
    const { mail_id } = c.req.param();
    const result = await c.env.DB.prepare(
        `SELECT * FROM raw_mails where id = ? and address = ?`
    ).bind(mail_id, address).first();
    return c.json(result);
})

api.delete('/api/mails/:id', async (c) => {
    const lang = c.get("lang") || c.env.DEFAULT_LANG;
    const msgs = i18n.getMessages(lang);
    if (!getBooleanValue(c.env.ENABLE_USER_DELETE_EMAIL)) {
        return c.text(msgs.UserDeleteEmailDisabledMsg, 403)
    }
    const { address } = c.get("jwtPayload")
    const { id } = c.req.param();
    // TODO: add toLowerCase() to handle old data
    const { success } = await c.env.DB.prepare(
        `DELETE FROM raw_mails WHERE address = ? and id = ? `
    ).bind(address.toLowerCase(), id).run();
    return c.json({
        success: success
    })
})

api.get('/api/settings', async (c) => {
    const { address, address_id } = c.get("jwtPayload")
    const user_role = c.get("userRolePayload")
    const lang = c.get("lang") || c.env.DEFAULT_LANG;
    const msgs = i18n.getMessages(lang);
    if (address_id && address_id > 0) {
        try {
            const db_address_id = await c.env.DB.prepare(
                `SELECT id FROM address where id = ? `
            ).bind(address_id).first("id");
            if (!db_address_id) {
                return c.text(msgs.InvalidAddressMsg, 400)
            }
        } catch (error) {
            return c.text(msgs.InvalidAddressMsg, 400)
        }
    }
    // check address id
    try {
        if (!address_id) {
            const db_address_id = await c.env.DB.prepare(
                `SELECT id FROM address where name = ? `
            ).bind(address).first("id");
            if (!db_address_id) {
                return c.text(msgs.InvalidAddressMsg, 400)
            }
        }
    } catch (error) {
        return c.text(msgs.InvalidAddressMsg, 400)
    }

    await updateAddressUpdatedAt(c, address);

    const no_limit_roles = getSplitStringListValue(c.env.NO_LIMIT_SEND_ROLE);
    const is_no_limit_send_balance = user_role && no_limit_roles.includes(user_role);
    const balance = is_no_limit_send_balance ? 99999 : await c.env.DB.prepare(
        `SELECT balance FROM address_sender where address = ? and enabled = 1`
    ).bind(address).first("balance");
    return c.json({
        address: address,
        send_balance: balance || 0,
    });
})

api.post('/api/new_address', async (c) => {
    const lang = c.get("lang") || c.env.DEFAULT_LANG;
    const msgs = i18n.getMessages(lang);
    if (getBooleanValue(c.env.DISABLE_ANONYMOUS_USER_CREATE_EMAIL)
        && !c.get("userPayload")
    ) {
        return c.text(msgs.NewAddressAnonymousDisabledMsg, 403)
    }
    if (!getBooleanValue(c.env.ENABLE_USER_CREATE_EMAIL)) {
        return c.text(msgs.NewAddressDisabledMsg, 403)
    }
    // eslint-disable-next-line prefer-const
    let { name, domain, cf_token } = await c.req.json();
    // check cf turnstile
    try {
        await checkCfTurnstile(c, cf_token);
    } catch (error) {
        return c.text(msgs.TurnstileCheckFailedMsg, 500)
    }
    // Check if custom email names are disabled from environment variable
    const disableCustomAddressName = getBooleanValue(c.env.DISABLE_CUSTOM_ADDRESS_NAME);

    // if no name or custom names are disabled, generate random name
    if (!name || disableCustomAddressName) {
        // Generate random name with context-based length configuration
        name = generateRandomName(c);
    }
    // check name block list
    try {
        const value = await getJsonSetting(c, CONSTANTS.ADDRESS_BLOCK_LIST_KEY);
        const blockList = (value || []) as string[];
        if (blockList.some((item) => name.includes(item))) {
            return c.text(`Name[${name}]is blocked`, 400)
        }
    } catch (error) {
        console.error(error);
    }
    try {
        const addressPrefix = await getAddressPrefix(c);
        const res = await newAddress(c, {
            name, domain,
            enablePrefix: true,
            checkLengthByConfig: true,
            addressPrefix
        });
        return c.json(res);
    } catch (e) {
        return c.text(`${msgs.FailedCreateAddressMsg}: ${(e as Error).message}`, 400)
    }
})

api.delete('/api/delete_address', async (c) => {
    const { address, address_id } = c.get("jwtPayload")
    const success = await deleteAddressWithData(c, address, address_id);
    return c.json({
        success: success
    })
})

api.delete('/api/clear_inbox', async (c) => {
    const lang = c.get("lang") || c.env.DEFAULT_LANG;
    const msgs = i18n.getMessages(lang);
    if (!getBooleanValue(c.env.ENABLE_USER_DELETE_EMAIL)) {
        return c.text(msgs.UserDeleteEmailDisabledMsg, 403)
    }
    const { address } = c.get("jwtPayload")
    const { success } = await c.env.DB.prepare(
        `DELETE FROM raw_mails WHERE address = ?`
    ).bind(address).run();
    if (!success) {
        return c.text("Failed to clear inbox", 500)
    }
    return c.json({
        success: success
    })
})

api.delete('/api/clear_sent_items', async (c) => {
    const lang = c.get("lang") || c.env.DEFAULT_LANG;
    const msgs = i18n.getMessages(lang);
    if (!getBooleanValue(c.env.ENABLE_USER_DELETE_EMAIL)) {
        return c.text(msgs.UserDeleteEmailDisabledMsg, 403)
    }
    const { address } = c.get("jwtPayload")
    const { success } = await c.env.DB.prepare(
        `DELETE FROM sendbox WHERE address = ?`
    ).bind(address).run();
    if (!success) {
        return c.text("Failed to clear sent items", 500)
    }
    return c.json({
        success: success
    })
})
