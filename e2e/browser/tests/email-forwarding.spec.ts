import { expect, test as base } from '@playwright/test';
import { FRONTEND_URL, WORKER_URL } from '../../fixtures/test-helpers';

const ADMIN_HEADERS = { 'x-admin-auth': 'e2e-admin-pass' };

const test = base.extend<{ originalSettings: Record<string, unknown> }>({
  originalSettings: async ({ request }, use) => {
    const response = await request.get(`${WORKER_URL}/admin/account_settings`, { headers: ADMIN_HEADERS });
    expect(response.ok()).toBe(true);
    const settings = await response.json();
    await use(settings);
    expect((await request.post(`${WORKER_URL}/admin/account_settings`, {
      headers: ADMIN_HEADERS, data: settings,
    })).ok()).toBe(true);
  },
});

for (const locale of ['en', 'zh']) {
  const labels = locale === 'en'
    ? { tab: 'Global Mailbox Settings', config: 'Config', save: 'Save', deleteOriginal: 'Delete original after forwarding', blockUnknown: 'Block receive unknow address email', any: 'Any', all: 'All', invalid: 'Invalid regex pattern', tooLong: 'Regex pattern too long' }
    : { tab: '全局邮箱设置', config: '配置', save: '保存', deleteOriginal: '转发成功后删除原邮件', blockUnknown: '禁止接收未知地址邮件', any: '任一', all: '全部', invalid: '无效的正则表达式', tooLong: '正则表达式过长' };

  test(`persists recipient filters and the forwarding delete-original switch (${locale})`, async ({ page, request, originalSettings: settings }, testInfo) => {
    expect((await request.post(`${WORKER_URL}/admin/account_settings`, {
      headers: ADMIN_HEADERS,
      data: {
        ...settings,
        emailRuleSettings: { emailForwardingList: [{ domains: [], forward: 'target@test.example.com' }] },
      },
    })).ok()).toBe(true);
    await page.addInitScript(() => {
      localStorage.setItem('adminAuth', 'e2e-admin-pass');
      sessionStorage.setItem('adminTab', 'qucickSetup');
    });
    const openConfig = async () => {
      const loaded = page.waitForResponse(response => (
        new URL(response.url()).pathname === '/admin/account_settings'
        && response.request().method() === 'GET'
      ));
      await page.goto(`${FRONTEND_URL}/${locale}/admin`);
      await page.getByText(labels.tab, { exact: true }).click();
      expect((await loaded).ok()).toBe(true);
      await page.getByRole('button', { name: labels.config, exact: true }).click();
    };
    await openConfig();
    const modal = page.getByRole('dialog');
    const toggle = modal.getByRole('switch', { name: labels.deleteOriginal });
    await expect(toggle).not.toBeChecked();
    const recipient = modal.locator('tbody tr').first().locator('td').nth(2);
    await recipient.locator('.n-base-selection').click();
    await recipient.locator('.n-base-selection-input-tag__input').fill('^[^@]*admin[^@]*@');
    await recipient.locator('.n-base-selection-input-tag__input').press('Enter');
    await recipient.locator('.n-base-selection-input-tag__input').press('Tab');

    for (const enabled of [true, false]) {
      await recipient.getByText(enabled ? labels.all : labels.any, { exact: true }).click();
      await toggle.click();
      await expect(toggle).toBeChecked({ checked: enabled });
      if (enabled) await testInfo.attach(`forwarding-${locale}`, {
        body: await page.screenshot({ fullPage: true }), contentType: 'image/png',
      });
      await modal.getByRole('button', { name: labels.save, exact: true }).click();
      await expect(modal).toBeHidden();
      const saved = page.waitForResponse(response => (
        new URL(response.url()).pathname === '/admin/account_settings'
        && response.request().method() === 'POST'
      ));
      await page.getByRole('button', { name: labels.save, exact: true }).click();
      expect((await saved).ok()).toBe(true);
      const persisted = await request.get(`${WORKER_URL}/admin/account_settings`, { headers: ADMIN_HEADERS });
      expect((await persisted.json()).emailRuleSettings.emailForwardingList[0]).toMatchObject({
        deleteOriginal: enabled, recipientPatterns: ['^[^@]*admin[^@]*@'], recipientMatchMode: enabled ? 'all' : 'any',
      });
      await openConfig();
      await expect(toggle).toBeChecked({ checked: enabled });
      await expect(recipient.locator(`input[value="${enabled ? 'all' : 'any'}"]`)).toBeChecked();
      await expect(recipient).toContainText('^[^@]*admin[^@]*@');
    }
  });

  test(`validates recipient regex and allows an empty filter (${locale})`, async ({ page, request, originalSettings: settings }) => {
    expect((await request.post(`${WORKER_URL}/admin/account_settings`, {
      headers: ADMIN_HEADERS,
      data: { ...settings, emailRuleSettings: { emailForwardingList: [{ forward: 'target@test.example.com' }] } },
    })).ok()).toBe(true);
    await page.addInitScript(() => {
      localStorage.setItem('adminAuth', 'e2e-admin-pass');
      sessionStorage.setItem('adminTab', 'qucickSetup');
    });
    const loaded = page.waitForResponse(response => (
      new URL(response.url()).pathname === '/admin/account_settings' && response.request().method() === 'GET'
    ));
    await page.goto(`${FRONTEND_URL}/${locale}/admin`);
    await page.getByText(labels.tab, { exact: true }).click();
    expect((await loaded).ok()).toBe(true);
    await page.getByRole('button', { name: labels.config, exact: true }).click();
    const modal = page.getByRole('dialog');
    const recipient = modal.locator('tbody tr').first().locator('td').nth(2);
    for (const [pattern, error] of [['[', labels.invalid], ['a'.repeat(201), labels.tooLong]]) {
      await recipient.locator('.n-base-selection').click();
      await recipient.locator('.n-base-selection-input-tag__input').fill(pattern);
      await recipient.locator('.n-base-selection-input-tag__input').press('Enter');
      await recipient.locator('.n-base-selection-input-tag__input').press('Tab');
      await modal.getByRole('button', { name: labels.save, exact: true }).click();
      await expect(modal).toBeVisible();
      await expect(page.locator('.n-message').filter({ hasText: error })).toBeVisible();
      await recipient.getByRole('button', { name: 'close', exact: true }).click();
    }
    await modal.getByRole('button', { name: labels.save, exact: true }).click();
    await expect(modal).toBeHidden();
    const saved = page.waitForResponse(response => (
      new URL(response.url()).pathname === '/admin/account_settings' && response.request().method() === 'POST'
    ));
    await page.getByRole('button', { name: labels.save, exact: true }).click();
    expect((await saved).ok()).toBe(true);
    const persisted = await request.get(`${WORKER_URL}/admin/account_settings`, { headers: ADMIN_HEADERS });
    expect((await persisted.json()).emailRuleSettings.emailForwardingList[0].recipientPatterns).toEqual([]);
  });

  for (const initialEnabled of [false, true]) {
    test(`discards an unconfirmed delete-original toggle (${locale}, initially ${initialEnabled})`, async ({ page, request, originalSettings: settings }) => {
      expect((await request.post(`${WORKER_URL}/admin/account_settings`, {
        headers: ADMIN_HEADERS,
        data: {
          ...settings,
          emailRuleSettings: {
            blockReceiveUnknowAddressEmail: false,
            emailForwardingList: [{ domains: [], forward: 'target@test.example.com', deleteOriginal: initialEnabled }],
          },
        },
      })).ok()).toBe(true);
      await page.addInitScript(() => {
        localStorage.setItem('adminAuth', 'e2e-admin-pass');
        sessionStorage.setItem('adminTab', 'qucickSetup');
      });
      const openConfig = async () => {
        const loaded = page.waitForResponse(response => (
          new URL(response.url()).pathname === '/admin/account_settings'
          && response.request().method() === 'GET'
        ));
        await page.goto(`${FRONTEND_URL}/${locale}/admin`);
        await page.getByText(labels.tab, { exact: true }).click();
        expect((await loaded).ok()).toBe(true);
        await page.getByRole('button', { name: labels.config, exact: true }).click();
      };
      await openConfig();
      const modal = page.getByRole('dialog');
      const toggle = modal.getByRole('switch', { name: labels.deleteOriginal });
      const recipient = modal.locator('tbody tr').first().locator('td').nth(2);
      await recipient.locator('.n-base-selection').click();
      await recipient.locator('.n-base-selection-input-tag__input').fill('unsaved');
      await recipient.locator('.n-base-selection-input-tag__input').press('Enter');
      await recipient.locator('.n-base-selection-input-tag__input').press('Tab');
      await recipient.getByText(labels.all, { exact: true }).click();
      await expect(toggle).toBeChecked({ checked: initialEnabled });
      await toggle.click();
      await expect(toggle).toBeChecked({ checked: !initialEnabled });
      if (initialEnabled) await page.keyboard.press('Escape');
      else await modal.locator('.n-card-header__close').click();
      await expect(modal).toBeHidden();

      const otherSetting = page.locator('.n-form-item').filter({ hasText: labels.blockUnknown }).getByRole('switch');
      await expect(otherSetting).not.toBeChecked();
      await otherSetting.click();
      await expect(otherSetting).toBeChecked();
      const saved = page.waitForResponse(response => (
        new URL(response.url()).pathname === '/admin/account_settings'
        && response.request().method() === 'POST'
      ));
      const refreshed = page.waitForResponse(response => (
        new URL(response.url()).pathname === '/admin/account_settings'
        && response.request().method() === 'GET'
      ));
      await page.getByRole('button', { name: labels.save, exact: true }).click();
      const response = await saved;
      expect(response.ok()).toBe(true);
      const submitted = response.request().postDataJSON().emailRuleSettings;
      expect(submitted.blockReceiveUnknowAddressEmail).toBe(true);
      expect(submitted.emailForwardingList[0].deleteOriginal).toBe(initialEnabled);
      expect(submitted.emailForwardingList[0].recipientPatterns).toBeUndefined();
      expect(submitted.emailForwardingList[0].recipientMatchMode).toBeUndefined();
      expect((await refreshed).ok()).toBe(true);

      const persisted = await request.get(`${WORKER_URL}/admin/account_settings`, { headers: ADMIN_HEADERS });
      expect(persisted.ok()).toBe(true);
      const rules = (await persisted.json()).emailRuleSettings;
      expect(rules.blockReceiveUnknowAddressEmail).toBe(true);
      expect(rules.emailForwardingList[0].deleteOriginal).toBe(initialEnabled);
      await openConfig();
      await expect(toggle).toBeChecked({ checked: initialEnabled });
    });
  }
}
