import { test, expect } from '@playwright/test';
import { compileWebhookFilter, filterWebhooks } from '../../../worker/src/utils/webhook_filter';

test.describe('Webhook filter field mapping', () => {
  const mail = { sender: 'Blocked, Display <first@example.com>', subject: 'DOWN', text: '', html: '<p>HTML only</p>', headers: [
    { key: 'From', value: '"Blocked, Display" <first@example.com>, second@example.com' },
    { key: 'from', value: 'third@example.com' },
    { key: 'X-Tag', value: 'a' }, { key: 'x-tag', value: 'b' },
    { key: 'Reply-To', value: 'reply@example.com' },
  ] };
  const match = (field: string, value: string) => compileWebhookFilter({ field, operator: 'equals', value })(mail, 'real@example.org');
  test('filtering isolates invalid rules and preserves unfiltered webhooks on parse failure', () => {
    const legacy: any = { enabled: true };
    const matching: any = { filter: { field: 'subject', operator: 'equals', value: 'DOWN' } };
    const invalid: any = { filter: { field: 'unknown', operator: 'equals', value: 'DOWN' } };
    const unmatched: any = { filter: { field: 'subject', operator: 'equals', value: 'UP' } };
    const settings = [legacy, matching, invalid, unmatched];
    const log = console.error;
    const errors: unknown[][] = [];
    console.error = (...args) => { errors.push(args); };
    try {
      expect(filterWebhooks(settings, mail, 'real@example.org')).toEqual([legacy, matching]);
      expect(errors).toHaveLength(1);
      expect(filterWebhooks(settings, undefined, 'real@example.org')).toEqual([legacy]);
      expect(errors).toHaveLength(4);
      expect(settings).toEqual([legacy, matching, invalid, unmatched]);
    } finally {
      console.error = log;
    }
  });
  test('from uses only the parsed sender, including the display name', () => {
    expect(match('from', mail.sender)).toBe(true);
    for (const value of ['second@example.com', 'third@example.com', 'bounce@example.net']) expect(match('from', value)).toBe(false);
    for (const value of ['Blocked, Display', 'first@example.com']) {
      expect(compileWebhookFilter({ field: 'from', operator: 'contains', value })(mail, '')).toBe(true);
    }
    expect(match('from', 'reply@example.com')).toBe(false);
    for (const field of ['headerFrom', 'envelopeFrom']) {
      expect(() => compileWebhookFilter({ field, operator: 'equals', value: '' })).toThrow();
    }
    expect(compileWebhookFilter({ field: 'from', operator: 'equals', value: '' })({ ...mail, sender: '' }, '')).toBe(true);
    expect(match('to', 'real@example.org')).toBe(true);
  });
  test('repeated case-insensitive header names; missing and HTML-only text', () => {
    expect(match('header.X-TAG', 'b')).toBe(true);
    expect(match('header.missing', '')).toBe(false);
    expect(match('text', '')).toBe(true);
    expect(match('html', '<p>HTML only</p>')).toBe(true);
  });
  test('missing parsed data throws even under NOT, while legacy settings still pass', () => {
    expect(() => compileWebhookFilter({ operator: 'not', children: [{ field: 'subject', operator: 'equals', value: '' }] })(undefined, '')).toThrow();
    expect(compileWebhookFilter(undefined)(undefined, '')).toBe(true);
  });
  test('compiled matcher can be reused without leaking previous mail headers', () => {
    const match = compileWebhookFilter({ field: 'header.X-Tag', operator: 'equals', value: 'b' });
    expect(match(mail, '')).toBe(true);
    expect(match({ ...mail, headers: [] }, '')).toBe(false);
    expect(match(mail, '')).toBe(true);
  });
  test('many repeated headers retain all values without mutating parsed mail', () => {
    const headers = Array.from({ length: 20000 }, (_, index) => Object.freeze({ key: index % 2 ? 'X-Tag' : 'x-tag', value: String(index) }));
    const repeated = { ...mail, headers };
    for (const value of ['0', '10000', '19999']) {
      expect(compileWebhookFilter({ field: 'header.X-Tag', operator: 'equals', value })(repeated, '')).toBe(true);
    }
    expect(headers).toHaveLength(20000);
    expect(headers[0].value).toBe('0');
    expect(headers.at(-1)!.value).toBe('19999');
  });
  test('filters without header conditions do not read headers', () => {
    const noHeaders = { ...mail, get headers(): never { throw new Error('Headers should not be read'); } };
    expect(compileWebhookFilter({ field: 'subject', operator: 'equals', value: 'DOWN' })(noHeaders, '')).toBe(true);
  });
});
