import { Hono } from 'hono'

import { getDomains, getPasswords, getBooleanValue, getIntValue, getStringArray, getDefaultDomains, getStringValue } from './utils';
import { CONSTANTS } from './constants';
import { HonoCustomType } from './types';
import { isS3Enabled } from './mails_api/s3_attachment';

const api = new Hono<HonoCustomType>

api.get('/open_api/settings', async (c) => {
    // check header x-custom-auth
    let needAuth = false;
    const passwords = getPasswords(c);
    if (passwords && passwords.length > 0) {
        const auth = c.req.raw.headers.get("x-custom-auth");
        needAuth = !auth || !passwords.includes(auth);
    }
    return c.json({
        "title": c.env.TITLE,
        "announcement": getStringValue(c.env.ANNOUNCEMENT),
        "prefix": c.env.PREFIX,
        "minAddressLen": getIntValue(c.env.MIN_ADDRESS_LEN, 1),
        "maxAddressLen": getIntValue(c.env.MAX_ADDRESS_LEN, 30),
        "defaultDomains": getDefaultDomains(c),
        "domains": getDomains(c),
        "domainLabels": getStringArray(c.env.DOMAIN_LABELS),
        "needAuth": needAuth,
        "adminContact": c.env.ADMIN_CONTACT,
        "enableUserCreateEmail": getBooleanValue(c.env.ENABLE_USER_CREATE_EMAIL),
        "enableUserDeleteEmail": getBooleanValue(c.env.ENABLE_USER_DELETE_EMAIL),
        "enableAutoReply": getBooleanValue(c.env.ENABLE_AUTO_REPLY),
        "enableIndexAbout": getBooleanValue(c.env.ENABLE_INDEX_ABOUT),
        "copyright": c.env.COPYRIGHT,
        "cfTurnstileSiteKey": c.env.CF_TURNSTILE_SITE_KEY,
        "enableWebhook": getBooleanValue(c.env.ENABLE_WEBHOOK),
        "isS3Enabled": isS3Enabled(c),
        "version": CONSTANTS.VERSION,
        "showGithub": !getBooleanValue(c.env.DISABLE_SHOW_GITHUB),
    });
})

export { api }
