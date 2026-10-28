import { expect, test } from '@playwright/test';

import { FRONTEND_URL, WORKER_URL, createTestAddress, deleteAddress, hashPassword } from '../../fixtures/test-helpers';

for (const mode of ['default', 'password-only', 'password-disabled']) {
  test(`mailbox login page: ${mode}`, async ({ page, request }, testInfo) => {
    const mailbox = await createTestAddress(request, 'login-entry-ui');
    const password = 'mailbox-entry-password';
    try {
      const changed = await request.post(`${WORKER_URL}/api/address_change_password`, {
        headers: { Authorization: `Bearer ${mailbox.jwt}` },
        data: { new_password: hashPassword(password) },
      });
      expect(changed.ok()).toBe(true);
      if (mode !== 'default') {
        await page.setExtraHTTPHeaders({ 'x-test-address-password-mode': mode });
      }
      await page.goto(`${FRONTEND_URL}/en/`);
      const form = page.locator('.n-form:visible').first();
      await expect(form.getByRole('button', { name: 'Log In to Mailbox', exact: true })).toBeVisible();
      const credentialToggle = page.getByRole('button', { name: 'Credential Login', exact: true });
      if (mode === 'default') {
        await expect(credentialToggle).toBeVisible();
        await credentialToggle.click();
        await expect(form.locator('textarea')).toBeVisible();
        await page.getByRole('button', { name: 'Password Login', exact: true }).click();
      } else {
        await expect(credentialToggle).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Password Login', exact: true })).toHaveCount(0);
      }

      if (mode === 'password-disabled') {
        await expect(form.locator('input[type="password"]')).toHaveCount(0);
        await form.locator('textarea').fill(mailbox.jwt);
      } else {
        await expect(form.locator('input[type="password"]')).toBeVisible();
        if (mode === 'password-only') {
          await expect(form.locator('textarea')).toHaveCount(0);
          await testInfo.attach('Password-only login page', {
            body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png',
          });
        }
        await form.locator('input').first().fill(mailbox.address);
        await form.locator('input[type="password"]').fill(password);
      }
      const settingsResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/settings');
      await form.getByRole('button', { name: 'Log In to Mailbox', exact: true }).click();
      const settings = await settingsResponse;
      expect(settings.ok()).toBe(true);
      expect(await settings.json()).toMatchObject({ address: mailbox.address });
    } finally {
      await deleteAddress(request, mailbox.jwt);
    }
  });
}
