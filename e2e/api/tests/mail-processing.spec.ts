import { expect, test, type APIRequestContext } from '@playwright/test';
import { createTestAddress, deleteAddress, WORKER_URL } from '../../fixtures/test-helpers';

const endpoint = `${WORKER_URL}/api/mail_processing`;
const resultHeaders = { 'x-test-mail-processing-provider': 'workers-ai', 'x-lang': 'en' };
const auth = (jwt: string) => ({ Authorization: `Bearer ${jwt}` });

async function seedMail(request: APIRequestContext, address: string, jwt: string, mime: string, body: string, subject = 'An update') {
  const response = await request.post(`${WORKER_URL}/__test/seed_mail`, { data: {
    address, raw: `Subject: ${subject}\r\nContent-Type: ${mime}; charset=utf-8\r\n\r\n${body}`,
  } });
  expect(response.ok()).toBe(true);
  const inbox = await request.get(`${WORKER_URL}/api/mails?limit=1&offset=0`, { headers: auth(jwt) });
  expect(inbox.ok()).toBe(true);
  return (await inbox.json()).results[0];
}

for (const provider of ['workers-ai', 'openai-chat', 'openai-responses', 'claude-messages']) {
  test(`${provider} processes only the requested mail and leaves the original unchanged`, async ({ request }) => {
    const { address, jwt } = await createTestAddress(request, 'process-');
    try {
      const mail = await seedMail(request, address, jwt, 'text/html', '<style>.hidden{display:none}</style><p>Package arrived.</p>');
      const headers = { ...auth(jwt), 'x-test-mail-processing-provider': provider, 'x-lang': 'zh' };
      const summary = await request.post(endpoint, { headers, data: { mailId: mail.id, action: 'summarize' } });
      expect(summary.status(), await summary.text()).toBe(200);
      expect(summary.headers()['cache-control']).toBe('no-store');
      expect(await summary.json()).toEqual({ text: 'Summary (zh): Subject: An update\n\nPackage arrived.' });

      const translation = await request.post(endpoint, { headers, data: { mailId: mail.id, action: 'translate' } });
      expect(translation.status(), await translation.text()).toBe(200);
      expect(await translation.json()).toEqual({ subject: 'Translation (zh): An update', text: 'Translation (zh): Package arrived.' });
      const original = await request.get(`${WORKER_URL}/api/mails?limit=1&offset=0`, { headers: auth(jwt) });
      expect((await original.json()).results[0]).toEqual(mail);
    } finally {
      await deleteAddress(request, jwt);
    }
  });
}

test('requires an enabled feature, configured provider, and mailbox ownership', async ({ request }) => {
  const owner = await createTestAddress(request, 'process-owner-');
  const other = await createTestAddress(request, 'process-other-');
  try {
    const mail = await seedMail(request, owner.address, owner.jwt, 'text/plain', 'Private email');
    const data = { mailId: mail.id, action: 'summarize' };
    const settings = await request.get(`${WORKER_URL}/api/settings`, { headers: auth(owner.jwt) });
    expect((await settings.json()).mailAiProcessing).toBeUndefined();
    const enabledSettings = await request.get(`${WORKER_URL}/api/settings`, { headers: { ...resultHeaders, ...auth(owner.jwt) } });
    expect((await enabledSettings.json()).mailAiProcessing).toBe(true);
    const disabledHeaders = { ...resultHeaders, ...auth(owner.jwt), 'x-test-mail-processing-enabled': 'false' };
    const disabled = await request.get(`${WORKER_URL}/api/settings`, { headers: disabledHeaders });
    expect(disabled.status()).toBe(200);
    expect((await disabled.json()).mailAiProcessing).toBeUndefined();
    expect((await request.post(endpoint, { headers: disabledHeaders, data })).status()).toBe(403);
    expect((await request.post(endpoint, { headers: auth(owner.jwt), data })).status()).toBe(403);
    expect((await request.post(endpoint, { headers: resultHeaders, data })).status()).toBe(401);
    expect((await request.post(endpoint, { headers: { ...resultHeaders, ...auth(other.jwt) }, data })).status()).toBe(404);
    expect((await request.post(endpoint, {
      headers: { ...resultHeaders, ...auth(owner.jwt) }, data: { ...data, action: 'unknown' },
    })).status()).toBe(400);
    for (const malformed of ['', '{']) {
      const response = await request.post(endpoint, {
        headers: { ...resultHeaders, ...auth(owner.jwt), 'content-type': 'application/json' }, data: malformed,
      });
      expect(response.status()).toBe(400);
      expect(await response.text()).not.toContain('SyntaxError');
    }
  } finally {
    await deleteAddress(request, owner.jwt);
    await deleteAddress(request, other.jwt);
  }
});

test('all providers use the existing AI allowlist, including wildcard entries', async ({ request }) => {
  const allowed = await createTestAddress(request, 'processallowed');
  const denied = await createTestAddress(request, 'processdenied');
  const allowlist = JSON.stringify({ enableAllowList: true, allowList: [allowed.address.replace(/\w{12}@/, '*@')] });
  try {
    for (const mailbox of [allowed, denied]) {
      const mail = await seedMail(request, mailbox.address, mailbox.jwt, 'text/plain', 'A private update.');
      const canProcess = mailbox === allowed;
      for (const provider of ['workers-ai', 'openai-chat', 'openai-responses', 'claude-messages']) {
        const headers = { ...auth(mailbox.jwt), 'x-test-mail-processing-provider': provider, 'x-test-ai-allowlist': allowlist };
        const capability = await request.get(`${WORKER_URL}/api/settings`, { headers });
        expect(capability.ok()).toBe(true);
        expect((await capability.json()).mailAiProcessing).toBe(canProcess ? true : undefined);
        for (const action of ['summarize', 'translate']) {
          const response = await request.post(endpoint, { headers, data: { mailId: mail.id, action } });
          expect(response.status(), await response.text()).toBe(canProcess ? 200 : 403);
        }
      }
    }
  } finally {
    await deleteAddress(request, allowed.jwt);
    await deleteAddress(request, denied.jwt);
  }
});

test('rejects empty or oversized mail, provider errors, and truncated Workers AI output', async ({ request }) => {
  const { address, jwt } = await createTestAddress(request, 'process-invalid-');
  const headers = { ...resultHeaders, ...auth(jwt) };
  try {
    for (const [body, status] of [
      ['', 422], ['a'.repeat(12_001), 413], ['fixture-provider-failure', 502], ['fixture-token-limit', 502],
      ['fixture-invalid-translation', 502],
    ] as const) {
      const mail = await seedMail(request, address, jwt, 'text/plain', body, body ? undefined : '');
      const response = await request.post(endpoint, { headers, data: { mailId: mail.id, action: 'translate' } });
      expect(response.status(), await response.text()).toBe(status);
      expect(await response.text()).not.toContain('Fixture provider failed');
      expect(await response.text()).not.toContain('Truncated result');
    }
    const subjectOnly = await seedMail(request, address, jwt, 'text/plain', '');
    const response = await request.post(endpoint, { headers, data: { mailId: subjectOnly.id, action: 'translate' } });
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ subject: 'Translation (en): An update', text: '' });
  } finally {
    await deleteAddress(request, jwt);
  }
});

test('Workers AI rejects truncated summaries and accepts a normal stop', async ({ request }) => {
  const { address, jwt } = await createTestAddress(request, 'process-summary-');
  const headers = { ...resultHeaders, ...auth(jwt) };
  try {
    for (const body of ['fixture-token-limit', 'fixture-finish-length']) {
      const mail = await seedMail(request, address, jwt, 'text/plain', body);
      const response = await request.post(endpoint, { headers, data: { mailId: mail.id, action: 'summarize' } });
      expect(response.status(), await response.text()).toBe(502);
      expect(await response.text()).not.toContain('Truncated result');
    }
    const mail = await seedMail(request, address, jwt, 'text/plain', 'fixture-finish-stop');
    const response = await request.post(endpoint, { headers, data: { mailId: mail.id, action: 'summarize' } });
    expect(response.status(), await response.text()).toBe(200);
    expect(await response.json()).toEqual({ text: 'Complete summary' });
  } finally {
    await deleteAddress(request, jwt);
  }
});

test('translates HTML with original link targets in the selected language and uses Worker prompts', async ({ request }) => {
  const { address, jwt } = await createTestAddress(request, 'process-links');
  try {
    const html = '<p><a href = "https://example.test/confirm?item=12&amp;slot=5"><strong>Confirm</strong></a> ' +
      '<a href=https://example.test/help>Help</a></p>';
    const mail = await seedMail(request, address, jwt, 'text/html', html);
    const headers = { ...auth(jwt), ...resultHeaders,
      'x-test-summary-prompt': 'Highlight deadlines.', 'x-test-translation-prompt': 'Use a formal tone.' };
    const summary = await request.post(endpoint, { headers, data: { mailId: mail.id, action: 'summarize' } });
    expect(summary.status(), await summary.text()).toBe(200);
    expect((await summary.json()).text).toMatch(/^Summary \(en\):/);
    const translation = await request.post(endpoint, { headers, data: { mailId: mail.id, action: 'translate', targetLanguage: 'ja' } });
    expect(translation.status(), await translation.text()).toBe(200);
    const { subject, text } = await translation.json();
    expect(subject).toBe('Translation (ja): An update');
    expect(text).toMatch(/^Translation \(ja\):/);
    expect(text).toContain('https://example.test/confirm?item=12&slot=5');
    expect(text).toContain('https://example.test/help');
    const invalid = await request.post(endpoint, { headers, data: { mailId: mail.id, action: 'translate', targetLanguage: 'invalid' } });
    expect(invalid.status()).toBe(400);
  } finally {
    await deleteAddress(request, jwt);
  }
});

test('allowlist read and JSON failures disable new AI actions without breaking mailbox settings', async ({ request }) => {
  const { address, jwt } = await createTestAddress(request, 'process-list-error');
  try {
    const mail = await seedMail(request, address, jwt, 'text/plain', 'A test message.');
    const headers = { ...resultHeaders, ...auth(jwt) };
    const url = `${WORKER_URL}/api/settings`;
    const normal = await (await request.get(url, { headers })).json();
    expect(normal.mailAiProcessing).toBe(true);
    for (const failure of ['read', 'json']) {
      const failingHeaders = { ...headers, 'x-test-fail-ai-allowlist': failure };
      const settings = await request.get(url, { headers: failingHeaders });
      expect(settings.status(), await settings.text()).toBe(200);
      expect(await settings.json()).toEqual({ address, send_balance: normal.send_balance, new_address_token: null });
      const action = await request.post(endpoint, { headers: failingHeaders, data: { mailId: mail.id, action: 'summarize' } });
      expect(action.status()).toBe(403);
    }
  } finally {
    await deleteAddress(request, jwt);
  }
});
