import { validateRegex, type FilterOperator } from './filter'

export const webhookFilterFields = ['from', 'to', 'subject', 'text', 'html']

export const isWebhookFilterFieldAllowed = (field: string) => webhookFilterFields.includes(field)
    || /^header\.[a-zA-Z0-9!#$%&'*+.^_`|~-]+$/.test(field)

export function getWebhookFilterOperators(t: (key: string) => string): FilterOperator[] {
    return [
        ...['equals', 'contains', 'startsWith', 'endsWith'].flatMap(value => [
            { value, label: t(`filter_${value}`) },
            { value: `${value}CaseSensitive`, label: `${t(`filter_${value}`)} (${t('filter_caseSensitive')})` },
        ]),
        { value: 'regex', label: t('filter_regex'), validate: validateRegex,
            options: [{ key: 'flags', label: t('filter_flags'), placeholder: 'i / m / s' }] },
    ]
}
