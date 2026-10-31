import { expect, test } from '@playwright/test';
import { sign } from 'hono/jwt';

import { FRONTEND_URL, WORKER_URL, createTestAddress, deleteAddress, hashPassword } from '../../fixtures/test-helpers';

test('renewal updates the current JWT; expired cached sessions require login', async ({ page, request }, testInfo) => {
  const mailbox = await createTestAddress(request, 'cached-login');
  const other = await createTestAddress(request, 'cached-other');
  const now = Math.floor(Date.now() / 1000);
  const passwordToken = await sign({
    address: mailbox.address, address_id: mailbox.address_id, type: 'address_password_login',
    iat: now - 24 * 86400, exp: now + 6 * 86400,
  }, 'e2e-test-secret-key', 'HS256');
  const expiredPasswordToken = await sign({
    address: mailbox.address, address_id: mailbox.address_id, type: 'address_password_login',
    iat: now - 31 * 86400, exp: now - 86400,
  }, 'e2e-test-secret-key', 'HS256');
  const readCache = () => page.evaluate(() => JSON.parse(localStorage.getItem('LocalAddressCache') || '[]'));
  try {
    const password = 'cached-mailbox-password';
    const changed = await request.post(`${WORKER_URL}/api/address_change_password`, {
      headers: { Authorization: `Bearer ${mailbox.jwt}` }, data: { new_password: hashPassword(password) },
    });
    expect(changed.ok()).toBe(true);
    await page.goto(`${FRONTEND_URL}/en/`);
    await page.evaluate(cache => localStorage.setItem('LocalAddressCache', JSON.stringify(cache)), [
      mailbox.jwt, passwordToken, other.jwt,
      expiredPasswordToken,
    ]);
    await page.goto(`${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`);
    await expect(page.locator('.address-select')).toContainText(mailbox.address);
    await expect.poll(readCache).toEqual([
      mailbox.jwt, passwordToken, other.jwt,
      expiredPasswordToken,
    ]);

    const settingsTokens: string[] = [];
    page.on('request', request => {
      if (new URL(request.url()).pathname === '/api/settings') {
        settingsTokens.push(request.headers().authorization);
      }
    });
    await page.locator('.address-select').click();
    await page.locator('.n-base-select-menu:visible').getByText(`${mailbox.address} (Password Login)`, { exact: true }).first().click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('jwt'))).not.toBe(passwordToken);
    await expect.poll(readCache).toEqual([
      mailbox.jwt, passwordToken, other.jwt, expiredPasswordToken, expect.any(String),
    ]);
    const renewedToken = await page.evaluate(() => localStorage.getItem('jwt'));
    expect(renewedToken).not.toBe(mailbox.jwt);
    expect((await readCache())[4]).toBe(renewedToken);
    const settings = await request.get(`${WORKER_URL}/api/settings`, {
      headers: { Authorization: `Bearer ${renewedToken}` },
    });
    expect(settings.ok()).toBe(true);
    const renewedSettings = await settings.json();
    expect(renewedSettings.exp - renewedSettings.iat).toBe(30 * 86400);

    await page.locator('.address-manage').click();
    const rows = page.locator('.n-modal .n-data-table-tbody .n-data-table-tr');
    await expect(rows).toHaveCount(5);
    await expect(rows.nth(0)).toContainText(`${mailbox.address} (Credential Login)`);
    await expect(rows.nth(1)).toContainText(`${mailbox.address} (Password Login)`);
    await expect(rows.nth(2)).toContainText(`${other.address} (Credential Login)`);
    expect(settingsTokens).toEqual([`Bearer ${passwordToken}`]);
    await testInfo.attach('Mailbox cache login methods', {
      body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png',
    });
    await page.keyboard.press('Escape');
    await page.locator('.address-select').click();
    const options = page.locator('.n-base-select-menu:visible');
    await expect(options).toContainText('Credential Login');
    await expect(options).toContainText('Password Login');
    await options.getByText(`${other.address} (Credential Login)`, { exact: true }).click();
    await expect.poll(readCache).toEqual([
      mailbox.jwt, passwordToken, other.jwt, expiredPasswordToken, renewedToken,
    ]);

    await page.locator('.address-select').click();
    const expiredSettings = page.waitForResponse(response => new URL(response.url()).pathname === '/api/settings');
    await options.getByText(`${mailbox.address} (Password Login)`, { exact: true }).nth(1).click();
    expect((await expiredSettings).status()).toBe(401);
    await expect(page.getByText('Mail address credential is invalid or account not exist, it may be network connection issue, please try again later.', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('jwt'))).toBe(expiredPasswordToken);
    expect(await readCache()).toEqual([mailbox.jwt, passwordToken, other.jwt, expiredPasswordToken, renewedToken]);
    const form = page.locator('.n-form:visible').first();
    await form.locator('input').first().fill(mailbox.address);
    await form.locator('input[type="password"]').fill(password);
    await form.getByRole('button', { name: 'Log In to Mailbox', exact: true }).click();
    await expect(page.locator('.address-select')).toContainText(mailbox.address);
    expect(await readCache()).toContain(expiredPasswordToken);

  } finally {
    await deleteAddress(request, mailbox.jwt);
    await deleteAddress(request, other.jwt);
  }
});

test('failed mailbox settings preserve the current token and historical cache', async ({ page, request }) => {
  const mailbox = await createTestAddress(request, 'cached-failure');
  const cache = JSON.stringify([
    mailbox.jwt,
    'saved-password-token',
  ]);
  try {
    await page.addInitScript(({ token, cache }) => {
      localStorage.setItem('jwt', token);
      localStorage.setItem('LocalAddressCache', cache);
    }, { token: mailbox.jwt, cache });
    await page.route('**/api/settings', route => route.fulfill({ status: 503, body: 'Settings temporarily unavailable' }));
    const failedSettings = page.waitForResponse(response => new URL(response.url()).pathname === '/api/settings');
    await page.goto(`${FRONTEND_URL}/en/`);
    expect((await failedSettings).status()).toBe(503);
    await expect(page.getByText('Mail address credential is invalid or account not exist, it may be network connection issue, please try again later.', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => ({
      token: localStorage.getItem('jwt'),
      cache: localStorage.getItem('LocalAddressCache'),
    }))).toEqual({ token: mailbox.jwt, cache });
  } finally {
    await deleteAddress(request, mailbox.jwt);
  }
});

test('the original local mailbox list saves the current token when settings fail', async ({ page, request }) => {
  const mailbox = await createTestAddress(request, 'cached-current');
  const other = await createTestAddress(request, 'uncached-current');
  const cache = JSON.stringify([mailbox.jwt]);
  try {
    await page.goto(`${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`);
    await expect(page.locator('.address-select')).toContainText(mailbox.address);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('LocalAddressCache'))).toBe(cache);
    await page.route('**/api/settings', route => route.fulfill({ status: 503, body: 'Settings temporarily unavailable' }));
    await page.locator('.address-manage').click();
    const modal = page.locator('.n-modal');
    await modal.getByText('Create or Bind', { exact: true }).click();
    await modal.getByRole('button', { name: 'Credential Login', exact: true }).click();
    await modal.locator('textarea').fill(other.jwt);
    const failedSettings = page.waitForResponse(response => new URL(response.url()).pathname === '/api/settings');
    await modal.getByRole('button', { name: 'Log In to Mailbox', exact: true }).click();
    expect((await failedSettings).status()).toBe(503);
    await modal.locator('.n-tabs-tab').filter({ hasText: /^Address$/ }).click();
    await expect(modal.locator('.n-data-table-tbody')).toContainText(other.address);
    await page.keyboard.press('Escape');
    await expect(page.locator('.address-select')).toContainText(other.address);
    expect(await page.evaluate(() => ({
      token: localStorage.getItem('jwt'), cache: localStorage.getItem('LocalAddressCache'),
    }))).toEqual({ token: other.jwt, cache: JSON.stringify([mailbox.jwt, other.jwt]) });
  } finally {
    await deleteAddress(request, mailbox.jwt);
    await deleteAddress(request, other.jwt);
  }
});
