const PROVIDER_ORIGIN = 'https://mail-processing.e2e.invalid';
const API_KEY = 'e2e-mail-processing-key';
const MODEL = 'e2e-mail-model';

type Message = { role: string; content: string };

function mockText(instruction: string, text: string): string {
    if (text.includes('fixture-provider-failure')) throw new Error('Fixture provider failed');
    const language = instruction.includes('Simplified Chinese') ? 'zh' : instruction.includes('Japanese') ? 'ja' : 'en';
    if (instruction.startsWith('Summarize')) return `Summary (${language}): ${text}`;
    if (text.includes('fixture-invalid-translation')) return 'Not a JSON translation';
    const mail = JSON.parse(text) as { subject: string; text: string };
    return JSON.stringify({
        subject: mail.subject && `Translation (${language}): ${mail.subject}`,
        text: mail.text && `Translation (${language}): ${mail.text}`,
    });
}

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.origin !== PROVIDER_ORIGIN) return originalFetch(input, init);

    const request = new Request(input, init);
    const body = await request.json<{
        model: string; messages?: Message[]; system?: string; instructions?: string; input?: string;
        store?: boolean; max_tokens?: number; max_completion_tokens?: number; max_output_tokens?: number;
    }>();
    if (request.method !== 'POST' || body.model !== MODEL) return new Response(null, { status: 400 });
    if (url.pathname === '/v1/messages') {
        if (request.headers.get('x-api-key') !== API_KEY || !request.headers.has('anthropic-version')
            || !body.system || body.messages?.length !== 1 || body.messages[0].role !== 'user' || !body.max_tokens) {
            return new Response(null, { status: 400 });
        }
        return Response.json({ stop_reason: 'end_turn', content: [{ type: 'text', text: mockText(body.system, body.messages[0].content) }] });
    }
    if (request.headers.get('authorization') !== `Bearer ${API_KEY}` || body.store !== false) {
        return new Response(null, { status: 400 });
    }
    if (url.pathname === '/v1/responses' && body.instructions && body.input && body.max_output_tokens) {
        return Response.json({ status: 'completed', output: [
            { type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: mockText(body.instructions, body.input) }] },
        ] });
    }
    if (url.pathname === '/v1/chat/completions' && body.messages?.[0]?.role === 'system'
        && body.messages[1]?.role === 'user' && body.max_completion_tokens) {
        return Response.json({ choices: [{ finish_reason: 'stop', message: {
            content: mockText(body.messages[0].content, body.messages[1].content),
        } }] });
    }
    return new Response(null, { status: 400 });
};

export function mailProcessingTestEnv(request: Request, env: Bindings): Partial<Bindings> {
    const testProtocol = request.headers.get('x-test-mail-processing-provider');
    const protocol = testProtocol || env.MAIL_PROCESSING_PROVIDER;
    const enabled = request.headers.get('x-test-mail-processing-enabled') ?? (testProtocol ? true : env.ENABLE_MAIL_PROCESSING);
    if (protocol === 'workers-ai') {
        const summaryPrompt = request.headers.get('x-test-summary-prompt');
        const translationPrompt = request.headers.get('x-test-translation-prompt');
        return {
            ENABLE_MAIL_PROCESSING: enabled,
            MAIL_PROCESSING_PROVIDER: protocol,
            MAIL_PROCESSING_SUMMARY_PROMPT: summaryPrompt || undefined,
            MAIL_PROCESSING_TRANSLATION_PROMPT: translationPrompt || undefined,
            AI: { run: async (_: string, input: { messages: Message[]; max_tokens: number }) => {
                const instruction = input.messages[0].content;
                const expected = instruction.startsWith('Summarize') ? summaryPrompt : translationPrompt;
                if (expected && !instruction.includes(expected)) throw new Error('Configured prompt is missing');
                const text = input.messages[1].content;
                if (text.includes('fixture-token-limit')) {
                    return { response: 'Truncated result', usage: { completion_tokens: input.max_tokens } };
                }
                if (text.includes('fixture-finish-length')) {
                    return { choices: [{ finish_reason: 'length', message: { content: 'Truncated result' } }] };
                }
                if (text.includes('fixture-finish-stop')) {
                    return { choices: [{ finish_reason: 'stop', message: { content: 'Complete summary' } }] };
                }
                return { response: mockText(instruction, text) };
            } } as unknown as Ai,
        };
    }
    if (protocol === 'openai-chat' || protocol === 'openai-responses' || protocol === 'claude-messages') {
        return {
            ENABLE_MAIL_PROCESSING: enabled,
            MAIL_PROCESSING_PROVIDER: protocol,
            MAIL_PROCESSING_BASE_URL: `${PROVIDER_ORIGIN}/v1`,
            MAIL_PROCESSING_MODEL: MODEL,
            MAIL_PROCESSING_API_KEY: API_KEY,
        };
    }
    return {};
}
