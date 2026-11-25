import { AsyncLocalStorage } from 'node:async_hooks';
import { Telegram } from 'telegraf';

const telegramRecording = new AsyncLocalStorage<{ method: string; payload: unknown }[] | undefined>();
const callApi = Telegram.prototype.callApi;
// Keep the shared transport stable and record only the current request.
Telegram.prototype.callApi = function (this: Telegram, ...args: Parameters<typeof callApi>) {
    const calls = telegramRecording.getStore();
    if (!calls) return callApi.apply(this, args);
    calls.push({ method: args[0], payload: args[1] });
    return Promise.resolve({ message_id: calls.length });
} as typeof callApi;

// Direct DB insert — bypasses the email() handler.
const seedMail = async (request: Request, env: Bindings) => {
    const { address, source, raw, message_id, created_at, address_updated_at, address_created_at } = await request.json<{
        address: string; source?: string; raw: string; message_id?: string;
        created_at?: string; address_updated_at?: string; address_created_at?: string;
    }>();
    if (!address || !raw) {
        return new Response("address and raw are required", { status: 400 });
    }
    if (raw.length > 1_000_000) {
        return new Response("raw content too large", { status: 400 });
    }
    if (message_id && message_id.length > 255) {
        return new Response("message_id too long", { status: 400 });
    }
    if (address_updated_at !== undefined) {
        await env.DB.prepare(`UPDATE address SET updated_at = ? WHERE name = ?`)
            .bind(address_updated_at, address).run();
    }
    if (address_created_at !== undefined) {
        await env.DB.prepare(`UPDATE address SET created_at = ? WHERE name = ?`)
            .bind(address_created_at, address).run();
    }
    const msgId = message_id || `<e2e-${Date.now()}@test>`;
    const { success } = await env.DB.prepare(
        `INSERT INTO raw_mails (message_id, source, address, raw, created_at)`
        + ` VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')))`
    ).bind(msgId, source || address, address, raw, created_at ?? null).run();
    return Response.json({ success });
};

// Exercises the real email() handler with a mock ForwardableEmailMessage.
const receiveMail = async (request: Request, env: Bindings, ctx: ExecutionContext) => {
    const { from, to, raw, ai_extract_result, extract_mode, forward_address_list, subdomain_forward_address_list,
        record_telegram, record_another_worker } = await request.json<{
        from: string; to: string; raw: string; ai_extract_result?: unknown; extract_mode?: string;
        forward_address_list?: string[];
        subdomain_forward_address_list?: SubdomainForwardAddressList[];
        record_telegram?: boolean; record_another_worker?: boolean;
    }>();
    if (!from || !to || !raw) {
        return new Response("from, to and raw are required", { status: 400 });
    }

    // Parse MIME headers (unfold continuation lines, extract key:value pairs)
    const headerSection = raw.substring(0, Math.max(0, raw.indexOf('\r\n\r\n')));
    const headers = new Headers();
    for (const line of headerSection.replace(/\r\n(?=[ \t])/g, ' ').split('\r\n')) {
        const idx = line.indexOf(':');
        if (idx > 0) headers.append(line.substring(0, idx).trim(), line.substring(idx + 1).trim());
    }
    if (!headers.has('Message-ID') && !request.headers.has('x-test-no-message-id')) {
        headers.set('Message-ID', `<e2e-${Date.now()}@test>`);
    }

    const rawBytes = new TextEncoder().encode(raw);
    const forwardFailure = request.headers.get('x-test-forward-failure');
    const failedAddress = request.headers.get('x-test-forward-failure-address');
    const state = { rejected: undefined as string | undefined, replyCalled: false, replyCount: 0, forwardedTo: [] as string[] };
    const mockMessage: ForwardableEmailMessage = {
        from, to, headers,
        rawSize: rawBytes.byteLength,
        raw: new ReadableStream({ start(ctrl) { ctrl.enqueue(rawBytes); ctrl.close(); } }),
        setReject(reason: string) { state.rejected = reason; },
        forward: async (recipient: string) => {
            if (forwardFailure === 'external' && recipient === failedAddress) throw new Error('Injected external forward failure');
            state.forwardedTo.push(recipient);
            return { messageId: '' };
        },
        reply: async () => { state.replyCalled = true; state.replyCount++; return { messageId: '' }; },
    };
    const { email: emailHandler } = await import('../../worker/src/email');
    const aiExtractEnvOverrides: Partial<Bindings> = {
        ENABLE_AI_EMAIL_EXTRACT: true,
        AI_EXTRACT_MODE: extract_mode ?? 'ai',
        AI: {
            run: async () => ({ response: ai_extract_result })
        } as unknown as Ai,
    };
    const emailEnv = ai_extract_result || extract_mode !== undefined
        ? { ...env, ...aiExtractEnvOverrides }
        : env;
    const DB = forwardFailure && forwardFailure !== 'external' ? {
        prepare(sql: string) {
            const statement = env.DB.prepare(sql);
            const write = forwardFailure.startsWith('write-') && sql.startsWith('INSERT INTO raw_mails ');
            const reject = forwardFailure === 'reject' && sql === 'SELECT id FROM address where name = ? ';
            if (!write && !reject) return statement;
            return {
                bind(...values: unknown[]) {
                    const bound = statement.bind(...values);
                    if (values[write ? 1 : 0] !== failedAddress) return bound;
                    return {
                        first: async () => null,
                        run: async () => {
                            if (forwardFailure === 'write-false') return { success: false };
                            throw new Error('Injected forward write failure');
                        },
                    } as D1PreparedStatement;
                },
            } as D1PreparedStatement;
        },
    } as D1Database : env.DB;
    const telegramCalls: { method: string; payload: unknown }[] = [];
    const workerCalls: unknown[] = [];
    await telegramRecording.run(record_telegram ? telegramCalls : undefined,
        () => emailHandler(mockMessage, {
            ...emailEnv, DB,
            ...(record_telegram ? { TELEGRAM_BOT_TOKEN: 'e2e-record-only-token' } : {}),
            ...(record_another_worker ? {
                ENABLE_ANOTHER_WORKER: true,
                ANOTHER_WORKER_LIST: [{ binding: 'TEST_WORKER', method: 'rpcEmail', keywords: ['Original body'] }],
                TEST_WORKER: { rpcEmail: async (body: string) => { workerCalls.push(JSON.parse(body)); } },
            } : {}),
            ...(forward_address_list === undefined ? {} : { FORWARD_ADDRESS_LIST: forward_address_list }),
            ...(subdomain_forward_address_list === undefined ? {} : { SUBDOMAIN_FORWARD_ADDRESS_LIST: subdomain_forward_address_list }),
        }, ctx));

    return Response.json({
        success: !state.rejected,
        replyCalled: state.replyCalled,
        replyCount: state.replyCount,
        forwardedTo: state.forwardedTo,
        ...(record_telegram ? { telegramCalls } : {}),
        ...(record_another_worker ? { workerCalls } : {}),
        ...(state.rejected ? { rejected: state.rejected } : {})
    });
};

export default { seedMail, receiveMail };
