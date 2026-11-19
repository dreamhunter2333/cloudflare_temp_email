const DEFAULT_WORKERS_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
const MAX_OUTPUT_TOKENS = 4096;

type Protocol = 'openai-chat' | 'openai-responses' | 'claude-messages';
type HttpProvider = { protocol: Protocol; model: string; url: URL; apiKey: string };
type Provider = { protocol: 'workers-ai'; model: string; ai: Ai } | HttpProvider;

const PATHS = {
    'openai-chat': '/chat/completions',
    'openai-responses': '/responses',
    'claude-messages': '/messages',
};

export function getMailProcessingProvider(env: Bindings): Provider | null {
    const protocol = env.MAIL_PROCESSING_PROVIDER;
    const model = typeof env.MAIL_PROCESSING_MODEL === 'string' ? env.MAIL_PROCESSING_MODEL.trim() : '';
    if (protocol === 'workers-ai' && env.AI) {
        return { protocol, model: model || DEFAULT_WORKERS_AI_MODEL, ai: env.AI };
    }
    if (protocol !== 'openai-chat' && protocol !== 'openai-responses' && protocol !== 'claude-messages') {
        return null;
    }
    const apiKey = typeof env.MAIL_PROCESSING_API_KEY === 'string' ? env.MAIL_PROCESSING_API_KEY.trim() : '';
    if (!model || !apiKey) return null;
    const defaultBase = protocol === 'claude-messages' ? 'https://api.anthropic.com/v1' : 'https://api.openai.com/v1';
    const base = typeof env.MAIL_PROCESSING_BASE_URL === 'string' ? env.MAIL_PROCESSING_BASE_URL.trim() : '';
    const url = URL.parse(base || defaultBase);
    if (!url || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    url.pathname = url.pathname.replace(/\/+$/, '') + PATHS[protocol];
    return { protocol, model, url, apiKey };
}

type TextBlock = { type: string; text?: string };
type ProviderResponse = {
    response?: string;
    usage?: { completion_tokens?: number };
    choices?: { finish_reason?: string; message?: { content?: string } }[];
    status?: string;
    output?: { type: string; content?: TextBlock[] }[];
    content?: TextBlock[];
    stop_reason?: string;
};

const textBlocks = (blocks: TextBlock[], type: string): string => blocks
    .filter(block => block.type === type && typeof block.text === 'string')
    .map(block => block.text)
    .join('\n');

async function requestProvider(provider: HttpProvider, body: object, authHeaders: Record<string, string>) {
    const response = await fetch(provider.url, {
        method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders }, body: JSON.stringify(body),
        redirect: 'manual', signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error('Mail processing provider request failed');
    return response.json<ProviderResponse>();
}

export async function generateMailText(provider: Provider, instruction: string, text: string): Promise<string> {
    const messages = [{ role: 'system' as const, content: instruction }, { role: 'user' as const, content: text }];
    if (provider.protocol === 'workers-ai') {
        const result = await provider.ai.run(provider.model as keyof AiModels, {
            messages, max_tokens: MAX_OUTPUT_TOKENS, stream: false,
        }) as ProviderResponse;
        const choice = result.choices?.[0];
        if (choice?.finish_reason) {
            if (choice.finish_reason !== 'stop') return '';
            return result.response || choice.message?.content || '';
        }
        if ((result.usage?.completion_tokens ?? 0) >= MAX_OUTPUT_TOKENS) return '';
        return result.response || '';
    }

    const { protocol, model, apiKey } = provider;
    if (protocol === 'claude-messages') {
        const result = await requestProvider(provider, {
            model, system: instruction, messages: [messages[1]], max_tokens: MAX_OUTPUT_TOKENS,
        }, { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' });
        return result.stop_reason === 'end_turn' ? textBlocks(result.content || [], 'text') : '';
    }

    const authorization = { authorization: `Bearer ${apiKey}` };
    if (protocol === 'openai-responses') {
        const result = await requestProvider(provider, {
            model, instructions: instruction, input: text, max_output_tokens: MAX_OUTPUT_TOKENS, store: false,
        }, authorization);
        if (result.status !== 'completed') return '';
        const blocks = (result.output || []).filter(item => item.type === 'message').flatMap(item => item.content || []);
        return textBlocks(blocks, 'output_text');
    }

    const result = await requestProvider(provider, {
        model, messages, max_completion_tokens: MAX_OUTPUT_TOKENS, store: false,
    }, authorization);
    const choice = result.choices?.[0];
    return choice?.finish_reason === 'stop' ? choice.message?.content || '' : '';
}
