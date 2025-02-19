import { Context } from 'hono';
import { Jwt } from 'hono/utils/jwt'

import i18n from '../i18n';
import { HonoCustomType } from '../types';
import { getJsonSetting } from '../utils';
import { UserOauth2Settings } from '../models';
import { CONSTANTS } from '../constants';


export default {
    getOauth2LoginUrl: async (c: Context<HonoCustomType>) => {
        const settings = await getJsonSetting<UserOauth2Settings[]>(c, CONSTANTS.OAUTH2_SETTINGS_KEY);
        const { clientID, state } = c.req.query();
        const lang = c.get("lang") || c.env.DEFAULT_LANG;
        const msgs = i18n.getMessages(lang);
        const setting = settings?.find(s => s.clientID === clientID);
        if (!setting) {
            return c.text(msgs.Oauth2ClientIDNotFoundMsg, 400);
        }
        const url = `${setting.authorizationURL}?client_id=${setting.clientID}&response_type=code&redirect_uri=${setting.redirectURL}&scope=${setting.scope}&state=${state}`
        return c.json({ url });
    },
    oauth2Login: async (c: Context<HonoCustomType>) => {
        const { clientID, code } = await c.req.json<{ clientID?: string, code?: string }>();
        const lang = c.get("lang") || c.env.DEFAULT_LANG;
        const msgs = i18n.getMessages(lang);
        if (!clientID || !code) {
            return c.text(msgs.Oauth2CliendIDOrCodeMissingMsg, 400);
        }
        const settings = await getJsonSetting<UserOauth2Settings[]>(c, CONSTANTS.OAUTH2_SETTINGS_KEY);
        const setting = settings?.find(s => s.clientID === clientID);
        if (!setting) {
            return c.text(msgs.Oauth2ClientIDNotFoundMsg, 400);
        }
        const params = {
            code,
            client_id: setting.clientID,
            client_secret: setting.clientSecret,
            grant_type: 'authorization_code',
        }
        const res = await fetch(setting.accessTokenURL, {
            method: 'POST',
            body: setting.accessTokenFormat === 'json'
                ? JSON.stringify(params) :
                new URLSearchParams(params).toString(),
            headers: {
                'Content-Type': setting.accessTokenFormat === 'json'
                    ? 'application/json'
                    : 'application/x-www-form-urlencoded',
                "Accept": "application/json"
            }
        })
        if (!res.ok) {
            console.error(`Failed to get access token: ${res.status} ${res.statusText} ${await res.text()}`)
            return c.text(msgs.Oauth2FailedGetAccessTokenMsg, 400);
        }
        const resJson = await res.json();
        const { access_token, token_type } = resJson as { access_token: string, token_type?: string };
        const user = await fetch(setting.userInfoURL, {
            headers: {
                "Authorization": `${token_type || 'Bearer'} ${access_token}`,
                "Accept": "application/json",
                "User-Agent": "Cloudflare Workers"
            }
        })
        if (!user.ok) {
            console.error(`Failed to get user info: ${res.status} ${res.statusText} ${await res.text()}`)
            return c.text(msgs.Oauth2FailedGetUserInfoMsg, 400);
        }
        const userInfo = await user.json()
        const { [setting.userEmailKey]: email } = userInfo as { [key: string]: string };
        if (!email) {
            return c.text(msgs.Oauth2FailedGetUserEmailMsg, 400);
        }
        // check email in mail allow list
        const mailDomain = email.split("@")[1];
        if (setting.enableMailAllowList && !setting.mailAllowList?.includes(mailDomain)) {
            return c.text(`${msgs.UserMailDomainMustInMsg} ${JSON.stringify(setting.mailAllowList, null, 2)}`, 400)
        }
        // insert or update user
        const { success } = await c.env.DB.prepare(
            `INSERT INTO users (user_email, password, user_info)`
            + ` VALUES (?, '', ?)`
            + ` ON CONFLICT(user_email) DO UPDATE SET updated_at = datetime('now')`
        ).bind(
            email, JSON.stringify(userInfo)
        ).run();
        if (!success) {
            return c.text(msgs.FailedToRegisterMsg, 500)
        }
        const { id: user_id } = await c.env.DB.prepare(
            `SELECT id FROM users where user_email = ?`
        ).bind(email).first() || {};
        if (!user_id) {
            return c.text(msgs.UserNotFoundMsg, 400)
        }
        // create jwt
        const jwt = await Jwt.sign({
            user_email: email,
            user_id: user_id,
            // 90 days expire in seconds
            exp: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
            iat: Math.floor(Date.now() / 1000),
        }, c.env.JWT_SECRET, "HS256")
        return c.json({
            jwt: jwt
        })
    }
}
