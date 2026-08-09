import { Context } from 'hono'
import { getBooleanValue } from '../utils'

// Direct DB insert — bypasses the email() handler.
const seedMail = async (c: Context<HonoCustomType>) => {
    if (!getBooleanValue(c.env.E2E_TEST_MODE)) {
        return c.text("Not available", 404);
    }
    const { address, source, raw, message_id, age_days = 0, count = 1 } = await c.req.json();
    if (!address || !raw) {
        return c.text("address and raw are required", 400);
    }
    if (raw.length > 1_000_000) {
        return c.text("raw content too large", 400);
    }
    if (message_id && message_id.length > 255) {
        return c.text("message_id too long", 400);
    }
    if (!Number.isInteger(age_days) || age_days < 0 || age_days > 1000) {
        return c.text("age_days must be an integer between 0 and 1000", 400);
    }
    if (!Number.isInteger(count) || count < 1 || count > 100) {
        return c.text("count must be an integer between 1 and 100", 400);
    }
    const msgId = message_id || `<e2e-${Date.now()}@test>`;
    const results = await c.env.DB.batch(Array.from({ length: count }, (_, index) =>
        c.env.DB.prepare(
            `INSERT INTO raw_mails (message_id, source, address, raw, created_at)`
            + ` VALUES (?, ?, ?, ?, datetime('now', ?))`
        ).bind(count === 1 ? msgId : `${msgId}-${index}`, source || address, address, raw, `-${age_days} day`)
    ));
    const success = results.every((result) => result.success);
    return c.json({ success });
};

const backdateAddress = async (c: Context<HonoCustomType>) => {
    if (!getBooleanValue(c.env.E2E_TEST_MODE)) {
        return c.text("Not available", 404);
    }
    const { id, age_days } = await c.req.json();
    if (!Number.isInteger(id) || !Number.isInteger(age_days) || age_days < 1 || age_days > 1000) {
        return c.text("id and age_days are required integers", 400);
    }
    const { success } = await c.env.DB.prepare(
        `UPDATE address SET created_at = datetime('now', ?), updated_at = datetime('now', ?) WHERE id = ?`
    ).bind(`-${age_days} day`, `-${age_days} day`, id).run();
    return c.json({ success });
};

// Exercises the real email() handler with a mock ForwardableEmailMessage.
const receiveMail = async (c: Context<HonoCustomType>) => {
    if (!getBooleanValue(c.env.E2E_TEST_MODE)) {
        return c.text("Not available", 404);
    }
    const { from, to, raw, ai_extract_result } = await c.req.json();
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

    const rawBytes = new TextEncoder().encode(raw);
    const state = { rejected: undefined as string | undefined, replyCalled: false, forwardedTo: [] as string[] };
    const mockMessage: ForwardableEmailMessage = {
        from, to, headers,
        rawSize: rawBytes.byteLength,
        raw: new ReadableStream({ start(ctrl) { ctrl.enqueue(rawBytes); ctrl.close(); } }),
        setReject(reason: string) { state.rejected = reason; },
        forward: async (recipient: string) => { state.forwardedTo.push(recipient); return { messageId: '' }; },
        reply: async () => { state.replyCalled = true; return { messageId: '' }; },
    };
    const { email: emailHandler } = await import('../email');
    const aiExtractEnvOverrides: Partial<Bindings> = {
        ENABLE_AI_EMAIL_EXTRACT: true,
        AI: {
            run: async () => ({ response: ai_extract_result })
        } as unknown as Ai,
    };
    const env = ai_extract_result
        ? { ...c.env, ...aiExtractEnvOverrides }
        : c.env;
    const executionContext: ExecutionContext = {
        waitUntil: () => {},
        passThroughOnException: () => {},
        props: {}
    };
    await emailHandler(mockMessage, env, executionContext);

    return c.json({
        success: !state.rejected,
        replyCalled: state.replyCalled,
        forwardedTo: state.forwardedTo,
        ...(state.rejected ? { rejected: state.rejected } : {})
    });
};

export default { seedMail, backdateAddress, receiveMail };
