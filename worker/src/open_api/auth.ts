import { Hono } from 'hono'

import utils, { checkCfTurnstile, getAdminPasswords, getPasswords } from '../utils';
import i18n from '../i18n';

const api = new Hono<HonoCustomType>()

api.post('/open_api/site_login', async (c) => {
    const { password, cf_token } = await c.req.json();
    const msgs = i18n.getMessagesbyContext(c);
    if (utils.getBooleanValue(c.env.ENABLE_LOGIN_TURNSTILE_CHECK)) {
        try {
            await checkCfTurnstile(c, cf_token);
        } catch (error) {
            return c.text(msgs.TurnstileCheckFailedMsg, 400)
        }
    }
    const passwords = getPasswords(c);
    if (!passwords.length || !password || !passwords.includes(password)) {
        return c.text(msgs.NeedAdminPasswordMsg, 401)
    }
    return c.json({ success: true })
})

api.post('/open_api/admin_login', async (c) => {
    const { password, cf_token } = await c.req.json();
    const msgs = i18n.getMessagesbyContext(c);
    // check cf turnstile if login turnstile is enabled
    if (utils.getBooleanValue(c.env.ENABLE_LOGIN_TURNSTILE_CHECK)) {
        try {
            await checkCfTurnstile(c, cf_token);
        } catch (error) {
            return c.text(msgs.TurnstileCheckFailedMsg, 400)
        }
    }
    const adminPasswords = getAdminPasswords(c);
    if (!adminPasswords.length || !password || !adminPasswords.includes(password)) {
        return c.text(msgs.NeedAdminPasswordMsg, 401)
    }
    return c.json({ success: true })
})

export { api }
