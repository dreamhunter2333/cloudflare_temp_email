import { Context } from "hono";
import { HonoCustomType } from "../types";
import { handleListQuery } from "../common";

export default {
    getMails: async (c: Context<HonoCustomType>) => {
        const { address, limit, offset, keyword } = c.req.query();
        const addressQuery = address ? `address = ?` : "";
        const addressParams = address ? [address] : [];
        const keywordQuery = keyword ? `raw like ?` : "";
        const keywordParams = keyword ? [`%${keyword}%`] : [];
        const filterQuerys = [addressQuery, keywordQuery].filter((item) => item).join(" and ");
        const finalQuery = filterQuerys.length > 0 ? `where ${filterQuerys}` : "";
        const filterParams = [...addressParams, ...keywordParams]
        return await handleListQuery(c,
            `SELECT * FROM raw_mails ${finalQuery}`,
            `SELECT count(*) as count FROM raw_mails ${finalQuery}`,
            filterParams, limit, offset
        );
    },
    getUnknowMails: async (c: Context<HonoCustomType>) => {
        const { limit, offset } = c.req.query();
        return await handleListQuery(c,
            `SELECT * FROM raw_mails where address NOT IN (select name from address) `,
            `SELECT count(*) as count FROM raw_mails`
            + ` where address NOT IN (select name from address) `,
            [], limit, offset
        );
    },
    deleteMail: async (c: Context<HonoCustomType>) => {
        const { id } = c.req.param();
        const { success } = await c.env.DB.prepare(
            `DELETE FROM raw_mails WHERE id = ? `
        ).bind(id).run();
        return c.json({
            success: success
        })
    }
}
