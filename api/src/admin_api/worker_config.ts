import { Context } from 'hono';

import utils from '../utils';
import { CONSTANTS } from '../constants';
import { isS3Enabled } from '../mails_api/s3_attachment';

export default {
    getConfig: async (c: Context<HonoCustomType>) => {
        return c.json({
            "DEFAULT_LANG": c.env.DEFAULT_LANG,
            "TITLE": c.env.TITLE,
            "HAS_PASSWORD": utils.getPasswords(c).length,
            "HAS_ADMIN_PASSWORDS": utils.getAdminPasswords(c).length,
            "ANNOUNCEMENT": utils.getStringValue(c.env.ANNOUNCEMENT),
            "ALWAYS_SHOW_ANNOUNCEMENT": utils.getBooleanValue(c.env.ALWAYS_SHOW_ANNOUNCEMENT),

            "PREFIX": utils.getStringValue(c.env.PREFIX),
            "ADDRESS_CHECK_REGEX": utils.getStringValue(c.env.ADDRESS_CHECK_REGEX),
            "ADDRESS_REGEX": utils.getStringValue(c.env.ADDRESS_REGEX),
            "MIN_ADDRESS_LEN": utils.getIntValue(c.env.MIN_ADDRESS_LEN, 1),
            "MAX_ADDRESS_LEN": utils.getIntValue(c.env.MAX_ADDRESS_LEN, 30),

            "FORWARD_ADDRESS_LIST": utils.getStringArray(c.env.FORWARD_ADDRESS_LIST),
            "SUBDOMAIN_FORWARD_ADDRESS_LIST": utils.getJsonObjectValue<SubdomainForwardAddressList[]>(c.env.SUBDOMAIN_FORWARD_ADDRESS_LIST),
            "DEFAULT_DOMAINS": utils.getDefaultDomains(c),
            "DOMAINS": utils.getDomains(c),
            "DOMAIN_LABELS": utils.getStringArray(c.env.DOMAIN_LABELS),

            "HAS_JWT_SECRET": !!utils.getStringValue(c.env.JWT_SECRET),

            "ADMIN_USER_ROLE": utils.getStringValue(c.env.ADMIN_USER_ROLE),
            "USER_DEFAULT_ROLE": utils.getStringValue(c.env.USER_DEFAULT_ROLE),
            "USER_ROLES": utils.getUserRoles(c),
            "NO_LIMIT_SEND_ROLE": utils.getSplitStringListValue(c.env.NO_LIMIT_SEND_ROLE),

            "ADMIN_CONTACT": c.env.ADMIN_CONTACT,
            "ENABLE_USER_CREATE_EMAIL": utils.getBooleanValue(c.env.ENABLE_USER_CREATE_EMAIL),
            "DISABLE_ANONYMOUS_USER_CREATE_EMAIL": utils.getBooleanValue(c.env.DISABLE_ANONYMOUS_USER_CREATE_EMAIL),
            "ENABLE_USER_DELETE_EMAIL": utils.getBooleanValue(c.env.ENABLE_USER_DELETE_EMAIL),
            "ENABLE_AUTO_REPLY": utils.getBooleanValue(c.env.ENABLE_AUTO_REPLY),
            "COPYRIGHT": c.env.COPYRIGHT,
            "ENABLE_WEBHOOK": utils.getBooleanValue(c.env.ENABLE_WEBHOOK),
            "S3_ENABLED": isS3Enabled(c),
            "VERSION": CONSTANTS.VERSION,
            "DISABLE_SHOW_GITHUB": !utils.getBooleanValue(c.env.DISABLE_SHOW_GITHUB),
            "DISABLE_ADMIN_PASSWORD_CHECK": utils.getBooleanValue(c.env.DISABLE_ADMIN_PASSWORD_CHECK),
            "ENABLE_CHECK_JUNK_MAIL": utils.getBooleanValue(c.env.ENABLE_CHECK_JUNK_MAIL),
            "JUNK_MAIL_CHECK_LIST": utils.getStringArray(c.env.JUNK_MAIL_CHECK_LIST),
            "JUNK_MAIL_FORCE_PASS_LIST": utils.getStringArray(c.env.JUNK_MAIL_FORCE_PASS_LIST),

            "REMOVE_EXCEED_SIZE_ATTACHMENT": utils.getBooleanValue(c.env.REMOVE_EXCEED_SIZE_ATTACHMENT),
            "REMOVE_ALL_ATTACHMENT": utils.getBooleanValue(c.env.REMOVE_ALL_ATTACHMENT),

            "ENABLE_ANOTHER_WORKER": utils.getBooleanValue(c.env.ENABLE_ANOTHER_WORKER),
            "ANOTHER_WORKER_LIST": utils.getAnotherWorkerList(c),
        })
    }
}
