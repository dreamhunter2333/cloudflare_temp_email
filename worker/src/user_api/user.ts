import { Context } from 'hono';
import { Jwt } from 'hono/utils/jwt'

import i18n from '../i18n';
import { checkCfTurnstile, getJsonSetting, checkUserPassword, getUserRoles, getStringValue } from "../utils"
import { CONSTANTS } from "../constants";
import { GeoData, UserInfo, UserSettings } from "../models";
import { sendMail } from "../mails_api/send_mail_api";

export default {
    verifyCode: async (c: Context<HonoCustomType>) => {
        const { email, cf_token } = await c.req.json();
        const msgs = i18n.getMessagesbyContext(c);
        // check cf turnstile
        try {
            await checkCfTurnstile(c, cf_token);
        } catch (error) {
            return c.text(msgs.TurnstileCheckFailedMsg, 500)
        }
        const value = await getJsonSetting(c, CONSTANTS.USER_SETTINGS_KEY);
        const settings = new UserSettings(value)
        // check mail domain allow list
        const mailDomain = email.split("@")[1];
        if (settings.enableMailAllowList
            && settings.mailAllowList
            && !settings.mailAllowList.includes(mailDomain)
        ) {
            return c.text(`${msgs.UserMailDomainMustInMsg} ${JSON.stringify(settings.mailAllowList, null, 2)}`, 400)
        }
        // check email regex
        if (settings.enableEmailCheckRegex && settings.emailCheckRegex) {
            try {
                const regex = new RegExp(settings.emailCheckRegex);
                if (!regex.test(email)) {
                    return c.text(`${msgs.UserEmailNotMatchRegexMsg}: /${settings.emailCheckRegex}/`, 400)
                }
            } catch (e) {
                console.error("Failed to check user email regex", e);
            }
        }
        if (!settings.verifyMailSender) {
            return c.text(msgs.VerifyMailSenderNotSetMsg, 400)
        }
        // check if code exists in KV
        const tmpcode = await c.env.KV.get(`temp-mail:${email}`)
        if (tmpcode) {
            return c.text(msgs.CodeAlreadySentMsg, 400)
        }
        // generate code 6 digits and convert to string
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        // send code to email
        try {
            await sendMail(c, settings.verifyMailSender, {
                from_name: "Temp Mail Verify",
                to_name: '',
                to_mail: email as string,
                subject: "Temp Mail Verify code",
                content: `Your verify code is ${code}`,
                is_html: false,
            })
        } catch (e) {
            return c.text(`Failed to send verify code: ${(e as Error).message}`, 500)
        }
        // save to KV
        await c.env.KV.put(`temp-mail:${email}`, code, { expirationTtl: 300 });
        return c.json({
            success: true,
            expirationTtl: 300
        })
    },
    register: async (c: Context<HonoCustomType>) => {
        const value = await getJsonSetting(c, CONSTANTS.USER_SETTINGS_KEY);
        const settings = new UserSettings(value)
        const msgs = i18n.getMessagesbyContext(c);
        // check enable
        if (!settings.enable) {
            return c.text(msgs.UserRegistrationDisabledMsg, 403);
        }
        // check request
        const { email, password, code } = await c.req.json();
        if (!email || !password) {
            return c.text(msgs.InvalidEmailOrPasswordMsg, 400)
        }
        checkUserPassword(password);
        if (settings.enableMailVerify && !code) {
            return c.text(msgs.InvalidVerifyCodeMsg, 400)
        }
        // check mail domain allow list
        const mailDomain = email.split("@")[1];
        if (settings.enableMailAllowList
            && settings.mailAllowList
            && !settings.mailAllowList.includes(mailDomain)
        ) {
            return c.text(`${msgs.UserMailDomainMustInMsg} ${JSON.stringify(settings.mailAllowList, null, 2)}`, 400)
        }
        // check email regex
        if (settings.enableEmailCheckRegex && settings.emailCheckRegex) {
            try {
                const regex = new RegExp(settings.emailCheckRegex);
                if (!regex.test(email)) {
                    return c.text(`${msgs.UserEmailNotMatchRegexMsg}: /${settings.emailCheckRegex}/`, 400)
                }
            } catch (e) {
                console.error("Failed to check user email regex", e);
            }
        }
        // check code
        if (settings.enableMailVerify) {
            const verifyCode = await c.env.KV.get(`temp-mail:${email}`)
            if (verifyCode != code) {
                return c.text(msgs.InvalidVerifyCodeMsg, 400)
            }
        }
        // geo data
        const reqIp = c.req.raw.headers.get("cf-connecting-ip")
        const geoData = new GeoData(reqIp, c.req.raw.cf as any);
        const userInfo = new UserInfo(geoData, email);
        // if not enable mail verify, do not on conflict update
        if (!settings.enableMailVerify) {
            try {
                const { success } = await c.env.DB.prepare(
                    `INSERT INTO users (user_email, password, user_info)`
                    + ` VALUES (?, ?, ?)`
                ).bind(
                    email, password, JSON.stringify(userInfo)
                ).run();
                if (!success) {
                    return c.text(msgs.FailedToRegisterMsg, 500)
                }
            } catch (e) {
                const error = e as Error;
                if (error.message && error.message.includes("UNIQUE")) {
                    return c.text(msgs.UserAlreadyExistsMsg, 400)
                }
                return c.text(`${msgs.FailedToRegisterMsg}: ${error.message}`, 500)
            }
            return c.json({ success: true })
        }
        // if enable mail verify, on conflict update
        const { success } = await c.env.DB.prepare(
            `INSERT INTO users (user_email, password, user_info)`
            + ` VALUES (?, ?, ?)`
            + ` ON CONFLICT(user_email) DO UPDATE SET password = ?, user_info = ?, updated_at = datetime('now')`
        ).bind(
            email, password, JSON.stringify(userInfo),
            password, JSON.stringify(userInfo)
        ).run();
        if (!success) {
            return c.text(msgs.FailedToRegisterMsg, 400);
        }
        const defaultRole = getStringValue(c.env.USER_DEFAULT_ROLE);
        if (!defaultRole) return c.json({ success: true })
        const user_roles = getUserRoles(c);
        if (!user_roles.find((r) => r.role === defaultRole)) {
            return c.text(msgs.InvalidUserDefaultRoleMsg, 500);
        }
        // find user_id
        const user_id = await c.env.DB.prepare(
            `SELECT id FROM users where user_email = ?`
        ).bind(email).first<number | undefined | null>("id");
        if (!user_id) {
            return c.text(msgs.UserNotFoundMsg, 500);
        }
        // update user roles
        const { success: success2 } = await c.env.DB.prepare(
            `INSERT INTO user_roles (user_id, role_text)`
            + ` VALUES (?, ?)`
            + ` ON CONFLICT(user_id) DO NOTHING`
        ).bind(user_id, defaultRole).run();
        if (!success2) {
            return c.text(msgs.FailedUpdateUserDefaultRoleMsg, 500);
        }
        return c.json({ success: true })
    },
    login: async (c: Context<HonoCustomType>) => {
        const { email, password } = await c.req.json();
        const msgs = i18n.getMessagesbyContext(c);
        if (!email || !password) return c.text(msgs.InvalidEmailOrPasswordMsg, 400);
        const { id: user_id, password: dbPassword } = await c.env.DB.prepare(
            `SELECT id, password FROM users where user_email = ?`
        ).bind(email).first() || {};
        if (!dbPassword) {
            return c.text(msgs.UserNotFoundMsg, 400)
        }
        // TODO: need check password use random salt
        if (dbPassword != password) {
            return c.text(msgs.InvalidEmailOrPasswordMsg, 400)
        }
        // create jwt
        const jwt = await Jwt.sign({
            user_email: email,
            user_id: user_id,
            // 90 days expire in seconds
            exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            iat: Math.floor(Date.now() / 1000),
        }, c.env.JWT_SECRET, "HS256")
        return c.json({
            jwt: jwt
        })
    },
}
