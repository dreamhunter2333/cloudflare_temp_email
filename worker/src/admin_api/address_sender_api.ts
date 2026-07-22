import { Context } from 'hono'

import i18n from '../i18n'
import { sendAdminInternalMail } from '../utils'
import { handleListQuery } from '../common'

const list = async (c: Context<HonoCustomType>) => {
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
};

const update = async (c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c);
    /* eslint-disable prefer-const */
    let { address, address_id, balance, enabled } = await c.req.json();
    /* eslint-enable prefer-const */
    if (!address_id) {
        return c.text(msgs.InvalidAddressIdMsg, 400)
    }
    enabled = enabled ? 1 : 0;
    const { success } = await c.env.DB.prepare(
        `UPDATE address_sender SET enabled = ?, balance = ? WHERE id = ? `
    ).bind(enabled, balance, address_id).run();
    if (!success) {
        return c.text(msgs.OperationFailedMsg, 500)
    }
    await sendAdminInternalMail(
        c, address, "Account Send Access Updated",
        `Your send access has been ${enabled ? "enabled" : "disabled"}, balance: ${balance}`
    );
    return c.json({ success });
};

const remove = async (c: Context<HonoCustomType>) => {
    const { id } = c.req.param();
    const { success } = await c.env.DB.prepare(
        `DELETE FROM address_sender WHERE id = ? `
    ).bind(id).run();
    return c.json({ success });
};

export default { list, update, remove };
