import { Context } from "hono";

import { handleListQuery } from "../common";
import i18n from "../i18n";
import { sendMail } from "../mails_api/send_mail_api";
import {
    getSendBalanceState,
    requestSendMailAccess,
} from "../mails_api/send_balance";
import { getBooleanValue } from "../utils";
import { getBindedAddressById } from "./bind_address";

const getAddressOrError = async (
    c: Context<HonoCustomType>
): Promise<string | Response> => {
    const addressId = Number(c.req.param("address_id"));
    if (!Number.isInteger(addressId) || addressId <= 0) {
        const msgs = i18n.getMessagesbyContext(c);
        return c.text(msgs.AddressNotBindedMsg, 400);
    }
    const { user_id } = c.get("userPayload");
    const address = await getBindedAddressById(c, user_id, addressId);
    if (address) {
        return address;
    }
    const msgs = i18n.getMessagesbyContext(c);
    return c.text(msgs.AddressNotBindedMsg, 400);
}

const settings = async (c: Context<HonoCustomType>): Promise<Response> => {
    const address = await getAddressOrError(c);
    if (address instanceof Response) {
        return address;
    }
    const { balance } = await getSendBalanceState(c, address);
    return c.json({
        address,
        send_balance: balance || 0,
    });
}

const requestAccess = async (c: Context<HonoCustomType>): Promise<Response> => {
    const address = await getAddressOrError(c);
    if (address instanceof Response) {
        return address;
    }
    const msgs = i18n.getMessagesbyContext(c);
    const result = await requestSendMailAccess(c, address);
    if (result.status === "ok") {
        return c.json({ status: "ok" });
    }
    if (result.status === "already_requested") {
        return c.text(msgs.AlreadyRequestedMsg, 400);
    }
    return c.text(msgs.OperationFailedMsg, 500);
}

const send = async (c: Context<HonoCustomType>): Promise<Response> => {
    const address = await getAddressOrError(c);
    if (address instanceof Response) {
        return address;
    }
    try {
        const reqJson = await c.req.json();
        await sendMail(c, address, reqJson);
    } catch (error) {
        console.error("Failed to send user mail", error);
        return c.text(`Failed to send mail ${(error as Error).message}`, 400);
    }
    return c.json({ status: "ok" });
}

const listUserSendbox = async (c: Context<HonoCustomType>): Promise<Response> => {
    const { user_id } = c.get("userPayload");
    const { address, limit, offset } = c.req.query();
    const filters = ["ua.user_id = ?"];
    const params = [String(user_id)];
    if (address) {
        filters.push("sb.address = ?");
        params.push(address);
    }
    const fromQuery = ` FROM users_address ua`
        + ` JOIN address a ON a.id = ua.address_id`
        + ` JOIN sendbox sb ON sb.address = a.name`
        + ` WHERE ${filters.join(" AND ")}`;
    return await handleListQuery(c,
        `SELECT sb.*${fromQuery}`,
        `SELECT count(*) as count${fromQuery}`,
        params, limit, offset, "sb.id desc"
    );
}

const removeUserSendboxMail = async (c: Context<HonoCustomType>): Promise<Response> => {
    const msgs = i18n.getMessagesbyContext(c);
    if (!getBooleanValue(c.env.ENABLE_USER_DELETE_EMAIL)) {
        return c.text(msgs.UserDeleteEmailDisabledMsg, 403);
    }
    const { user_id } = c.get("userPayload");
    const { mail_id } = c.req.param();
    const { success } = await c.env.DB.prepare(
        `DELETE FROM sendbox WHERE id = ?`
        + ` AND EXISTS (`
        + `SELECT 1 FROM users_address ua`
        + ` JOIN address a ON a.id = ua.address_id`
        + ` WHERE ua.user_id = ? AND a.name = sendbox.address`
        + `)`
    ).bind(mail_id, user_id).run();
    return c.json({ success });
}

export default {
    settings,
    requestAccess,
    send,
    listUserSendbox,
    removeUserSendboxMail,
};
