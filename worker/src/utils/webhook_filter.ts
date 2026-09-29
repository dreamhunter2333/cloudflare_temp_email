import { addressParser } from 'postal-mime';
import { compileFilter, type FilterValues } from './filter';

const fields = ['from', 'envelopeFrom', 'headerFrom', 'to', 'subject', 'text', 'html'];
const isFieldAllowed = (field: string) => fields.includes(field) || /^header\.[a-zA-Z0-9!#$%&'*+.^_`|~-]+$/.test(field);

export const compileWebhookFilter = (filter: unknown) => compileFilter(filter, isFieldAllowed);

export function matchWebhookFilter(
    filter: unknown,
    parsedEmail: ParsedEmailContext['parsedEmail'],
    envelopeFrom: string,
    to: string,
): boolean {
    const match = compileWebhookFilter(filter);
    if (filter === undefined || filter === null) return true;
    if (!parsedEmail) throw new Error('Email parsing unavailable for filter');
    const headers = new Map<string, string[]>();
    for (const header of parsedEmail.headers || []) {
        const key = header.key.toLowerCase();
        headers.set(key, [...(headers.get(key) || []), header.value]);
    }
    const headerFrom = (headers.get('from') || []).flatMap(value =>
        addressParser(value, { flatten: true }).map(sender => sender.address || '').filter(Boolean));
    const values: FilterValues = {
        from: [envelopeFrom, ...headerFrom].filter(Boolean),
        envelopeFrom,
        headerFrom,
        to,
        subject: parsedEmail.subject,
        text: parsedEmail.text,
        html: parsedEmail.html,
    };
    const addHeaders = (node: unknown) => {
        const condition = node as { field?: string; children?: unknown[] };
        if (condition.field?.startsWith('header.')) {
            values[condition.field] = headers.get(condition.field.slice(7).toLowerCase()) || [];
        }
        condition.children?.forEach(addHeaders);
    };
    addHeaders(filter);
    return match(values);
}
