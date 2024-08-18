import { Context } from 'hono';

import { HonoCustomType } from '../types';
import { getAdminPasswords, getBooleanValue, getDefaultDomains, getDomains, getIntValue, getPasswords, getStringArray, getStringValue, getUserRoles } from '../utils';
import { CONSTANTS } from '../constants';
import { isS3Enabled } from '../mails_api/s3_attachment';

export default {
    getConfig: async (c: Context<HonoCustomType>) => {
        return c.json({
            "TITLE": c.env.TITLE,
            "HAS_PASSWORD": getPasswords(c).length,
            "HAS_ADMIN_PASSWORDS": getAdminPasswords(c).length,
            "ANNOUNCEMENT": getStringValue(c.env.ANNOUNCEMENT),

            "PREFIX": c.env.PREFIX,
            "ADDRESS_CHECK_REGEX": getStringValue(c.env.ADDRESS_CHECK_REGEX),
            "ADDRESS_REGEX": getStringValue(c.env.ADDRESS_REGEX),
            "MIN_ADDRESS_LEN": getIntValue(c.env.MIN_ADDRESS_LEN, 1),
            "MAX_ADDRESS_LEN": getIntValue(c.env.MAX_ADDRESS_LEN, 30),

            "FORWARD_ADDRESS_LIST": getStringArray(c.env.FORWARD_ADDRESS_LIST),
            "DEFAULT_DOMAINS": getDefaultDomains(c),
            "DOMAINS": getDomains(c),
            "DOMAIN_LABELS": getStringArray(c.env.DOMAIN_LABELS),

            "HAS_JWT_SECRET": !!getStringValue(c.env.JWT_SECRET),

            "ADMIN_USER_ROLE": getStringValue(c.env.ADMIN_USER_ROLE),
            "USER_DEFAULT_ROLE": getStringValue(c.env.USER_DEFAULT_ROLE),
            "USER_ROLES": getUserRoles(c),
            "NO_LIMIT_SEND_ROLE": getStringValue(c.env.NO_LIMIT_SEND_ROLE),

            "ADMIN_CONTACT": c.env.ADMIN_CONTACT,
            "ENABLE_USER_CREATE_EMAIL": getBooleanValue(c.env.ENABLE_USER_CREATE_EMAIL),
            "ENABLE_USER_DELETE_EMAIL": getBooleanValue(c.env.ENABLE_USER_DELETE_EMAIL),
            "ENABLE_AUTO_REPLY": getBooleanValue(c.env.ENABLE_AUTO_REPLY),
            "COPYRIGHT": c.env.COPYRIGHT,
            "ENABLE_WEBHOOK": getBooleanValue(c.env.ENABLE_WEBHOOK),
            "S3_ENABLED": isS3Enabled(c),
            "VERSION": CONSTANTS.VERSION,
            "DISABLE_SHOW_GITHUB": !getBooleanValue(c.env.DISABLE_SHOW_GITHUB),
            "DISABLE_ADMIN_PASSWORD_CHECK": getBooleanValue(c.env.DISABLE_ADMIN_PASSWORD_CHECK)
        })
    }
}
