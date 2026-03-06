import { Context } from 'hono'
import { WorkerMailer, WorkerMailerOptions } from 'worker-mailer'
import { getBooleanValue, getJsonObjectValue } from '../utils'

// Direct DB insert — bypasses the email() handler.
const seedMail = async (c: Context<HonoCustomType>) => {
    if (!getBooleanValue(c.env.E2E_TEST_MODE)) {
        return c.text("Not available", 404);
    }
    const { address, source, raw, message_id } = await c.req.json();
    if (!address || !raw) {
        return c.text("address and raw are required", 400);
    }
    if (raw.length > 1_000_000) {
        return c.text("raw content too large", 400);
    }
    if (message_id && message_id.length > 255) {
        return c.text("message_id too long", 400);
    }
    const msgId = message_id || `<e2e-${Date.now()}@test>`;
    const { success } = await c.env.DB.prepare(
        `INSERT INTO raw_mails (message_id, source, address, raw, created_at)`
        + ` VALUES (?, ?, ?, ?, datetime('now'))`
    ).bind(msgId, source || address, address, raw).run();
    return c.json({ success });
};

/**
 * Parse raw MIME to extract From, To, Subject and body for WorkerMailer.
 */
function parseMimeForReply(rawMime: string) {
    // Support both \r\n and \n line endings (mimetext uses os.EOL which is \n on Linux)
    const crlfEnd = rawMime.indexOf('\r\n\r\n');
    const lfEnd = rawMime.indexOf('\n\n');
    const headerEnd = crlfEnd > 0 ? crlfEnd : lfEnd;
    const sepLen = crlfEnd > 0 ? 4 : 2;
    const headerSection = headerEnd > 0 ? rawMime.substring(0, headerEnd) : rawMime;
    const body = headerEnd > 0 ? rawMime.substring(headerEnd + sepLen) : '';

    const headers: Record<string, string> = {};
    // Normalize line endings then unfold continuation lines
    const normalized = headerSection.replace(/\r\n/g, '\n');
    for (const line of normalized.replace(/\n(?=[ \t])/g, ' ').split('\n')) {
        const idx = line.indexOf(':');
        if (idx > 0) {
            const key = line.substring(0, idx).trim().toLowerCase();
            headers[key] = line.substring(idx + 1).trim();
        }
    }

    const parseAddr = (s: string) => {
        const match = s.match(/<([^>]+)>/);
        return match ? match[1] : s.trim();
    };

    return {
        from: parseAddr(headers['from'] || ''),
        to: parseAddr(headers['to'] || ''),
        subject: headers['subject'] || '',
        body: body.trim(),
    };
}

// Exercises the real email() handler with a mock ForwardableEmailMessage.
// The mock reply() sends via SMTP (WorkerMailer) so auto-replies reach Mailpit.
const receiveMail = async (c: Context<HonoCustomType>) => {
    if (!getBooleanValue(c.env.E2E_TEST_MODE)) {
        return c.text("Not available", 404);
    }
    const { from, to, raw } = await c.req.json();
    if (!from || !to || !raw) {
        return c.text("from, to and raw are required", 400);
    }

    // Parse MIME headers (unfold continuation lines, extract key:value pairs)
    const headerSection = raw.substring(0, Math.max(0, raw.indexOf('\r\n\r\n')));
    const headers = new Headers();
    for (const line of headerSection.replace(/\r\n(?=[ \t])/g, ' ').split('\r\n')) {
        const idx = line.indexOf(':');
        if (idx > 0) headers.append(line.substring(0, idx).trim(), line.substring(idx + 1).trim());
    }
    if (!headers.has('Message-ID')) headers.set('Message-ID', `<e2e-${Date.now()}@test>`);

    // Resolve SMTP config for the sender domain (reply goes back to sender)
    const senderDomain = from.split('@')[1];
    const smtpConfigMap = getJsonObjectValue<Record<string, WorkerMailerOptions>>(c.env.SMTP_CONFIG);
    const smtpConfig = smtpConfigMap ? smtpConfigMap[senderDomain] : null;

    const rawBytes = new TextEncoder().encode(raw);
    let rejected: string | undefined;
    const mockMessage: ForwardableEmailMessage = {
        from, to, headers,
        rawSize: rawBytes.byteLength,
        raw: new ReadableStream({ start(ctrl) { ctrl.enqueue(rawBytes); ctrl.close(); } }),
        setReject(reason: string) { rejected = reason; },
        forward: async () => ({ messageId: '' }),
        reply: async (replyMessage) => {
            // Send the reply via SMTP so it reaches Mailpit in E2E tests.
            // Try reading raw MIME from: (1) .rawMime string, (2) .raw ReadableStream
            let rawMimeStr: string | undefined;
            if (typeof (replyMessage as any)?.rawMime === 'string') {
                rawMimeStr = (replyMessage as any).rawMime;
            } else if ((replyMessage as any)?.raw) {
                rawMimeStr = await new Response((replyMessage as any).raw).text();
            }
            console.log('[E2E] mock reply() called, hasRaw:', !!rawMimeStr, 'hasSmtp:', !!smtpConfig);
            if (smtpConfig && rawMimeStr) {
                const parsed = parseMimeForReply(rawMimeStr);
                console.log('[E2E] sending auto-reply via SMTP:', parsed.from, '->', parsed.to, 'subj:', parsed.subject);
                await WorkerMailer.send(smtpConfig, {
                    from: { email: parsed.from },
                    to: { email: parsed.to },
                    subject: parsed.subject,
                    text: parsed.body,
                });
            }
            return { messageId: '' };
        },
    };

    const { email: emailHandler } = await import('../email');
    await emailHandler(mockMessage, c.env, { waitUntil: () => {}, passThroughOnException: () => {} });

    return c.json({ success: !rejected, ...(rejected ? { rejected } : {}) });
};

export default { seedMail, receiveMail };
