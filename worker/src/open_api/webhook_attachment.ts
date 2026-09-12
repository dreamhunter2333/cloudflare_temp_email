import { Context } from 'hono';

import { resolveRawEmail } from '../gzip';
import { RawMailRow } from '../models';
import { getBooleanValue } from '../utils';
import i18n from '../i18n';

import { commonParseMail } from '../common';
import {
    WEBHOOK_ATTACHMENT_TTL_SECONDS, SAFE_INLINE_IMAGE_TYPES,
    decodeBase32, getSigningKey, getSignaturePayload
} from '../utils/webhook';

export const getWebhookAttachment = async (
    c: Context<HonoCustomType>
): Promise<Response> => {
    if (!getBooleanValue(c.env.ENABLE_WEBHOOK)) {
        return c.text(i18n.getMessagesbyContext(c).WebhookNotEnabledMsg, 403);
    }
    const mailId = Number(c.req.param('mail_id'));
    const index = Number(c.req.param('index'));
    const expires = Number(c.req.param('expires'));
    const signatureValue = c.req.param('signature') || '';
    const now = Math.floor(Date.now() / 1000);
    if (
        !Number.isSafeInteger(mailId) || mailId <= 0
        || !Number.isSafeInteger(index) || index < 0
        || !Number.isSafeInteger(expires)
        || expires <= now || expires > now + WEBHOOK_ATTACHMENT_TTL_SECONDS
        || !/^[a-z2-7]{51}[aq]$/i.test(signatureValue)
    ) {
        return c.text('Not Found', 404);
    }

    const mail = await c.env.DB.prepare(
        `SELECT * FROM raw_mails WHERE id = ?`
    ).bind(mailId).first<RawMailRow>();
    if (!mail?.address || !mail.created_at) return c.text('Not Found', 404);

    const valid = await crypto.subtle.verify(
        'HMAC', await getSigningKey(c.env.JWT_SECRET), decodeBase32(signatureValue),
        getSignaturePayload(mailId, mail.address, mail.created_at, expires, index)
    );
    if (!valid) return c.text('Not Found', 404);

    const rawEmail = await resolveRawEmail(mail);
    const parsedEmail = await commonParseMail({ rawEmail });
    const attachment = parsedEmail?.attachments?.[index];
    if (!attachment) return c.text('Not Found', 404);

    const inline = SAFE_INLINE_IMAGE_TYPES.has(attachment.mimeType.toLowerCase());
    const filename = encodeURIComponent(attachment.filename).replace(/[!'()*]/g,
        character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
    return new Response(Uint8Array.from(attachment.content).buffer, {
        headers: {
            'Cache-Control': 'no-store',
            'Content-Disposition': inline ? 'inline' : `attachment; filename*=UTF-8''${filename}`,
            'Content-Type': inline ? attachment.mimeType : 'application/octet-stream',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
