import { expect, request as apiRequest, test, type APIRequestContext } from '@playwright/test';
import { createTestAddress, deleteAddress, FRONTEND_URL, seedTestMail, WORKER_URL } from '../../../fixtures/test-helpers';

const mailProcessingUrl = /\/api\/mails\/\d+\/(summarize|translate)$/;

async function seedSinglePart(api: APIRequestContext, address: string, subject: string, type: string, body: string) {
  const response = await api.post(`${WORKER_URL}/__test/seed_mail`, {
    data: { address, raw: `Subject: ${subject}\r\nContent-Type: ${type}; charset=utf-8\r\n\r\n${body}` },
  });
  expect(response.ok()).toBe(true);
}

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
      await page.route(mailProcessingUrl, route => {
        calls++;
        return route.continue({ headers: { ...route.request().headers(), ...headers } });
      });
      await seedSinglePart(api, mailbox.address, 'Delivery update', 'text/plain', 'The package arrived.');
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
    await page.route(/\/api\/(settings|mails\/\d+\/(summarize|translate))$/, route => route.continue({ headers: {
      ...route.request().headers(), 'x-test-mail-processing-provider': 'workers-ai',
    } }));
    await seedSinglePart(api, mailbox.address, 'Delivery update', 'text/plain', 'The package arrived.');
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

for (const iframe of [false, true]) {
  test(`retains HTML styles and the original button in the ${iframe ? 'iframe' : 'shadow DOM'} reader`, async ({ page }) => {
    const api = await apiRequest.newContext();
    const mailbox = await createTestAddress(api, 'processing-links');
    const subject = 'Confirm your update';
    const url = 'https://example.test/confirm?item=12&slot=5';
    const html = '<table style="background-color: #c8e1e7"><tr><td><strong>Your order is ready</strong><br>'
      + '<a style="color: #175e54" href="https://example.test/confirm?item=12&amp;slot=5">Open account</a></td></tr></table>'
      + '<script>not part of the text</script><img src="https://tracker.example.test/pixel">';
    try {
      const headers = { 'x-test-mail-processing-provider': 'workers-ai' };
      await page.route('**/api/settings', route => route.continue({ headers: { ...route.request().headers(), ...headers } }));
      await page.route(mailProcessingUrl, route => {
        const data = route.request().postDataJSON();
        expect(Object.keys(data).sort()).toEqual(['html', 'subject']);
        expect(data.subject).toBe(subject);
        expect(data.html).toContain('<table style="background-color: #c8e1e7">');
        expect(data.html).toContain('href="https://example.test/confirm?item=12&amp;slot=5"');
        expect(data.html).not.toContain('<script>');
        return route.continue({ headers: { ...route.request().headers(), ...headers } });
      });
      await page.addInitScript(useIframe => {
        localStorage.setItem('autoLoadRemoteImages', 'false');
        localStorage.setItem('useIframeShowMail', String(useIframe));
      }, iframe);
      if (iframe) {
        await seedSinglePart(api, mailbox.address, subject, 'text/html', html);
      } else {
        await seedTestMail(api, mailbox.address, { subject, text: 'Open account', html });
      }
      let trackerRequests = 0;
      await page.route('https://tracker.example.test/**', route => {
        trackerRequests++;
        return route.abort();
      });
      await page.goto(`${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`);
      const reader = iframe ? page.frameLocator('.mail-content .mail-iframe') : page.locator('.mail-content .mail-html');
      const button = reader.getByRole('link', { name: 'Open account', exact: true });
      await expect(button).toHaveAttribute('href', url);
      await page.getByRole('button', { name: 'Translate', exact: true }).click();
      const translatedButton = reader.getByRole('link', { name: 'Translation (en): Open account', exact: true });
      await expect(translatedButton).toHaveAttribute('href', url);
      await expect(translatedButton).toHaveCSS('color', 'rgb(23, 94, 84)');
      await expect(reader.locator('table')).toHaveCSS('background-color', 'rgb(200, 225, 231)');
      await expect(reader.locator('strong')).toHaveText('Translation (en): Your order is ready');
      await expect(reader.locator('img')).not.toHaveAttribute('src', 'https://tracker.example.test/pixel');
      expect(trackerRequests).toBe(0);
      if (!iframe) {
        await page.getByRole('button', { name: 'More actions' }).click();
        await page.getByRole('button', { name: 'Fullscreen' }).click();
        await expect(page.locator('.fullscreen-mail-content').getByRole('link', { name: 'Translation (en): Open account' }))
          .toHaveAttribute('href', url);
        await page.getByRole('button', { name: 'close', exact: true }).click();
      }
      await page.getByRole('button', { name: 'Show original', exact: true }).click();
      await expect(button).toHaveAttribute('href', url);
      await expect(reader.locator('strong')).toHaveText('Your order is ready');
    } finally {
      await deleteAddress(api, mailbox.jwt);
      await api.dispose();
    }
  });
}

test('shows model-generated HTML through the mail reader and can switch back to the original', async ({ page }) => {
  const api = await apiRequest.newContext();
  const mailbox = await createTestAddress(api, 'translated-layout');
  try {
    const headers = { 'x-test-mail-processing-provider': 'workers-ai' };
    await page.route(/\/api\/(settings|mails\/\d+\/translate)$/, route => route.continue({
      headers: { ...route.request().headers(), ...headers },
    }));
    await seedSinglePart(api, mailbox.address, 'Account notice', 'text/html',
      '<p>Account notice</p><a href="https://example.test/original">fixture-changed-html</a>');
    await page.goto(`${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`);
    await page.getByRole('button', { name: 'Translate', exact: true }).click();
    const reader = page.locator('.mail-content .mail-html');
    const heading = reader.getByRole('heading', { name: 'Translated notice' });
    await expect(heading).toBeVisible();
    expect(await heading.getAttribute('onfocus')).toBeNull();
    await expect(reader.getByRole('link', { name: 'Open account' })).toHaveAttribute('href', 'https://example.test/changed');
    await page.getByRole('button', { name: 'Show original', exact: true }).click();
    await expect(page.locator('.mail-item .n-card-header__main')).toHaveText('Account notice');
    await expect(reader.locator('p').first()).toHaveText('Account notice');
    await expect(reader.locator('a')).toHaveAttribute('href', 'https://example.test/original');
  } finally {
    await deleteAddress(api, mailbox.jwt);
    await api.dispose();
  }
});

test('a mailbox outside the allowlist can read mail without AI actions or settings', async ({ page }) => {
  const api = await apiRequest.newContext();
  const mailbox = await createTestAddress(api, 'no-site-model');
  try {
    await page.route('**/api/settings', route => route.continue({ headers: {
      ...route.request().headers(), 'x-test-mail-processing-provider': 'workers-ai',
      'x-test-ai-allowlist': JSON.stringify({ enableAllowList: true, allowList: [] }),
    } }));
    await seedTestMail(api, mailbox.address, { subject: 'Package update', text: 'A package arrived.' });
    await page.goto(`${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`);
    await expect(page.getByRole('button', { name: 'Reply', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Summarize', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Translate', exact: true })).toHaveCount(0);
    await page.getByText('Mailbox Settings', { exact: true }).click();
    await expect(page.locator('summary', { hasText: 'Mail AI Assistant' })).toHaveCount(0);
  } finally {
    await deleteAddress(api, mailbox.jwt);
    await api.dispose();
  }
});
