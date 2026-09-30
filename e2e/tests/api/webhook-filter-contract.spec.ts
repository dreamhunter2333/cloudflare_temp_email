import { expect, test } from '@playwright/test';
import { isValidFilterExpression, validateRegex } from '../../../frontend/src/components/filter';
import { compileWebhookFilter } from '../../../worker/src/utils/webhook_filter';

const operators = [
  ...['equals', 'contains', 'startsWith', 'endsWith'].flatMap(value => [
    { value, label: value }, { value: `${value}CaseSensitive`, label: value },
  ]),
  { value: 'regex', label: 'regex', options: [{ key: 'flags', label: 'flags' }], validate: validateRegex },
];
const allowed = (field: string) => ['from', 'to', 'subject', 'text', 'html'].includes(field)
  || /^header\.[a-zA-Z0-9!#$%&'*+.^_`|~-]+$/.test(field);
const leaf = { field: 'subject', operator: 'contains', value: 'DOWN' };

test('frontend and backend accept the same filter contract', () => {
  let deep: any = leaf;
  for (let i = 0; i < 8; i++) deep = { operator: 'not', children: [deep] };
  const cases = [null, undefined, false, {}, [], leaf, deep,
    { operator: 'and', children: [] }, { operator: 'not', children: [leaf, leaf] },
    { operator: 'or', children: Array(99).fill(leaf) }, { operator: 'or', children: Array(100).fill(leaf) },
    { ...leaf, value: 'x'.repeat(501) }, { ...leaf, options: [] },
    ...['from', 'text', 'html', 'header.List-ID', 'header.X-Tag', 'headerFrom', 'envelopeFrom', '', 'header.', 'header.Bad Header']
      .map(field => ({ ...leaf, field })),
    ...operators.map(operator => ({ ...leaf, operator: operator.value })),
    ...['unknown', 'constructor', 'toString'].map(operator => ({ ...leaf, operator })),
    ...['^DOWN', '[', '(?=a)', '(a)\\1'].flatMap(value => ['', 'ims', 'g', 'ii', false].map(flags => (
      { field: 'subject', operator: 'regex', value, options: { flags } }
    ))),
    { ...leaf, options: { flags: 'i' } }, { ...leaf, options: { caseSensitive: true } },
    { ...leaf, operator: 'regex', options: { unknown: true } },
  ];
  for (const rule of cases) {
    let backendValid = true;
    try { compileWebhookFilter(rule); } catch { backendValid = false; }
    expect(isValidFilterExpression(rule, operators, allowed), JSON.stringify(rule)).toBe(backendValid);
  }
});
