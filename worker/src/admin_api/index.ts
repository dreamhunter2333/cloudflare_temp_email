import { Hono } from 'hono'
import { Jwt } from 'hono/utils/jwt'

import { HonoCustomType } from '../types'
import { sendAdminInternalMail, getJsonSetting, saveSetting, getUserRoles } from '../utils'
import { newAddress, handleListQuery } from '../common'
import { CONSTANTS } from '../constants'
import cleanup_api from './cleanup_api'
import admin_user_api from './admin_user_api'
import webhook_settings from './webhook_settings'
import mail_webhook_settings from './mail_webhook_settings'
import oauth2_settings from './oauth2_settings'
import worker_config from './worker_config'
import { sendMailbyAdmin } from './send_mail'

export const api = new Hono<HonoCustomType>()

api.get('/admin/address', async (c) => {
    const { limit, offset, query } = c.req.query();
    if (query) {
        return await handleListQuery(c,
            `SELECT a.*,`
            + ` (SELECT COUNT(*) FROM raw_mails WHERE address = a.name) AS mail_count,`
            + ` (SELECT COUNT(*) FROM sendbox WHERE address = a.name) AS send_count`
            + ` FROM address a`
            + ` where name like ?`,
            `SELECT count(*) as count FROM address where name like ?`,
            [`%${query}%`], limit, offset
        );
    }
    return await handleListQuery(c,
        `SELECT a.*,`
        + ` (SELECT COUNT(*) FROM raw_mails WHERE address = a.name) AS mail_count,`
        + ` (SELECT COUNT(*) FROM sendbox WHERE address = a.name) AS send_count`
        + ` FROM address a`,
        `SELECT count(*) as count FROM address`,
        [], limit, offset
    );
})

api.post('/admin/new_address', async (c) => {
    const { name, domain, enablePrefix } = await c.req.json();
    if (!name) {
        return c.text("Please provide a name", 400)
    }
    try {
        const res = await newAddress(c, {
            name, domain, enablePrefix,
            checkLengthByConfig: false,
            addressPrefix: null,
            checkAllowDomains: false,
            enableCheckNameRegex: false,
        });
        return c.json(res);
    } catch (e) {
        return c.text(`Failed create address: ${(e as Error).message}`, 400)
    }
})

api.delete('/admin/delete_address/:id', async (c) => {
    const { id } = c.req.param();
    const { success } = await c.env.DB.prepare(
        `DELETE FROM address WHERE id = ? `
    ).bind(id).run();
    if (!success) {
        return c.text("Failed to delete address", 500)
    }
    const { success: mailSuccess } = await c.env.DB.prepare(
        `DELETE FROM raw_mails WHERE address IN`
        + ` (select name from address where id = ?) `
    ).bind(id).run();
    if (!mailSuccess) {
        return c.text("Failed to delete mails", 500)
    }
    const { success: sendAccess } = await c.env.DB.prepare(
        `DELETE FROM address_sender WHERE address IN`
        + ` (select name from address where id = ?) `
    ).bind(id).run();
    const { success: usersAddressSuccess } = await c.env.DB.prepare(
        `DELETE FROM users_address WHERE address_id = ?`
    ).bind(id).run();
    return c.json({
        success: success && mailSuccess && sendAccess && usersAddressSuccess
    })
})

api.get('/admin/show_password/:id', async (c) => {
    const { id } = c.req.param();
    const name = await c.env.DB.prepare(
        `SELECT name FROM address WHERE id = ? `
    ).bind(id).first("name");
    const jwt = await Jwt.sign({
        address: name,
        address_id: id
    }, c.env.JWT_SECRET, "HS256")
    return c.json({
        jwt: jwt
    })
})

api.get('/admin/mails', async (c) => {
    const { address, limit, offset, keyword } = c.req.query();
    if (address && keyword) {
        return await handleListQuery(c,
            `SELECT * FROM raw_mails where address = ? and raw like ? `,
            `SELECT count(*) as count FROM raw_mails where address = ? and raw like ? `,
            [address, `%${keyword}%`], limit, offset
        );
    } else if (keyword) {
        return await handleListQuery(c,
            `SELECT * FROM raw_mails where raw like ? `,
            `SELECT count(*) as count FROM raw_mails where raw like ? `,
            [`%${keyword}%`], limit, offset
        );
    } else if (address) {
        return await handleListQuery(c,
            `SELECT * FROM raw_mails where address = ? `,
            `SELECT count(*) as count FROM raw_mails where address = ? `,
            [address], limit, offset
        );
    } else {
        return await handleListQuery(c,
            `SELECT * FROM raw_mails `,
            `SELECT count(*) as count FROM raw_mails `,
            [], limit, offset
        );
    }
});

api.get('/admin/mails_unknow', async (c) => {
    const { limit, offset } = c.req.query();
    return await handleListQuery(c,
        `SELECT * FROM raw_mails where address NOT IN (select name from address) `,
        `SELECT count(*) as count FROM raw_mails`
        + ` where address NOT IN (select name from address) `,
        [], limit, offset
    );
});

api.delete('/admin/mails/:id', async (c) => {
    const { id } = c.req.param();
    const { success } = await c.env.DB.prepare(
        `DELETE FROM raw_mails WHERE id = ? `
    ).bind(id).run();
    return c.json({
        success: success
    })
})

api.get('/admin/address_sender', async (c) => {
    const { address, limit, offset } = c.req.query();
    if (address) {
        return await handleListQuery(c,
            `SELECT * FROM address_sender where address = ? `,
            `SELECT count(*) as count FROM address_sender where address = ? `,
            [address], limit, offset
        );
    }
    return await handleListQuery(c,
        `SELECT * FROM address_sender `,
        `SELECT count(*) as count FROM address_sender `,
        [], limit, offset
    );
})

api.post('/admin/address_sender', async (c) => {
    /* eslint-disable prefer-const */
    let { address, address_id, balance, enabled } = await c.req.json();
    /* eslint-enable prefer-const */
    if (!address_id) {
        return c.text("Invalid address_id", 400)
    }
    enabled = enabled ? 1 : 0;
    const { success } = await c.env.DB.prepare(
        `UPDATE address_sender SET enabled = ?, balance = ? WHERE id = ? `
    ).bind(enabled, balance, address_id).run();
    if (!success) {
        return c.text("Failed to update address sender", 500)
    }
    await sendAdminInternalMail(
        c, address, "Account Send Access Updated",
        `Your send access has been ${enabled ? "enabled" : "disabled"}, balance: ${balance}`
    );
    return c.json({
        success: success
    })
})

api.delete('/admin/address_sender/:id', async (c) => {
    const { id } = c.req.param();
    const { success } = await c.env.DB.prepare(
        `DELETE FROM address_sender WHERE id = ? `
    ).bind(id).run();
    return c.json({
        success: success
    })
})

api.get('/admin/sendbox', async (c) => {
    const { address, limit, offset } = c.req.query();
    if (address) {
        return await handleListQuery(c,
            `SELECT * FROM sendbox where address = ? `,
            `SELECT count(*) as count FROM sendbox where address = ? `,
            [address], limit, offset
        );
    }
    return await handleListQuery(c,
        `SELECT * FROM sendbox `,
        `SELECT count(*) as count FROM sendbox `,
        [], limit, offset
    );
})

api.delete('/admin/sendbox/:id', async (c) => {
    const { id } = c.req.param();
    const { success } = await c.env.DB.prepare(
        `DELETE FROM sendbox WHERE id = ? `
    ).bind(id).run();
    return c.json({
        success: success
    })
})

api.get('/admin/statistics', async (c) => {
    const { count: mailCount } = await c.env.DB.prepare(
        `SELECT count(*) as count FROM raw_mails`
    ).first<{ count: number }>() || {};
    const { count: addressCount } = await c.env.DB.prepare(
        `SELECT count(*) as count FROM address`
    ).first<{ count: number }>() || {};
    const { count: activeAddressCount7days } = await c.env.DB.prepare(
        `SELECT count(*) as count FROM address where updated_at > datetime('now', '-7 day')`
    ).first<{ count: number }>() || {};
    const { count: activeAddressCount30days } = await c.env.DB.prepare(
        `SELECT count(*) as count FROM address where updated_at > datetime('now', '-30 day')`
    ).first<{ count: number }>() || {};
    const { count: sendMailCount } = await c.env.DB.prepare(
        `SELECT count(*) as count FROM sendbox`
    ).first<{ count: number }>() || {};
    const { count: userCount } = await c.env.DB.prepare(
        `SELECT count(*) as count FROM users`
    ).first<{ count: number }>() || {};
    return c.json({
        mailCount: mailCount,
        addressCount: addressCount,
        activeAddressCount7days: activeAddressCount7days,
        activeAddressCount30days: activeAddressCount30days,
        userCount: userCount,
        sendMailCount: sendMailCount
    })
});

api.get('/admin/account_settings', async (c) => {
    try {
        const blockList = await getJsonSetting(c, CONSTANTS.ADDRESS_BLOCK_LIST_KEY);
        const sendBlockList = await getJsonSetting(c, CONSTANTS.SEND_BLOCK_LIST_KEY);
        const verifiedAddressList = await getJsonSetting(c, CONSTANTS.VERIFIED_ADDRESS_LIST_KEY);
        const fromBlockList = c.env.KV ? await c.env.KV.get<string[]>(CONSTANTS.EMAIL_KV_BLACK_LIST, 'json') : [];
        const noLimitSendAddressList = await getJsonSetting(c, CONSTANTS.NO_LIMIT_SEND_ADDRESS_LIST_KEY);
        return c.json({
            blockList: blockList || [],
            sendBlockList: sendBlockList || [],
            verifiedAddressList: verifiedAddressList || [],
            fromBlockList: fromBlockList || [],
            noLimitSendAddressList: noLimitSendAddressList || []
        })
    } catch (error) {
        console.error(error);
        return c.json({})
    }
})

api.post('/admin/account_settings', async (c) => {
    /** @type {{ blockList: Array<string>, sendBlockList: Array<string> }} */
    const {
        blockList, sendBlockList, noLimitSendAddressList,
        verifiedAddressList, fromBlockList
    } = await c.req.json();
    if (!blockList || !sendBlockList || !verifiedAddressList) {
        return c.text("Invalid blockList or sendBlockList", 400)
    }
    if (!c.env.SEND_MAIL && verifiedAddressList.length > 0) {
        return c.text("Please enable SEND_MAIL to use verifiedAddressList", 400)
    }
    await saveSetting(
        c, CONSTANTS.ADDRESS_BLOCK_LIST_KEY,
        JSON.stringify(blockList)
    );
    await saveSetting(
        c, CONSTANTS.SEND_BLOCK_LIST_KEY,
        JSON.stringify(sendBlockList)
    );
    await saveSetting(
        c, CONSTANTS.VERIFIED_ADDRESS_LIST_KEY,
        JSON.stringify(verifiedAddressList)
    )
    if (fromBlockList?.length > 0 && !c.env.KV) {
        return c.text("Please enable KV to use fromBlockList", 400)
    }
    if (fromBlockList) {
        await c.env.KV.put(CONSTANTS.EMAIL_KV_BLACK_LIST, JSON.stringify(fromBlockList || []))
    }
    await saveSetting(
        c, CONSTANTS.NO_LIMIT_SEND_ADDRESS_LIST_KEY,
        JSON.stringify(noLimitSendAddressList || [])
    )
    return c.json({
        success: true
    })
})

// cleanup
api.post('/admin/cleanup', cleanup_api.cleanup)
api.get('/admin/auto_cleanup', cleanup_api.getCleanup)
api.post('/admin/auto_cleanup', cleanup_api.saveCleanup)

// user settings
api.get('/admin/user_settings', admin_user_api.getSetting)
api.post('/admin/user_settings', admin_user_api.saveSetting)
api.get('/admin/users', admin_user_api.getUsers)
api.delete('/admin/users/:user_id', admin_user_api.deleteUser)
api.post('/admin/users', admin_user_api.createUser)
api.post('/admin/users/:user_id/reset_password', admin_user_api.resetPassword)
api.get('/admin/user_roles', async (c) => c.json(getUserRoles(c)))
api.post('/admin/user_roles', admin_user_api.updateUserRoles)

// user oauth2 settings
api.get('/admin/user_oauth2_settings', oauth2_settings.getUserOauth2Settings)
api.post('/admin/user_oauth2_settings', oauth2_settings.saveUserOauth2Settings)

// webhook settings
api.get("/admin/webhook/settings", webhook_settings.getWebhookSettings);
api.post("/admin/webhook/settings", webhook_settings.saveWebhookSettings);

// mail webhook settings
api.get("/admin/mail_webhook/settings", mail_webhook_settings.getWebhookSettings);
api.post("/admin/mail_webhook/settings", mail_webhook_settings.saveWebhookSettings);
api.post("/admin/mail_webhook/test", mail_webhook_settings.testWebhookSettings);

// worker config
api.get("/admin/worker/configs", worker_config.getConfig);

// send mail by admin
api.post("/admin/send_mail", sendMailbyAdmin);
