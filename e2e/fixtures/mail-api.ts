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
    const { from, to, raw, ai_extract_result } = await request.json<{
        from: string; to: string; raw: string; ai_extract_result?: unknown;
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
    const { email: emailHandler } = await import('../../worker/src/email');
    const aiExtractEnvOverrides: Partial<Bindings> = {
        ENABLE_AI_EMAIL_EXTRACT: true,
        AI: {
            run: async () => ({ response: ai_extract_result })
        } as unknown as Ai,
    };
    const emailEnv = ai_extract_result
        ? { ...env, ...aiExtractEnvOverrides }
        : env;
    await emailHandler(mockMessage, emailEnv, ctx);

    return Response.json({
        success: !state.rejected,
        replyCalled: state.replyCalled,
        forwardedTo: state.forwardedTo,
        ...(state.rejected ? { rejected: state.rejected } : {})
    });
};

export default { seedMail, receiveMail };
