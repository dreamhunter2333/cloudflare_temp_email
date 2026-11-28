import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { routePath } from 'hono/route';
import i18n from '../i18n';
import { getMailProcessingProviderForAddress, isMailProcessingLanguage, MAX_MAIL_PROCESSING_INPUT_LENGTH, summarizeMail, translateMail, type MailProcessingProvider } from '../mail_ai_processing';

type MailProcessingRequest = { subject?: unknown; text?: unknown; html?: unknown; targetLanguage?: unknown };
type MailProcessingContext = {
    address: string;
    mailId: number;
    provider: MailProcessingProvider;
    msgs: ReturnType<typeof i18n.getMessagesbyContext>;
};
type MailProcessingIntent =
    | { action: 'summarize'; input: string }
    | { action: 'translate'; input: string; mail: { subject: string; text?: string; html?: string }; targetLanguage?: string };

const limitBody = bodyLimit({
    maxSize: 96 * 1024,
    onError: c => c.text(i18n.getMessagesbyContext(c).MailProcessingTooLongMsg, 413),
});

async function readMailProcessingRequest(c: Context<HonoCustomType>) {
    const msgs = i18n.getMessagesbyContext(c);
    const { address } = c.get('jwtPayload');
    const provider = await getMailProcessingProviderForAddress(c, address);
    if (!provider) return c.text(msgs.MailProcessingDisabledMsg, 403);

    const mailId = Number(c.req.param('mail_id'));
    if (!Number.isSafeInteger(mailId) || mailId < 1) return c.text(msgs.InvalidMailIdMsg, 400);
    const body = await c.req.json<MailProcessingRequest | null>();
    if (typeof body?.subject !== 'string') return c.text(msgs.InvalidRequestBodyMsg, 400);
    return { address, mailId, provider, msgs, body, subject: body.subject.trim() };
}

async function processMail(c: Context<HonoCustomType>, request: MailProcessingContext, intent: MailProcessingIntent): Promise<Response> {
    const { address, mailId, provider, msgs } = request;
    const exists = await c.env.DB.prepare('SELECT 1 FROM raw_mails WHERE id = ? AND address = ?')
        .bind(mailId, address).first();
    if (!exists) return c.text(msgs.MailProcessingNotFoundMsg, 404);

    if (!intent.input) return c.text(msgs.MailProcessingEmptyMsg, 422);
    if (intent.input.length > MAX_MAIL_PROCESSING_INPUT_LENGTH) return c.text(msgs.MailProcessingTooLongMsg, 413);

    const reqIp = c.req.header('cf-connecting-ip');
    if (reqIp && c.env.RATE_LIMITER) {
        const { success } = await c.env.RATE_LIMITER.limit({ key: `${routePath(c)}|${reqIp}` });
        if (!success) return c.text(`IP=${reqIp} Rate limit exceeded for ${c.req.path}`, 429);
    }

    try {
        const locale = c.get('lang') || c.env.DEFAULT_LANG || 'en';
        const result = intent.action === 'summarize'
            ? await summarizeMail(provider, intent.input, locale, c.env.MAIL_PROCESSING_SUMMARY_PROMPT)
            : await translateMail(provider, intent.input, intent.mail, intent.targetLanguage || locale, c.env.MAIL_PROCESSING_TRANSLATION_PROMPT);
        return c.json(result, 200, { 'Cache-Control': 'no-store' });
    } catch {
        return c.text(msgs.MailProcessingFailedMsg, 502);
    }
}

async function summarize(c: Context<HonoCustomType>): Promise<Response> {
    const request = await readMailProcessingRequest(c);
    if (request instanceof Response) return request;
    const { subject, body: { text, html }, msgs } = request;
    if (html !== undefined || typeof text !== 'string') return c.text(msgs.InvalidRequestBodyMsg, 400);
    const body = text.trim();
    const input = subject && body ? `Subject: ${subject}\n\n${body}` : body;
    return processMail(c, request, { action: 'summarize', input });
}

async function translate(c: Context<HonoCustomType>): Promise<Response> {
    const request = await readMailProcessingRequest(c);
    if (request instanceof Response) return request;
    const { subject, body: { text, html, targetLanguage }, msgs } = request;
    if (targetLanguage !== undefined && !isMailProcessingLanguage(targetLanguage)) return c.text(msgs.InvalidRequestBodyMsg, 400);
    if (html !== undefined && (typeof html !== 'string' || text !== undefined)) return c.text(msgs.InvalidRequestBodyMsg, 400);
    if (html === undefined && typeof text !== 'string') return c.text(msgs.InvalidRequestBodyMsg, 400);
    const plainText = typeof text === 'string' ? text.trim() : '';
    const mail = typeof html === 'string' ? { subject, html: html.trim() } : { subject, text: plainText };
    const input = (mail.html ?? (mail.text || subject)) ? JSON.stringify(mail) : '';
    return processMail(c, request, { action: 'translate', input, mail, targetLanguage });
}

export default { limitBody, summarize, translate };
