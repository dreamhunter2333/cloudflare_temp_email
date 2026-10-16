import { expect, test } from '@playwright/test';
import { sign } from 'hono/jwt';

import { FRONTEND_URL, WORKER_URL, createTestAddress, deleteAddress } from '../../fixtures/test-helpers';

test('historical mailbox cache keeps both login methods through renewal and password-only mode', async ({ page, request }) => {
  const mailbox = await createTestAddress(request, 'cached-login');
  const other = await createTestAddress(request, 'cached-other');
  const now = Math.floor(Date.now() / 1000);
  const passwordToken = await sign({
    address: mailbox.address, address_id: mailbox.address_id, type: 'address_password_login',
    iat: now - 24 * 86400, exp: now + 6 * 86400,
  }, 'e2e-test-secret-key', 'HS256');
  const readCache = () => page.evaluate(() => JSON.parse(localStorage.getItem('LocalAddressCache') || '[]'));
  try {
    await page.goto(`${FRONTEND_URL}/en/`);
    await page.evaluate(cache => localStorage.setItem('LocalAddressCache', JSON.stringify(cache)), [
      mailbox.jwt, passwordToken, other.jwt,
      { token: 'superseded-password-token', address: mailbox.address, type: 'address_password_login' },
    ]);
    await page.goto(`${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`);
    await expect.poll(readCache).toEqual([
      { token: mailbox.jwt, address: mailbox.address, type: null },
      { token: passwordToken }, { token: other.jwt },
      { token: 'superseded-password-token', address: mailbox.address, type: 'address_password_login' },
    ]);

    await page.locator('.address-select').click();
    await page.locator('.n-base-select-menu:visible').getByText('Saved mailbox 2', { exact: true }).click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('jwt'))).not.toBe(passwordToken);
    await expect.poll(readCache).toEqual([
      { token: mailbox.jwt, address: mailbox.address, type: null },
      { token: expect.any(String), address: mailbox.address, type: 'address_password_login' },
      { token: other.jwt },
    ]);
    const renewedToken = await page.evaluate(() => localStorage.getItem('jwt'));
    expect(renewedToken).not.toBe(mailbox.jwt);
    expect((await readCache())[1].token).toBe(renewedToken);
    const settings = await request.get(`${WORKER_URL}/api/settings`, {
      headers: { Authorization: `Bearer ${renewedToken}` },
    });
    expect(settings.ok()).toBe(true);
    const renewedSettings = await settings.json();
    expect(renewedSettings.exp - renewedSettings.iat).toBe(30 * 86400);

    await page.locator('.address-manage').click();
    const rows = page.locator('.n-modal .n-data-table-tbody .n-data-table-tr');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText(`${mailbox.address} (Credential Login)`);
    await expect(rows.nth(1)).toContainText(`${mailbox.address} (Password Login)`);
    await expect(rows.nth(2)).toContainText('Saved mailbox 3');
    await page.keyboard.press('Escape');
    await page.locator('.address-select').click();
    const options = page.locator('.n-base-select-menu:visible');
    await expect(options).toContainText('Credential Login');
    await expect(options).toContainText('Password Login');
    await options.getByText('Saved mailbox 3', { exact: true }).click();
    await expect.poll(readCache).toEqual([
      { token: mailbox.jwt, address: mailbox.address, type: null },
      { token: renewedToken, address: mailbox.address, type: 'address_password_login' },
      { token: other.jwt, address: other.address, type: null },
    ]);

    await page.setExtraHTTPHeaders({ 'x-test-address-password-mode': 'password-only' });
    await page.goto(`${FRONTEND_URL}/en/?jwt=${renewedToken}`);
    await page.locator('.address-select').click();
    await expect(options).toContainText('Password Login');
    await expect(options).not.toContainText('Credential Login');
    await page.keyboard.press('Escape');
    await page.locator('.address-manage').click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Password Login');
    expect(await readCache()).toHaveLength(3);

    await page.goto(`${FRONTEND_URL}/en/?jwt=`);
    await expect(page.getByRole('button', { name: 'Log In to Mailbox', exact: true })).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Credential Login', exact: true })).toHaveCount(0);
  } finally {
    await deleteAddress(request, mailbox.jwt);
    await deleteAddress(request, other.jwt);
  }
});
