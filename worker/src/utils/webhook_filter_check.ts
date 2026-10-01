import { Context } from 'hono';
import { commonParseMail } from '../common';
import { resolveRawEmail } from '../gzip';
import i18n from '../i18n';
import { RawMailRow, WebhookSettings } from '../models';
import { compileWebhookFilter } from './webhook_filter';

export async function checkWebhookFilter(c: Context<HonoCustomType>, address?: string): Promise<Response> {
    const msgs = i18n.getMessagesbyContext(c);
    const settings = await c.req.json<Pick<WebhookSettings, 'filter'> & { mail_id?: number }>().catch(() => null);
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        return c.text(msgs.InvalidRequestBodyMsg, 400);
    }
    let match: ReturnType<typeof compileWebhookFilter>;
    try {
        match = compileWebhookFilter(settings.filter);
    } catch (error) {
        return c.text(`${msgs.InvalidWebhookFilterMsg}: ${(error as Error).message}`, 400);
    }
    const requestedMailId = settings.mail_id;
    if (requestedMailId !== undefined && (!Number.isSafeInteger(requestedMailId) || requestedMailId <= 0)) {
        return c.text(msgs.InvalidMailIdMsg, 400);
    }
    const conditions = [];
    const bindings = [];
    if (requestedMailId !== undefined) {
        conditions.push('id = ?');
        bindings.push(requestedMailId);
    }
    if (address !== undefined) {
        conditions.push('address = ?');
        bindings.push(address);
    }
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const order = requestedMailId === undefined ? ' ORDER BY RANDOM() LIMIT 1' : '';
    const mailRow = await c.env.DB.prepare(
        `SELECT * FROM raw_mails${where}${order}`
    ).bind(...bindings).first<RawMailRow>();
    if (!mailRow) {
        return c.text(msgs.MailNotFoundMsg, 404);
    }
    const raw = await resolveRawEmail(mailRow);
    const parsedEmail = await commonParseMail({ rawEmail: raw });
    try {
        return c.json({ success: true, matched: match(parsedEmail, address ?? mailRow.address ?? '') });
    } catch {
        return c.text(msgs.WebhookFilterEvaluationFailedMsg, 400);
    }
}
