import { compileFilter, type FilterValues } from './filter';

const fields = ['from', 'to', 'subject', 'text', 'html'];
const isFieldAllowed = (field: string) => fields.includes(field) || /^header\.[a-zA-Z0-9!#$%&'*+.^_`|~-]+$/.test(field);

export function compileWebhookFilter(filter: unknown): (
    parsedEmail: ParsedEmailContext['parsedEmail'],
    to: string,
) => boolean {
    const headerFields: string[] = [];
    const match = compileFilter(filter, field => {
        if (field.startsWith('header.')) headerFields.push(field);
        return isFieldAllowed(field);
    });
    return (parsedEmail, to) => {
        if (filter === undefined || filter === null) return true;
        if (!parsedEmail) throw new Error('Email parsing unavailable for filter');
        const headers = new Map<string, string[]>();
        for (const header of parsedEmail.headers || []) {
            const key = header.key.toLowerCase();
            headers.set(key, [...(headers.get(key) || []), header.value]);
        }
        const values: FilterValues = {
            from: parsedEmail.sender,
            to,
            subject: parsedEmail.subject,
            text: parsedEmail.text,
            html: parsedEmail.html,
        };
        for (const field of headerFields) {
            values[field] = headers.get(field.slice(7).toLowerCase()) || [];
        }
        return match(values);
    };
}
