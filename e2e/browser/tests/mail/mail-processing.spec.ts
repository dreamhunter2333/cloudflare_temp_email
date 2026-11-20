import { expect, request as apiRequest, test } from '@playwright/test';
import { createTestAddress, deleteAddress, FRONTEND_URL, seedTestMail } from '../../../fixtures/test-helpers';

for (const reader of ['desktop', 'mobile', 'simple']) {
  test(`mail processing runs only on demand in the ${reader} inbox`, async ({ page }) => {
    const api = await apiRequest.newContext();
    const mailbox = await createTestAddress(api, 'mail-processing');
    try {
      let calls = 0;
      const headers = { 'x-test-mail-processing-provider': 'workers-ai' };
      await page.route('**/api/settings', route => route.continue({
        headers: { ...route.request().headers(), ...headers },
      }));
      await page.route('**/api/mail_processing', route => {
        calls++;
        return route.continue({ headers: { ...route.request().headers(), ...headers } });
      });
      await seedTestMail(api, mailbox.address, { subject: 'Delivery update', text: 'The package arrived.' });
      if (reader !== 'desktop') await page.setViewportSize({ width: reader === 'mobile' ? 320 : 390, height: 844 });
      await page.addInitScript(value => localStorage.setItem('useSimpleIndex', String(value)), reader === 'simple');
      await page.goto(`${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`);
      if (reader === 'mobile') await page.getByText('Delivery update', { exact: true }).click();
      const summarize = page.getByRole('button', { name: 'Summarize', exact: true });
      const translate = page.getByRole('button', { name: 'Translate', exact: true });
      const showOriginal = page.getByRole('button', { name: 'Show original', exact: true });
      const summary = page.locator('.mail-processing-summary');
      const translation = page.locator('.mail-content > .mail-translation');
      const title = page.locator('.mail-item .n-card-header__main, .n-drawer-header__main, h3').filter({ hasText: 'Delivery update' });
      const close = page.getByRole('status').filter({ has: summary }).getByRole('button', { name: 'close', exact: true });
      await expect(summarize).toBeVisible();
      if (reader !== 'simple') {
        const actions = page.locator('.mail-actions');
        await expect(actions.getByRole('button')).toHaveText([
          'Summarize', 'Translate', 'Reply', 'Forward', 'More', 'Delete',
        ]);
        const [summaryY, translateY, replyY, forwardY] = await actions.getByRole('button').evaluateAll(buttons =>
          buttons.map(button => button.getBoundingClientRect().top));
        expect(translateY).toBe(summaryY);
        if (reader === 'mobile') {
          expect(replyY).toBeGreaterThanOrEqual(summaryY);
          expect(forwardY).toBeGreaterThan(summaryY);
        } else {
          expect(replyY).toBe(summaryY);
          expect(forwardY).toBe(summaryY);
        }
      }
      expect(calls).toBe(0);
      await summarize.click();
      await expect(summary).toContainText('Summary (en): Subject: Delivery update');
      await close.press('Enter');
      await expect(summary).toHaveCount(0);
      await expect(summarize).toBeFocused();
      await translate.click();
      await expect(title).toHaveText('Translation (en): Delivery update');
      if (reader === 'desktop') await expect(page.locator('.mail-summary-subject')).toHaveText('Delivery update');
      await expect(translation).toHaveText('Translation (en): The package arrived.');
      await expect(translation).toHaveAttribute('lang', 'en');
      await expect(page.locator('.mail-content .mail-html, .mail-content .mail-iframe')).toHaveCount(0);
      await showOriginal.click();
      await expect(title).toHaveText('Delivery update');
      await expect(translation).toHaveCount(0);
      await expect(translate).toBeFocused();
      expect(calls).toBe(2);
      await translate.press('Enter');
      await expect(translation).toHaveText('Translation (en): The package arrived.');
      expect(calls).toBe(3);
    } finally {
      await deleteAddress(api, mailbox.jwt);
      await api.dispose();
    }
  });
}

test('uses the browser-local translation language without changing the interface or summaries', async ({ page }) => {
  const api = await apiRequest.newContext();
  const mailbox = await createTestAddress(api, 'translation-lang');
  try {
    await page.route(/\/api\/(settings|mail_processing)$/, route => route.continue({ headers: {
      ...route.request().headers(), 'x-test-mail-processing-provider': 'workers-ai',
    } }));
    await seedTestMail(api, mailbox.address, { subject: 'Delivery update', text: 'The package arrived.' });
    await page.goto(`${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`);
    await page.getByText('Mailbox Settings', { exact: true }).click();
    const assistant = page.locator('summary', { hasText: 'Mail AI Assistant' });
    const language = page.getByLabel('Translation language');
    await expect(assistant).toBeVisible();
    await expect(language).toBeHidden();
    await assistant.press('Enter');
    await expect(language).toBeVisible();
    await expect(page.getByRole('form', { name: 'Custom model' })).toHaveCount(0);
    await language.click();
    await page.getByText('日本語', { exact: true }).click();
    await page.reload();
    await expect(assistant).toBeVisible();
    await expect(language).toBeHidden();
    await assistant.click();
    await expect(page.getByText('日本語', { exact: true })).toBeVisible();
    await page.getByText('Inbox', { exact: true }).click();
    const translation = page.locator('.mail-content > .mail-translation');
    const summary = page.locator('.mail-processing-summary');
    await page.getByRole('button', { name: 'Translate', exact: true }).click();
    await expect(page.getByText('Translation (ja): Delivery update', { exact: true })).toBeVisible();
    await expect(translation).toHaveText('Translation (ja): The package arrived.');
    await expect(translation).toHaveAttribute('lang', 'ja');
    await page.getByRole('button', { name: 'Summarize', exact: true }).click();
    await expect(summary).toContainText('Summary (en):');
    await expect(summary).toHaveAttribute('lang', 'en');
    await expect(translation).toBeVisible();
  } finally {
    await deleteAddress(api, mailbox.jwt);
    await api.dispose();
  }
});

test('a mailbox outside the site allowlist uses its own model and browser-only settings', async ({ page, context }) => {
  const api = await apiRequest.newContext();
  const mailbox = await createTestAddress(api, 'personal-model');
  const other = await createTestAddress(api, 'other-model');
  const providerUrl = 'https://personal-ai.example.test/v1';
  const key = 'mock-custom-ai-key';
  const expected = {
    '/v1/chat/completions': 'OpenAI Chat Completions',
    '/v1/responses': 'OpenAI Responses',
    '/v1/messages': 'Claude Messages',
  };
  const outgoing: { path: string; instruction: string; input: string }[] = [];
  let siteRequests = 0;
  try {
    await context.route('**/api/settings', route => route.continue({ headers: {
      ...route.request().headers(), 'x-test-mail-processing-provider': 'workers-ai',
      'x-test-ai-allowlist': JSON.stringify({ enableAllowList: true, allowList: [] }),
    } }));
    await context.route('**/api/mail_processing', route => {
      siteRequests++;
      return route.abort();
    });
    await context.route('https://personal-ai.example.test/**', async route => {
      const request = route.request();
      const cors = {
        'access-control-allow-origin': new URL(FRONTEND_URL).origin,
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type, authorization, x-api-key, anthropic-version',
      };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const path = new URL(request.url()).pathname;
      const headers = request.headers();
      const body = request.postDataJSON();
      expect(headers.cookie).toBeUndefined();
      expect(headers.referer).toBeUndefined();
      for (const header of ['x-user-token', 'x-admin-auth', 'x-custom-auth', 'x-user-access-token']) {
        expect(headers[header]).toBeUndefined();
      }
      expect(path in expected).toBe(true);
      expect(body.model).toBe('personal-test-model');
      if (path === '/v1/messages') {
        expect(headers['x-api-key']).toBe(key);
        expect(headers.authorization).toBeUndefined();
        expect(headers['anthropic-version']).toBe('2023-06-01');
      } else {
        expect(headers.authorization).toBe('Bearer ' + key);
        expect(body.store).toBe(false);
      }
      const instruction = body.instructions ?? body.system ?? body.messages[0].content;
      const input = body.input ?? body.messages.at(-1).content;
      outgoing.push({ path, instruction, input });
      const output = instruction.startsWith('Summarize') ? 'Custom summary'
        : JSON.stringify({ subject: 'Translated package', text: 'Translated body' });
      const json = path === '/v1/messages' ? { stop_reason: 'end_turn', content: [{ type: 'text', text: output }] }
        : path === '/v1/responses' ? { status: 'completed', output: [
          { type: 'message', content: [{ type: 'output_text', text: output }] },
        ] } : { choices: [{ finish_reason: 'stop', message: { content: output } }] };
      return route.fulfill({ json, headers: cors });
    });
    await seedTestMail(api, mailbox.address, { subject: 'Package update', text: 'A package arrived.' });
    await page.goto(`${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`);
    await page.getByRole('button', { name: 'Summarize', exact: true }).click();
    await expect(page.getByText(/Save a custom model in Mailbox Settings/)).toBeVisible();
    expect(outgoing).toHaveLength(0);
    const assistant = page.locator('summary', { hasText: 'Mail AI Assistant' });
    const form = page.getByRole('form', { name: 'Custom model' });
    for (const [path, label] of Object.entries(expected)) {
      await page.getByText('Mailbox Settings', { exact: true }).click();
      await expect(form).toBeHidden();
      await assistant.click();
      await form.getByText(label, { exact: true }).click();
      await expect(form.getByRole('radio', { name: label, exact: true })).toBeChecked();
      await form.getByLabel('API Base URL', { exact: true }).fill(providerUrl);
      await form.getByLabel('Model name', { exact: true }).fill('personal-test-model');
      await form.getByLabel('API Key', { exact: true }).fill(key);
      await form.getByLabel('Summary prompt', { exact: true }).fill('Highlight the next step.');
      await form.getByRole('button', { name: 'Save model', exact: true }).click();
      await expect(form.getByRole('status')).toHaveText('Saved in this browser');
      await page.getByText('Inbox', { exact: true }).click();
      await page.getByRole('button', { name: 'Summarize', exact: true }).click();
      await expect(page.locator('.mail-processing-summary')).toHaveText('Custom summary');
      expect(outgoing.at(-1)).toMatchObject({
        path, instruction: expect.stringContaining('Highlight the next step.'),
        input: 'Subject: Package update\n\nA package arrived.',
      });
      await page.getByRole('button', { name: 'Translate', exact: true }).click();
      await expect(page.locator('.mail-content > .mail-translation')).toHaveText('Translated body');
      await expect(page.getByText('Translated package', { exact: true })).toBeVisible();
      expect(outgoing.at(-1)).toMatchObject({
        path, instruction: expect.stringContaining('Translate the subject and body into English.'),
        input: JSON.stringify({ subject: 'Package update', text: 'A package arrived.' }),
      });
      await page.getByRole('button', { name: 'Show original', exact: true }).click();
    }
    expect(outgoing).toHaveLength(6);
    expect(siteRequests).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem('mailAiCustomProfiles'))).not.toContain(key);

    await page.getByText('Mailbox Settings', { exact: true }).click();
    await page.reload();
    await assistant.click();
    await expect(form.getByLabel('API Key', { exact: true })).toHaveValue(key);
    await form.getByLabel('API Base URL', { exact: true }).fill('https://different.example.test/v1');
    await expect(form.getByLabel('API Key', { exact: true })).toHaveValue('');

    const freshTab = await context.newPage();
    await freshTab.goto(`${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`);
    await freshTab.getByText('Mailbox Settings', { exact: true }).click();
    await freshTab.locator('summary', { hasText: 'Mail AI Assistant' }).click();
    const freshForm = freshTab.getByRole('form', { name: 'Custom model' });
    await expect(freshForm.getByLabel('API Base URL', { exact: true })).toHaveValue(providerUrl);
    await expect(freshForm.getByLabel('API Key', { exact: true })).toHaveValue('');
    await freshTab.close();

    await page.goto(`${FRONTEND_URL}/en/?jwt=${other.jwt}`);
    await expect(page.getByText(other.address, { exact: true })).toBeVisible();
    await assistant.click();
    await expect(form.getByLabel('API Base URL', { exact: true })).toHaveValue('');
    await expect(form.getByLabel('API Key', { exact: true })).toHaveValue('');
  } finally {
    await deleteAddress(api, mailbox.jwt);
    await deleteAddress(api, other.jwt);
    await api.dispose();
  }
});
