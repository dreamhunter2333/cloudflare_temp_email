import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { validator } from 'hono/validator';
import i18n from '../i18n';
import { getMailProcessingAccess, isMailProcessingLanguage, prepareMailForProcessing, processMailText, type MailProcessingAction } from '../mail_ai_processing';

type MailProcessingRequest = { subject?: string; text?: string; html?: string; targetLanguage?: string };

const limitBody = bodyLimit({
    maxSize: 96 * 1024,
    onError: c => c.text(i18n.getMessagesbyContext(c).MailProcessingTooLongMsg, 413),
});

const processMail = (action: MailProcessingAction) => validator('json', async (body: MailProcessingRequest | null, c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c);
    const { address } = c.get('jwtPayload');
    const provider = await getMailProcessingAccess(c, address);
    if (!provider) return c.text(msgs.MailProcessingDisabledMsg, 403);

    const mailId = Number(c.req.param('mail_id'));
    const { subject, text, html, targetLanguage } = body ?? {};
    if (!Number.isSafeInteger(mailId) || mailId < 1 || typeof subject !== 'string') {
        return c.text(msgs.InvalidRequestBodyMsg, 400);
    }
    if (html !== undefined && (action !== 'translate' || text !== undefined || typeof html !== 'string')) {
        return c.text(msgs.InvalidRequestBodyMsg, 400);
    }
    if (html === undefined && typeof text !== 'string') return c.text(msgs.InvalidRequestBodyMsg, 400);
    if (action === 'translate' && targetLanguage !== undefined && !isMailProcessingLanguage(targetLanguage)) {
        return c.text(msgs.InvalidRequestBodyMsg, 400);
    }

    const exists = await c.env.DB.prepare('SELECT 1 FROM raw_mails WHERE id = ? AND address = ?')
        .bind(mailId, address).first();
    if (!exists) return c.text(msgs.MailProcessingNotFoundMsg, 404);

    const mail = prepareMailForProcessing(subject.trim(), text?.trim() || '', action, html?.trim());
    if (mail.html === '' || (!mail.html && !mail.text && (action === 'summarize' || !mail.subject))) {
        return c.text(msgs.MailProcessingEmptyMsg, 422);
    }
    if (mail.tooLong) return c.text(msgs.MailProcessingTooLongMsg, 413);

    try {
        const interfaceLanguage = c.get('lang') || c.env.DEFAULT_LANG || 'en';
        const locale = action === 'translate' && targetLanguage ? targetLanguage : interfaceLanguage;
        const result = await processMailText(provider, action, mail, locale, c.env);
        return c.json(result, 200, { 'Cache-Control': 'no-store' });
    } catch {
        return c.text(msgs.MailProcessingFailedMsg, 502);
    }
});

export default {
    limitBody,
    summarize: processMail('summarize'),
    translate: processMail('translate'),
};
