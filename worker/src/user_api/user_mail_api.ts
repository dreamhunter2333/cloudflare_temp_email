import { Context } from "hono";
import { handleListQuery } from "../common";
import UserBindAddressModule from "./bind_address";

export default {
    getMails: async (c: Context<HonoCustomType>) => {
        const { user_id } = c.get("userPayload");
        const { address, limit, offset, keyword } = c.req.query();
        const bindedAddressList = await UserBindAddressModule.getBindedAddressListById(c, user_id);
        const addressList = address ? bindedAddressList.filter((item) => item == address) : bindedAddressList;
        const addressQuery = `address IN (${addressList.map(() => "?").join(",")})`;
        const addressParams = addressList;
        const keywordQuery = keyword ? `raw like ?` : "";
        const keywordParams = keyword ? [`%${keyword}%`] : [];

        // user must have at least one binded address to query mails
        if (addressList.length <= 0) {
            return c.json({ results: [], count: 0 });
        }

        const filterQuerys = [addressQuery, keywordQuery].filter((item) => item).join(" and ");
        const finalQuery = filterQuerys.length > 0 ? `where ${filterQuerys}` : "";
        const filterParams = [...addressParams, ...keywordParams]
        return await handleListQuery(c,
            `SELECT * FROM raw_mails ${finalQuery}`,
            `SELECT count(*) as count FROM raw_mails ${finalQuery}`,
            filterParams, limit, offset
        );
    },
    deleteMail: async (c: Context<HonoCustomType>) => {
        const { id } = c.req.param();
        const { user_id } = c.get("userPayload");
        const bindedAddressList = await UserBindAddressModule.getBindedAddressListById(c, user_id);
        const { success } = await c.env.DB.prepare(
            `DELETE FROM raw_mails WHERE id = ?`
            + ` and address IN (${bindedAddressList.map(() => "?").join(",")})`
        ).bind(id, ...bindedAddressList).run();
        return c.json({
            success: success
        })
    }
}
