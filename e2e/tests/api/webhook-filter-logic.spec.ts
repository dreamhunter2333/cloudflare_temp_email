import { test, expect } from '@playwright/test';
import { matchWebhookFilter } from '../../../worker/src/utils/webhook_filter';

test.describe('Webhook filter field mapping', () => {
  const mail = { sender: 'ignored display name', subject: 'DOWN', text: '', html: '<p>HTML only</p>', headers: [
    { key: 'From', value: '"Blocked, Display" <first@example.com>, second@example.com' },
    { key: 'from', value: 'third@example.com' },
    { key: 'X-Tag', value: 'a' }, { key: 'x-tag', value: 'b' },
    { key: 'Reply-To', value: 'reply@example.com' },
  ] };
  const match = (field: string, value: string) => matchWebhookFilter({ field, operator: 'equals', value }, mail, 'bounce@example.net', 'real@example.org');
  test('all From mailboxes and envelope, not display names or Reply-To', () => {
    for (const value of ['first@example.com', 'second@example.com', 'third@example.com', 'bounce@example.net']) expect(match('from', value)).toBe(true);
    expect(match('from', 'Blocked, Display')).toBe(false);
    expect(match('from', 'reply@example.com')).toBe(false);
    expect(match('headerFrom', 'bounce@example.net')).toBe(false);
    expect(match('envelopeFrom', 'bounce@example.net')).toBe(true);
    expect(match('to', 'real@example.org')).toBe(true);
  });
  test('repeated case-insensitive header names; missing and HTML-only text', () => {
    expect(match('header.X-TAG', 'b')).toBe(true);
    expect(match('header.missing', '')).toBe(false);
    expect(match('text', '')).toBe(true);
    expect(match('html', '<p>HTML only</p>')).toBe(true);
  });
  test('missing parsed data throws even under NOT, while legacy settings still pass', () => {
    expect(() => matchWebhookFilter({ operator: 'not', children: [{ field: 'subject', operator: 'equals', value: '' }] }, undefined, '', '')).toThrow();
    expect(matchWebhookFilter(undefined, undefined, '', '')).toBe(true);
  });
});
