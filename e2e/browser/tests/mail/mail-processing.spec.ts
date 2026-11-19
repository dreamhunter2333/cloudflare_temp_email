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
