import type { RawMailRow, WebhookMail } from '../models';

export const WEBHOOK_ATTACHMENT_TTL_SECONDS = 24 * 60 * 60;
export const SAFE_INLINE_IMAGE_TYPES = new Set([
    'image/png', 'image/jpeg', 'image/gif', 'image/webp'
]);
const textEncoder = new TextEncoder();
let signingKey: { secret: string, key: Promise<CryptoKey> } | undefined;

const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

const encodeBase32 = (value: Uint8Array): string => {
    const bits = Array.from(value, byte => byte.toString(2).padStart(8, '0')).join('');
    return (bits.match(/.{1,5}/g) || []).map(group =>
        BASE32_ALPHABET[parseInt(group.padEnd(5, '0'), 2)]
    ).join('');
}

export const decodeBase32 = (value: string): Uint8Array => {
    const bits = Array.from(value.toLowerCase(), character =>
        BASE32_ALPHABET.indexOf(character).toString(2).padStart(5, '0')
    ).join('');
    return Uint8Array.from(bits.match(/.{8}/g) || [], byte => parseInt(byte, 2));
}

export const getSigningKey = (secret: string): Promise<CryptoKey> => {
    if (signingKey?.secret === secret) return signingKey.key;
    const key = crypto.subtle.importKey(
        'raw', textEncoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
    );
    signingKey = { secret, key };
    return key;
}

export const getSignaturePayload = (
    mailId: number, address: string, createdAt: string, expires: number, index: number
): Uint8Array => textEncoder.encode(JSON.stringify([
    'webhook-attachment-v1', mailId, address, createdAt, expires, index
]));

export const createWebhookAttachmentPath = async (
    secret: string, mailId: number, address: string, createdAt: string, index: number
): Promise<string> => {
    const expires = Math.floor(Date.now() / 1000) + WEBHOOK_ATTACHMENT_TTL_SECONDS;
    const signature = await crypto.subtle.sign(
        'HMAC', await getSigningKey(secret),
        getSignaturePayload(mailId, address, createdAt, expires, index)
    );
    return `/open_api/a/${mailId}/${index}/${expires}/${encodeBase32(new Uint8Array(signature))}`;
}

export const getWebhookAttachments = async (
    env: Bindings, mail: RawMailRow | null, attachments: ParsedEmailAttachment[] = []
): Promise<NonNullable<WebhookMail['attachments']>> => {
    if (!mail?.address || !mail.created_at) return [];
    const { id, address, created_at } = mail;
    const backendUrl = env.BACKEND_URL?.replace(/\/$/, '');
    return Promise.all(attachments.map(async (attachment, index) => ({
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        url: backendUrl
            ? `${backendUrl}${await createWebhookAttachmentPath(env.JWT_SECRET, id, address, created_at, index)}`
            : '',
    })));
}

export const formatWebhookBody = (body: string, mail: WebhookMail): string => {
    const attachments = mail.attachments || [];
    const linkedAttachments = attachments.filter(attachment => attachment.url);
    const formatMap = {
        ...mail,
        attachments,
        attachmentLinks: linkedAttachments.map(attachment => attachment.url).join('\n'),
        attachmentMarkdownLinks: linkedAttachments.map(attachment => {
            const filename = attachment.filename.replace(/[\r\n]/g, ' ').replace(/[\\[\]()`*_!<>]/g, '\\$&');
            return `[${filename}](${attachment.url})`;
        }).join('\n'),
    };
    return body.replace(/\$\{(\w+)\}/g, (placeholder, key: string) => {
        if (!Object.hasOwn(formatMap, key)) return placeholder;
        return JSON.stringify(formatMap[key as keyof typeof formatMap]).replace(/^"(.*)"$/, '$1');
    });
}
