import { Hono } from 'hono'

import utils from './utils';
import { CONSTANTS } from './constants';
import { isS3Enabled } from './mails_api/s3_attachment';
import { isAnySendMailEnabled } from './common';

const api = new Hono<HonoCustomType>

api.get('/open_api/settings', async (c) => {
    // check header x-custom-auth
    let needAuth = false;
    const passwords = utils.getPasswords(c);
    if (passwords && passwords.length > 0) {
        const auth = c.req.raw.headers.get("x-custom-auth");
        needAuth = !auth || !passwords.includes(auth);
    }

    return c.json({
        "title": c.env.TITLE,
        "announcement": utils.getStringValue(c.env.ANNOUNCEMENT),
        "alwaysShowAnnouncement": utils.getBooleanValue(c.env.ALWAYS_SHOW_ANNOUNCEMENT),
        "prefix": utils.getStringValue(c.env.PREFIX),
        "addressRegex": utils.getStringValue(c.env.ADDRESS_REGEX),
        "minAddressLen": utils.getIntValue(c.env.MIN_ADDRESS_LEN, 1),
        "maxAddressLen": utils.getIntValue(c.env.MAX_ADDRESS_LEN, 30),
        "defaultDomains": utils.getDefaultDomains(c),
        "domains": utils.getDomains(c),
        "domainLabels": utils.getStringArray(c.env.DOMAIN_LABELS),
        "needAuth": needAuth,
        "adminContact": c.env.ADMIN_CONTACT,
        "enableUserCreateEmail": utils.getBooleanValue(c.env.ENABLE_USER_CREATE_EMAIL),
        "disableAnonymousUserCreateEmail": utils.getBooleanValue(c.env.DISABLE_ANONYMOUS_USER_CREATE_EMAIL),
        "disableCustomAddressName": utils.getBooleanValue(c.env.DISABLE_CUSTOM_ADDRESS_NAME),
        "enableUserDeleteEmail": utils.getBooleanValue(c.env.ENABLE_USER_DELETE_EMAIL),
        "enableAutoReply": utils.getBooleanValue(c.env.ENABLE_AUTO_REPLY),
        "enableIndexAbout": utils.getBooleanValue(c.env.ENABLE_INDEX_ABOUT),
        "copyright": c.env.COPYRIGHT,
        "cfTurnstileSiteKey": c.env.CF_TURNSTILE_SITE_KEY,
        "enableWebhook": utils.getBooleanValue(c.env.ENABLE_WEBHOOK),
        "isS3Enabled": isS3Enabled(c),
        "enableSendMail": isAnySendMailEnabled(c),
        "version": CONSTANTS.VERSION,
        "showGithub": !utils.getBooleanValue(c.env.DISABLE_SHOW_GITHUB),
        "disableAdminPasswordCheck": utils.getBooleanValue(c.env.DISABLE_ADMIN_PASSWORD_CHECK),
        "enableAddressPassword": utils.getBooleanValue(c.env.ENABLE_ADDRESS_PASSWORD)
    });
})

export { api }
