import { expect, test } from '@playwright/test';
import { sign } from 'hono/jwt';

import { FRONTEND_URL, WORKER_URL, createTestAddress, deleteAddress, hashPassword } from '../../fixtures/test-helpers';

for (const mode of ['default', 'password-only', 'password-disabled']) {
  test(`mailbox creation and password controls: ${mode}`, async ({ page, request }) => {
    const headers = mode === 'default' ? {} : { 'x-test-address-password-mode': mode };
    const passwordOnly = mode === 'password-only';
    let jwt = '';
    try {
      await page.setExtraHTTPHeaders(headers);
      await page.goto(`${FRONTEND_URL}/en/`);
      await page.getByRole('button', { name: 'Create Email Address', exact: true }).click();
      const form = page.locator('.n-tab-pane:visible form');
      await form.locator('.n-input-group .n-input input').fill(`passwordui${Date.now()}`);
      const createdResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/new_address');
      await form.getByRole('button', { name: 'Create Email Address', exact: true }).click();
      const created = await createdResponse;
      expect(created.ok()).toBe(true);
      const mailbox = await created.json();
      jwt = mailbox.jwt;
      const modal = page.locator('.n-modal');
      await expect(modal.getByTestId('address-credential-address')).toHaveText(mailbox.address);
      if (mode === 'password-disabled') {
        await expect(modal.getByTestId('address-credential-password')).toHaveCount(0);
      } else {
        expect(mailbox.password).toEqual(expect.any(String));
        expect(mailbox.password).not.toBe('');
        await expect(modal.getByTestId('address-credential-password')).toHaveText(mailbox.password);
      }
      await expect(modal.getByTestId('address-credential-jwt')).toHaveCount(passwordOnly ? 0 : 1);
      await expect(modal.locator('.credential-collapse')).toHaveCount(passwordOnly ? 0 : 1);
      await page.keyboard.press('Escape');
      await page.locator('.n-tabs-tab').getByText('Mailbox Settings', { exact: true }).click();
      await expect(page.getByRole('button', { name: 'Credentials & Connection Methods', exact: true })).toHaveCount(passwordOnly ? 0 : 1);
      const changePassword = page.getByRole('button', { name: 'Change Mailbox Password', exact: true });
      if (mode === 'password-disabled') {
        await expect(changePassword).toHaveCount(0);
        return;
      }
      await expect(changePassword).toBeVisible();
      if (!passwordOnly) return;
      await changePassword.click();
      const password = 'updated-mailbox-ui-password';
      await modal.locator('input[type="password"]').nth(0).fill(password);
      await modal.locator('input[type="password"]').nth(1).fill(password);
      const changedResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/address_change_password');
      await modal.getByRole('button', { name: 'Change Mailbox Password', exact: true }).click();
      expect((await changedResponse).ok()).toBe(true);
      const login = await request.post(`${WORKER_URL}/api/address_login`, {
        headers, data: { email: mailbox.address, password: hashPassword(password) },
      });
      expect(login.ok()).toBe(true);
    } finally {
      if (jwt) await deleteAddress(request, jwt);
    }
  });
}

test('historical mailbox cache keeps both login methods through renewal and password-only mode', async ({ page, request }, testInfo) => {
  const mailbox = await createTestAddress(request, 'cached-login');
  const other = await createTestAddress(request, 'cached-other');
  const now = Math.floor(Date.now() / 1000);
  const passwordToken = await sign({
    address: mailbox.address, address_id: mailbox.address_id, type: 'address_password_login',
    iat: now - 24 * 86400, exp: now + 6 * 86400,
  }, 'e2e-test-secret-key', 'HS256');
  const supersededPasswordToken = await sign({
    address: mailbox.address, address_id: mailbox.address_id, type: 'address_password_login',
    iat: now - 25 * 86400, exp: now + 5 * 86400,
  }, 'e2e-test-secret-key', 'HS256');
  const readCache = () => page.evaluate(() => JSON.parse(localStorage.getItem('LocalAddressCache') || '[]'));
  try {
    await page.goto(`${FRONTEND_URL}/en/`);
    await page.evaluate(cache => localStorage.setItem('LocalAddressCache', JSON.stringify(cache)), [
      mailbox.jwt, passwordToken, other.jwt,
      supersededPasswordToken,
    ]);
    await page.goto(`${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`);
    await expect(page.locator('.address-select')).toContainText(mailbox.address);
    await expect.poll(readCache).toEqual([
      mailbox.jwt, passwordToken, other.jwt,
      supersededPasswordToken,
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
      mailbox.jwt, expect.any(String), other.jwt,
    ]);
    const renewedToken = await page.evaluate(() => localStorage.getItem('jwt'));
    expect(renewedToken).not.toBe(mailbox.jwt);
    expect((await readCache())[1]).toBe(renewedToken);
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
      mailbox.jwt, renewedToken, other.jwt,
    ]);

    await page.evaluate(cache => {
      const oldValue = localStorage.getItem('LocalAddressCache');
      const newValue = JSON.stringify(cache);
      localStorage.setItem('LocalAddressCache', newValue);
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'LocalAddressCache', oldValue, newValue, storageArea: localStorage,
      }));
    }, [renewedToken, other.jwt]);
    await page.locator('.address-select').click();
    await expect(options.getByText(`${mailbox.address} (Credential Login)`, { exact: true })).toHaveCount(0);
    await expect(options.getByText(`${mailbox.address} (Password Login)`, { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.evaluate(cache => localStorage.setItem('LocalAddressCache', JSON.stringify(cache)), [mailbox.jwt, renewedToken, other.jwt]);
    await page.setExtraHTTPHeaders({ 'x-test-address-password-mode': 'password-only' });
    await page.goto(`${FRONTEND_URL}/en/?jwt=${renewedToken}`);
    await expect(page.locator('.address-select')).toContainText('Password Login');
    await page.locator('.address-select').click();
    const passwordOptions = page.locator('.n-base-select-menu:visible');
    await expect(passwordOptions).toContainText('Password Login');
    await expect(passwordOptions).not.toContainText('Credential Login');
    await page.keyboard.press('Escape');
    await page.locator('.address-manage').click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Password Login');
    await testInfo.attach('Password-only mailbox cache', {
      body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png',
    });
    expect(await readCache()).toHaveLength(3);
    await page.keyboard.press('Escape');
    await page.evaluate(() => localStorage.setItem('jwt', ''));
    await page.reload();
    await expect(page.getByRole('button', { name: 'Credential Login', exact: true })).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toBeVisible();

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

test('an uncached current mailbox remains visible when settings fail', async ({ page, request }) => {
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
    }))).toEqual({ token: other.jwt, cache });
  } finally {
    await deleteAddress(request, mailbox.jwt);
    await deleteAddress(request, other.jwt);
  }
});
