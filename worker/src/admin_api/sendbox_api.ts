import { Context } from 'hono'

import { handleListQuery } from '../common'

const list = async (c: Context<HonoCustomType>) => {
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
};

const remove = async (c: Context<HonoCustomType>) => {
    const { id } = c.req.param();
    const { success } = await c.env.DB.prepare(
        `DELETE FROM sendbox WHERE id = ? `
    ).bind(id).run();
    return c.json({ success });
};

export default { list, remove };
