import { Context } from 'hono'

import { CONSTANTS } from '../constants'
import { getJsonSetting, getIntValue, getSplitStringListValue } from '../utils'

export const ensureDefaultSendBalance = async (
    c: Context<HonoCustomType>,
    address: string
): Promise<void> => {
    if (!address) {
        return;
    }
    const default_balance = getIntValue(c.env.DEFAULT_SEND_BALANCE, 0);
    if (default_balance <= 0) {
        return;
    }
    await c.env.DB.prepare(
        `INSERT INTO address_sender (address, balance, enabled) VALUES (?, ?, ?)
        ON CONFLICT(address) DO UPDATE SET
            balance = excluded.balance,
            enabled = excluded.enabled
        WHERE excluded.balance > 0
            AND address_sender.balance <= 0
            AND address_sender.enabled = 0`
    ).bind(address, default_balance, 1).run();
}

export const getEnabledSendBalance = async (
    c: Context<HonoCustomType>,
    address: string
): Promise<number | null> => {
    const balance = await c.env.DB.prepare(
        `SELECT balance FROM address_sender where address = ? and enabled = 1`
    ).bind(address).first<number>("balance");
    return typeof balance === "number" ? balance : null;
}

export const getSendBalanceState = async (
    c: Context<HonoCustomType>,
    address: string,
    options?: {
        isAdmin?: boolean,
        initializeDefaultBalance?: boolean
    }
): Promise<{
    isNoLimitSender: boolean,
    balance: number | null
}> => {
    const user_role = c.get("userRolePayload");
    const no_limit_roles = getSplitStringListValue(c.env.NO_LIMIT_SEND_ROLE);
    const is_no_limit_send_balance = typeof user_role === "string"
        && no_limit_roles.includes(user_role);
    const noLimitSendAddressList = is_no_limit_send_balance ?
        [] : await getJsonSetting(c, CONSTANTS.NO_LIMIT_SEND_ADDRESS_LIST_KEY) || [];
    const isNoLimitSendAddress = !!noLimitSendAddressList?.includes(address);
    const isNoLimitSender = is_no_limit_send_balance || isNoLimitSendAddress;
    if (!isNoLimitSender && !options?.isAdmin && options?.initializeDefaultBalance !== false) {
        await ensureDefaultSendBalance(c, address);
    }
    if (isNoLimitSender) {
        return {
            isNoLimitSender: true,
            balance: 99999,
        };
    }
    return {
        isNoLimitSender: false,
        balance: await getEnabledSendBalance(c, address),
    };
}
