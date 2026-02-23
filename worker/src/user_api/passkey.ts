import { Context } from 'hono';
import { Jwt } from 'hono/utils/jwt'
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse
} from '@simplewebauthn/server';

import { Passkey } from '../models';
import { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/types';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import i18n from '../i18n';

export default {
    getPassKeys: async (c: Context<HonoCustomType>) => {
        const user = c.get("userPayload");
        const { results } = await c.env.DB.prepare(
            `SELECT passkey_name, passkey_id, created_at, updated_at FROM user_passkeys WHERE user_id = ?`
        ).bind(user.user_id).all<Record<string, string>>();
        return c.json(results);
    },
    renamePassKey: async (c: Context<HonoCustomType>) => {
        const msgs = i18n.getMessagesbyContext(c);
        const user = c.get("userPayload");
        const { passkey_id, passkey_name } = await c.req.json();
        if (!passkey_name || passkey_name.length > 255) {
            return c.text(msgs.InvalidPasskeyNameMsg, 400);
        }
        const { success } = await c.env.DB.prepare(
            `UPDATE user_passkeys SET passkey_name = ? WHERE user_id = ? AND passkey_id = ?`
        ).bind(passkey_name, user.user_id, passkey_id).run();
        return c.json({ success });
    },
    deletePassKey: async (c: Context<HonoCustomType>) => {
        const user = c.get("userPayload");
        const { passkey_id } = c.req.param();
        const { success } = await c.env.DB.prepare(
            `DELETE FROM user_passkeys WHERE user_id = ? AND passkey_id = ?`
        ).bind(user.user_id, passkey_id).run();
        return c.json({ success });
    },
    registerRequest: async (c: Context<HonoCustomType>) => {
        const user = c.get("userPayload");
        const { domain } = await c.req.json();
        const { results } = await c.env.DB.prepare(
            `SELECT passkey FROM user_passkeys WHERE user_id = ?`
        ).bind(user.user_id).all<Record<string, string>>();
        const excludeCredentials = results
            .map((record: any) => JSON.parse(record.passkey) as Passkey)
            .map((passkey: Passkey) => ({
                id: passkey.id,
                transports: passkey.transports,
            }));
        // create challenge with 1 hour expiration
        const challenge = await Jwt.sign({
            user_email: user.user_email,
            user_id: user.user_id,
            iat: Math.floor(Date.now() / 1000),
        }, c.env.JWT_SECRET, "HS256")
        // Use SimpleWebAuthn's handy function to create registration options.
        const options = await generateRegistrationOptions({
            rpName: c.env.TITLE || "Temp Mail",
            rpID: domain,
            userID: new TextEncoder().encode(user.user_id.toString()),
            userName: user.user_email,
            userDisplayName: user.user_email,
            attestationType: 'none',
            excludeCredentials: excludeCredentials,
            challenge: challenge,
        });

        return c.json(options);
    },
    registerResponse: async (c: Context<HonoCustomType>) => {
        const msgs = i18n.getMessagesbyContext(c);
        const user = c.get("userPayload");
        const { credential, origin, passkey_name } = await c.req.json();
        // Verify the registration response
        const verification = await verifyRegistrationResponse({
            response: credential,
            expectedChallenge: async (challenge: string) => {
                const payload = await Jwt.verify(atob(challenge), c.env.JWT_SECRET, "HS256");
                if (!payload || !payload.iat) return false;
                // check iad is not older than 5 minutes
                if (Math.floor(Date.now() / 1000) - payload.iat > 300) return false;
                if (payload.user_id !== user.user_id) return false;
                return true;
            },
            expectedOrigin: origin,
            requireUserVerification: true,
        });
        const { verified, registrationInfo } = verification;

        if (!verified || !registrationInfo) {
            return c.text(msgs.RegistrationFailedMsg, 400);
        }

        const {
            credentialID, credentialPublicKey,
            counter, credentialDeviceType, credentialBackedUp,
        } = registrationInfo;

        // Base64URL encode ArrayBuffers.
        const base64PublicKey = isoBase64URL.fromBuffer(credentialPublicKey);

        const newPasskey: Passkey = {
            id: credentialID,
            publicKey: base64PublicKey,
            counter,
            deviceType: credentialDeviceType,
            backedUp: credentialBackedUp,
            transports: credential?.response?.transports,
        };

        // Store the credential ID in the database
        const { success } = await c.env.DB.prepare(
            `INSERT INTO user_passkeys (user_id, passkey_name, passkey_id, passkey, counter) VALUES (?, ?, ?, ?, ?)`
        ).bind(user.user_id, passkey_name, credentialID, JSON.stringify(newPasskey), counter).run();

        return c.json({ success });
    },
    authenticateRequest: async (c: Context<HonoCustomType>) => {
        const { domain } = await c.req.json();
        const challenge = await Jwt.sign({
            domain,
            iat: Math.floor(Date.now() / 1000),
        }, c.env.JWT_SECRET, "HS256")
        const options: PublicKeyCredentialRequestOptionsJSON = await generateAuthenticationOptions({
            rpID: domain,
            challenge: challenge,
            allowCredentials: [],
        });
        return c.json(options);
    },
    authenticateResponse: async (c: Context<HonoCustomType>) => {
        const msgs = i18n.getMessagesbyContext(c);
        const { domain, credential, origin } = await c.req.json();
        const passkey_id = credential?.id;
        if (!passkey_id) {
            return c.text(msgs.InvalidInputMsg, 400);
        }
        const { user_id, counter, passkey } = await c.env.DB.prepare(
            `SELECT user_id, counter, passkey FROM user_passkeys WHERE passkey_id = ?`
        ).bind(passkey_id).first<{
            counter: number; passkey: string; user_id: number;
        }>() || {};
        if (!passkey) {
            return c.text(msgs.PasskeyNotFoundMsg, 404);
        }
        const passkeyData = JSON.parse(passkey) as Passkey;
        // Verify the registration response
        const verification = await verifyAuthenticationResponse({
            response: credential,
            expectedChallenge: async (challenge: string) => {
                const payload = await Jwt.verify(atob(challenge), c.env.JWT_SECRET, "HS256");
                if (!payload || !payload.iat) return false;
                // check iad is not older than 5 minutes
                if (Math.floor(Date.now() / 1000) - payload.iat > 300) return false;
                return true;
            },
            expectedOrigin: origin,
            expectedRPID: domain,
            authenticator: {
                credentialID: passkeyData.id,
                credentialPublicKey: isoBase64URL.toBuffer(passkeyData.publicKey),
                counter: counter || passkeyData.counter,
                transports: passkeyData.transports,
            },
        });
        const { verified, authenticationInfo } = verification;
        if (!verified) {
            return c.text(msgs.AuthenticationFailedMsg, 400);
        }

        if (authenticationInfo) {
            const { newCounter } = authenticationInfo;
            // Update the counter in the database
            await c.env.DB.prepare(
                `UPDATE user_passkeys SET counter = ? WHERE passkey_id = ?`
            ).bind(newCounter, passkey_id).run();
        }
        // update passkey updated_at
        await c.env.DB.prepare(
            `UPDATE user_passkeys SET updated_at = datetime('now') WHERE passkey_id = ?`
        ).bind(passkey_id).run();

        // return jwt
        const { user_email } = await c.env.DB.prepare(
            `SELECT user_email FROM users WHERE id = ?`
        ).bind(user_id).first<{ user_email: string }>() || {};
        if (!user_email) {
            return c.text(msgs.UserNotFoundMsg, 404);
        }
        // create jwt
        const jwt = await Jwt.sign({
            user_email: user_email,
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
