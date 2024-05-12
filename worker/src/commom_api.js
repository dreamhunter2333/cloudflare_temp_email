import { Hono } from 'hono'

import { getDomains, getPasswords, getBooleanValue } from './utils';
import { CONSTANTS } from './constants';

const api = new Hono()

api.get('/open_api/settings', async (c) => {
    // check header x-custom-auth
    let needAuth = false;
    const passwords = getPasswords(c);
    if (passwords && passwords.length > 0) {
        const auth = c.req.raw.headers.get("x-custom-auth");
        needAuth = !passwords.includes(auth);
    }
    return c.json({
        "prefix": c.env.PREFIX,
        "domains": getDomains(c),
        "needAuth": needAuth,
        "adminContact": c.env.ADMIN_CONTACT,
        "enableUserCreateEmail": getBooleanValue(c.env.ENABLE_USER_CREATE_EMAIL),
        "enableUserDeleteEmail": getBooleanValue(c.env.ENABLE_USER_DELETE_EMAIL),
        "enableAutoReply": getBooleanValue(c.env.ENABLE_AUTO_REPLY),
        "copyright": c.env.COPYRIGHT,
        "cfTurnstileSiteKey": c.env.CF_TURNSTILE_SITE_KEY,
        "version": CONSTANTS.VERSION,
    });
})

export { api }
