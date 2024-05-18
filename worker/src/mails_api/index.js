import { Hono } from 'hono'

import { getBooleanValue, getJsonSetting, checkCfTurnstile } from '../utils';
import { newAddress, handleListQuery } from '../common'
import { CONSTANTS } from '../constants'
import auto_reply from './auto_reply'
import webhook_settings from './webhook_settings';

const api = new Hono()

api.get('/api/auto_reply', auto_reply.getAutoReply)
api.post('/api/auto_reply', auto_reply.saveAutoReply)
api.get('/api/webhook/settings', webhook_settings.getWebhookSettings)
api.post('/api/webhook/settings', webhook_settings.saveWebhookSettings)
api.post('/api/webhook/test', webhook_settings.testWebhookSettings)

api.get('/api/mails', async (c) => {
    const { address } = c.get("jwtPayload")
    if (!address) {
        return c.json({ "error": "No address" }, 400)
    }
    const { limit, offset } = c.req.query();
    return await handleListQuery(c,
        `SELECT * FROM raw_mails where address = ?`,
        `SELECT count(*) as count FROM raw_mails where address = ?`,
        [address], limit, offset
    );
})

api.delete('/api/mails/:id', async (c) => {
    if (!getBooleanValue(c.env.ENABLE_USER_DELETE_EMAIL)) {
        return c.text("User delete email is disabled", 403)
    }
    const { address } = c.get("jwtPayload")
    const { id } = c.req.param();
    const { success } = await c.env.DB.prepare(
        `DELETE FROM raw_mails WHERE address = ? and id = ? `
    ).bind(address, id).run();
    return c.json({
        success: success
    })
})

api.get('/api/settings', async (c) => {
    const { address, address_id } = c.get("jwtPayload")
    if (address_id && address_id > 0) {
        try {
            const db_address_id = await c.env.DB.prepare(
                `SELECT id FROM address where id = ? `
            ).bind(address_id).first("id");
            if (!db_address_id) {
                return c.text("Invalid address", 400)
            }
        } catch (error) {
            return c.text("Invalid address", 400)
        }
    }
    // check address id
    try {
        if (!address_id) {
            const db_address_id = await c.env.DB.prepare(
                `SELECT id FROM address where name = ? `
            ).bind(address).first("id");
            if (!db_address_id) {
                return c.text("Invalid address", 400)
            }
        }
    } catch (error) {
        return c.text("Invalid address", 400)
    }
    // update address updated_at
    try {
        c.env.DB.prepare(
            `UPDATE address SET updated_at = datetime('now') where name = ?`
        ).bind(address).run();
    } catch (e) {
        console.warn("Failed to update address")
    }
    const balance = await c.env.DB.prepare(
        `SELECT balance FROM address_sender where address = ? and enabled = 1`
    ).bind(address).first("balance");
    return c.json({
        address: address,
        send_balance: balance || 0,
    });
})

api.post('/api/new_address', async (c) => {
    if (!getBooleanValue(c.env.ENABLE_USER_CREATE_EMAIL)) {
        return c.text("New address is disabled", 403)
    }
    let { name, domain, cf_token } = await c.req.json();
    // check cf turnstile
    try {
        await checkCfTurnstile(c, cf_token);
    } catch (error) {
        return c.text("Failed to check cf turnstile", 500)
    }
    // if no name, generate random name
    if (!name) {
        name = Math.random().toString(36).substring(2, 15);
    }
    // check name block list
    try {
        const value = await getJsonSetting(c, CONSTANTS.ADDRESS_BLOCK_LIST_KEY);
        const blockList = value || [];
        if (blockList.some((item) => name.includes(item))) {
            return c.text(`Name[${name}]is blocked`, 400)
        }
    } catch (error) {
        console.error(error);
    }
    try {
        const res = await newAddress(c, name, domain, true);
        return c.json(res);
    } catch (e) {
        return c.text(`Failed create address: ${e.message}`, 400)
    }
})

api.delete('/api/delete_address', async (c) => {
    if (!getBooleanValue(c.env.ENABLE_USER_DELETE_EMAIL)) {
        return c.text("User delete email is disabled", 403)
    }
    const { address, address_id } = c.get("jwtPayload")
    let name = address;
    const { success } = await c.env.DB.prepare(
        `DELETE FROM address WHERE name = ? `
    ).bind(name).run();
    if (!success) {
        return c.text("Failed to delete address", 500)
    }
    const { success: mailSuccess } = await c.env.DB.prepare(
        `DELETE FROM raw_mails WHERE address = ? `
    ).bind(address).run();
    if (!mailSuccess) {
        return c.text("Failed to delete mails", 500)
    }
    const { success: sendAccess } = await c.env.DB.prepare(
        `DELETE FROM address_sender WHERE address = ? `
    ).bind(address).run();
    const { success: addressSuccess } = await c.env.DB.prepare(
        `DELETE FROM users_address WHERE address_id = ? `
    ).bind(address_id).run();
    return c.json({
        success: success && mailSuccess && sendAccess && addressSuccess
    })
})

export { api }
