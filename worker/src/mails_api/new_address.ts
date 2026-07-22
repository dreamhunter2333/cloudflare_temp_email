import { Context } from 'hono'

import i18n from '../i18n';
import { getBooleanValue, getJsonSetting, checkCfTurnstile, isAddressCountLimitReached } from '../utils';
import { newAddress, getAddressPrefix, generateRandomName } from '../common'
import { CONSTANTS } from '../constants'

const createNewAddress = async (c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c);
    const userPayload = c.get("userPayload");

    if (getBooleanValue(c.env.DISABLE_ANONYMOUS_USER_CREATE_EMAIL)
        && !userPayload
    ) {
        return c.text(msgs.NewAddressAnonymousDisabledMsg, 403)
    }
    if (!getBooleanValue(c.env.ENABLE_USER_CREATE_EMAIL)) {
        return c.text(msgs.NewAddressDisabledMsg, 403)
    }

    // 如果启用了禁止匿名创建，且用户已登录，检查地址数量限制
    if (getBooleanValue(c.env.DISABLE_ANONYMOUS_USER_CREATE_EMAIL) && userPayload) {
        const userRole = c.get("userRolePayload");
        if (await isAddressCountLimitReached(c, userPayload.user_id, userRole)) {
            return c.text(msgs.MaxAddressCountReachedMsg, 400)
        }
    }

    // eslint-disable-next-line prefer-const
    let { name, domain, cf_token, enableRandomSubdomain } = await c.req.json();
    // check cf turnstile
    try {
        await checkCfTurnstile(c, cf_token);
    } catch (error) {
        return c.text(msgs.TurnstileCheckFailedMsg, 400)
    }
    // Check if custom email names are disabled from environment variable
    const disableCustomAddressName = getBooleanValue(c.env.DISABLE_CUSTOM_ADDRESS_NAME);

    // if no name or custom names are disabled, generate random name
    if (!name || disableCustomAddressName) {
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
        const sourceMeta = c.req.header('CF-Connecting-IP')
            || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim()
            || c.req.header('X-Real-IP')
            || 'web:unknown';
        const res = await newAddress(c, {
            name, domain,
            enablePrefix: true,
            enableRandomSubdomain: getBooleanValue(enableRandomSubdomain),
            checkLengthByConfig: true,
            addressPrefix,
            sourceMeta
        });
        return c.json(res);
    } catch (e) {
        return c.text(`${msgs.FailedCreateAddressMsg}: ${(e as Error).message}`, 400)
    }
};

export default { createNewAddress };
