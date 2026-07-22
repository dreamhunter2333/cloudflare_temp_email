import { Context } from 'hono'

import { CONSTANTS } from '../constants'
import { getJsonSetting, getIntValue, getSplitStringListValue } from '../utils'

const ensureDefaultSendBalance = async (
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
    // Auto-initialize a sender row only when one does not exist yet.
    // Existing rows — including admin-disabled ones — are never touched.
    await c.env.DB.prepare(
        `INSERT INTO address_sender (address, balance, enabled) VALUES (?, ?, ?)
        ON CONFLICT(address) DO NOTHING`
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
    needCheckBalance: boolean,
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
    const needCheckBalance = !options?.isAdmin && !isNoLimitSender;
    if (needCheckBalance && options?.initializeDefaultBalance !== false) {
        await ensureDefaultSendBalance(c, address);
    }
    if (isNoLimitSender) {
        return {
            isNoLimitSender: true,
            needCheckBalance: false,
            balance: 99999,
        };
    }
    return {
        isNoLimitSender: false,
        needCheckBalance: needCheckBalance,
        balance: await getEnabledSendBalance(c, address),
    };
}

export const requestSendMailAccess = async (
    c: Context<HonoCustomType>,
    address: string
): Promise<{
    status: 'ok' | 'already_requested' | 'operation_failed'
}> => {
    const default_balance = getIntValue(c.env.DEFAULT_SEND_BALANCE, 0);
    if (default_balance > 0) {
        await ensureDefaultSendBalance(c, address);
        const { balance } = await getSendBalanceState(c, address, {
            initializeDefaultBalance: false,
        });
        if (balance && balance > 0) {
            return { status: 'ok' };
        }
        return { status: 'already_requested' };
    }
    try {
        const { success } = await c.env.DB.prepare(
            `INSERT INTO address_sender (address, balance, enabled) VALUES (?, ?, ?)`
        ).bind(
            address, default_balance, default_balance > 0 ? 1 : 0
        ).run();
        if (!success) {
            return { status: 'operation_failed' };
        }
    } catch (e) {
        const message = (e as Error).message;
        if (message && message.includes("UNIQUE")) {
            return { status: 'already_requested' };
        }
        return { status: 'operation_failed' };
    }
    return { status: 'ok' };
}
