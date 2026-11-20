import type { Context } from 'hono';
import { validator } from 'hono/validator';
import { resolveRawEmail } from '../gzip';
import i18n from '../i18n';
import { getMailProcessingAccess, isMailProcessingLanguage, prepareMailForProcessing, processMailText } from '../mail_ai_processing';
import type { RawMailRow } from '../models';

type MailProcessingRequest = { mailId?: number; action?: string; targetLanguage?: string };

export const processMail = validator('json', async (body: MailProcessingRequest | null, c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c);
    const { address } = c.get('jwtPayload');
    const access = await getMailProcessingAccess(c, address);
    if (access?.mode !== 'site') return c.text(msgs.MailProcessingDisabledMsg, 403);

    const { mailId, action, targetLanguage } = body ?? {};
    if (!mailId || !Number.isSafeInteger(mailId) || mailId < 1 || (action !== 'summarize' && action !== 'translate')) {
        return c.text(msgs.InvalidRequestBodyMsg, 400);
    }
    if (action === 'translate' && targetLanguage !== undefined && !isMailProcessingLanguage(targetLanguage)) {
        return c.text(msgs.InvalidRequestBodyMsg, 400);
    }

    const row = await c.env.DB.prepare('SELECT raw, raw_blob FROM raw_mails WHERE id = ? AND address = ?')
        .bind(mailId, address).first<RawMailRow>();
    if (!row) return c.text(msgs.MailProcessingNotFoundMsg, 404);

    const mail = await prepareMailForProcessing(await resolveRawEmail(row), action);
    if (!mail.text && (action === 'summarize' || !mail.subject)) return c.text(msgs.MailProcessingEmptyMsg, 422);
    if (mail.tooLong) return c.text(msgs.MailProcessingTooLongMsg, 413);

    try {
        const interfaceLanguage = c.get('lang') || c.env.DEFAULT_LANG || 'en';
        const locale = action === 'translate' && targetLanguage ? targetLanguage : interfaceLanguage;
        const prompt = action === 'summarize' ? c.env.MAIL_PROCESSING_SUMMARY_PROMPT : c.env.MAIL_PROCESSING_TRANSLATION_PROMPT;
        const result = await processMailText(access.provider, action, mail, locale, prompt);
        return c.json(result, 200, { 'Cache-Control': 'no-store' });
    } catch {
        return c.text(msgs.MailProcessingFailedMsg, 502);
    }
});
