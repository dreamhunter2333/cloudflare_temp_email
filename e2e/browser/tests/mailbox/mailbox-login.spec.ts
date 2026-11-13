import { expect, test, type Page } from '@playwright/test';
import { sign, verify } from 'hono/jwt';

import { FRONTEND_URL, WORKER_URL, createTestAddress, deleteAddress, hashPassword } from '../../../fixtures/test-helpers';

async function openPasswordOnlyMailbox(page: Page, token: string) {
  // Load the Worker settings before the selector reads the local credential cache.
  await page.route('**/api/settings', async route => {
    await page.waitForFunction(async () => {
      const storeModule = '/src/store/index.js';
      const { useGlobalState } = await import(storeModule);
      return useGlobalState().openSettings.value.addressPasswordLoginOnly;
    });
    await route.continue();
  }, { times: 1 });
  await page.goto(`${FRONTEND_URL}/en/?jwt=${token}`);
}

for (const mode of ['default', 'password-only', 'password-disabled']) {
  test(`mailbox creation and password controls: ${mode}`, async ({ page, request }, testInfo) => {
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
      await expect(modal.getByTestId('address-credential-jwt')).toHaveText(jwt);
      await expect(modal.locator('.credential-collapse')).toHaveCount(1);
      const expiry = modal.getByTestId('address-token-expires-at');
      if (passwordOnly) {
        const payload = await verify(jwt, 'e2e-test-secret-key', 'HS256');
        await expect(modal.getByRole('heading', { name: 'Session Token', exact: true })).toBeVisible();
        await expect(expiry).toHaveAttribute('datetime', new Date(Number(payload.exp) * 1000).toISOString());
        await expect(expiry).toHaveText(/\d/);
        await expect(modal.getByText('This token expires at the time shown above.', { exact: false })).toBeVisible();
        await testInfo.attach('Session token expiry', {
          body: await page.screenshot({
            animations: 'disabled', mask: [modal.getByTestId('address-credential-jwt'), modal.getByTestId('address-credential-password')],
          }), contentType: 'image/png',
        });
      } else {
        await expect(expiry).toHaveCount(0);
      }
      await page.keyboard.press('Escape');
      await page.locator('.n-tabs-tab').getByText('Mailbox Settings', { exact: true }).click();
      const showToken = page.getByRole('button', {
        name: passwordOnly ? 'View Session Token' : 'Credentials & Connection Methods', exact: true,
      });
      await expect(showToken).toBeVisible();
      if (passwordOnly) {
        await showToken.click();
        await expect(modal.getByTestId('address-credential-jwt')).toHaveText(jwt);
        await expect(expiry).toBeVisible();
        await page.keyboard.press('Escape');
      }
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
      const legacyToken = await sign({ address: mailbox.address, address_id: mailbox.address_id }, 'e2e-test-secret-key', 'HS256');
      await openPasswordOnlyMailbox(page, legacyToken);
      await expect(page.locator('.address-select')).toContainText(mailbox.address);
      await page.locator('.address-select').click();
      await expect(page.locator('.n-base-select-menu:visible')).not.toContainText('Credential Login');
      await page.keyboard.press('Escape');
      await page.evaluate(() => localStorage.setItem('useSimpleIndex', 'true'));
      await page.goto(`${FRONTEND_URL}/en/?jwt=${jwt}`);
      await page.getByRole('button', { name: 'Mailbox Settings', exact: true }).click();
      await page.getByRole('button', { name: 'View Session Token', exact: true }).click();
      await expect(modal.getByTestId('address-credential-jwt')).toHaveText(jwt);
      const payload = await verify(jwt, 'e2e-test-secret-key', 'HS256');
      await expect(expiry).toHaveAttribute('datetime', new Date(Number(payload.exp) * 1000).toISOString());
      await expect(modal.getByRole('heading', { name: 'Session Token', exact: true })).toBeVisible();
    } finally {
      if (jwt) await deleteAddress(request, jwt);
    }
  });
}

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
    await page.addInitScript(cache => {
      if (localStorage.getItem('LocalAddressCache') === null) {
        localStorage.setItem('LocalAddressCache', JSON.stringify(cache));
      }
    }, [mailbox.jwt, passwordToken, other.jwt, expiredPasswordToken]);
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
    const passwordOptions = page.locator('.n-base-select-menu:visible .n-base-select-option')
      .filter({ hasText: mailbox.address })
      .filter({ has: page.locator('.n-tag').getByText('Password Login', { exact: true }) });
    await passwordOptions.first().click();
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
    expect(await settings.json()).toMatchObject({ address: mailbox.address });
    const renewedPayload = await verify(renewedToken, 'e2e-test-secret-key', 'HS256');
    expect(Number(renewedPayload.exp) - Number(renewedPayload.iat)).toBe(30 * 86400);

    await page.locator('.address-manage').click();
    const rows = page.locator('.n-modal .n-data-table-tbody .n-data-table-tr');
    await expect(rows).toHaveCount(5);
    await expect(page.locator('.n-modal').getByRole('columnheader', { name: 'Login Method', exact: true })).toBeVisible();
    await expect(rows.nth(0).getByRole('cell').nth(0)).toHaveText(mailbox.address);
    await expect(rows.nth(0).getByRole('cell').nth(1)).toHaveText('Credential Login');
    await expect(rows.nth(1).getByRole('cell').nth(0)).toHaveText(mailbox.address);
    await expect(rows.nth(1).getByRole('cell').nth(1)).toHaveText('Password Login');
    await expect(rows.nth(2).getByRole('cell').nth(0)).toHaveText(other.address);
    await expect(rows.nth(2).getByRole('cell').nth(1)).toHaveText('Credential Login');
    expect(settingsTokens).toEqual([`Bearer ${passwordToken}`]);
    await testInfo.attach('Mailbox cache login methods', {
      body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png',
    });
    await page.keyboard.press('Escape');
    await page.locator('.address-select').click();
    const options = page.locator('.n-base-select-menu:visible');
    await expect(options).toContainText('Credential Login');
    await expect(options).toContainText('Password Login');
    await expect(options.locator('.n-tag').filter({ hasText: 'Password Login' }).first()).toBeInViewport({ ratio: 1 });
    await testInfo.attach('Mailbox selector login-method tags', {
      body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png',
    });
    await options.locator('.n-base-select-option').filter({ hasText: other.address }).click();
    await expect.poll(readCache).toEqual([
      mailbox.jwt, passwordToken, other.jwt, expiredPasswordToken, renewedToken,
    ]);

    await page.locator('.address-select').click();
    const expiredSettings = page.waitForResponse(response =>
      new URL(response.url()).pathname === '/api/settings'
      && response.request().headers().authorization === `Bearer ${expiredPasswordToken}`);
    await passwordOptions.nth(1).click();
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

    const historicalCache = await readCache();
    await page.setExtraHTTPHeaders({ 'x-test-address-password-mode': 'password-only' });
    await openPasswordOnlyMailbox(page, renewedToken);
    await expect(page.locator('.address-select')).toContainText(mailbox.address);
    await expect(page.locator('.address-select .n-tag')).toHaveCount(0);
    await page.locator('.address-select').click();
    const passwordOnlyOptions = page.locator('.n-base-select-menu:visible');
    await expect(passwordOnlyOptions.locator('.n-base-select-option')).toHaveCount(historicalCache.length - 2);
    await expect(passwordOnlyOptions.locator('.n-tag')).toHaveCount(0);
    await expect(passwordOnlyOptions).not.toContainText('Credential Login');
    await page.keyboard.press('Escape');
    await page.locator('.address-manage').click();
    await expect(rows).toHaveCount(historicalCache.length);
    const legacyRows = rows.filter({ hasText: 'Credential Login' });
    await expect(legacyRows).toHaveCount(2);
    await expect(legacyRows.getByRole('button', { name: 'Change Mail Address', exact: true })).toHaveCount(0);
    await expect(rows.filter({ hasText: 'Password Login' }).first()).toContainText(mailbox.address);
    await testInfo.attach('Password-only mailbox cache', {
      body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png',
    });
    expect(await readCache()).toEqual(historicalCache);
    await legacyRows.filter({ hasText: other.address }).getByRole('button', { name: 'Unbind Mail Address credential', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect.poll(readCache).toEqual(historicalCache.filter(token => token !== other.jwt));
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

test('login method hints hide when either token type is alone', async ({ page, request }, testInfo) => {
  const mailbox = await createTestAddress(request, 'method-visibility');
  const now = Math.floor(Date.now() / 1000);
  const passwordToken = await sign({
    address: mailbox.address, address_id: mailbox.address_id, type: 'address_password_login',
    iat: now, exp: now + 30 * 86400,
  }, 'e2e-test-secret-key', 'HS256');
  try {
    await page.goto(`${FRONTEND_URL}/en/`);
    await page.evaluate(({ credential, password }) => {
      localStorage.setItem('jwt', password);
      localStorage.setItem('LocalAddressCache', JSON.stringify([credential, password]));
    }, { credential: mailbox.jwt, password: passwordToken });
    await page.reload();
    await expect(page.locator('.address-select')).toContainText('Password Login');
    await page.locator('.address-select').click();
    const options = page.locator('.n-base-select-menu:visible');
    await expect(options.locator('.n-tag')).toHaveCount(2);
    await page.keyboard.press('Escape');
    await page.locator('.address-manage').click();
    const modal = page.locator('.n-modal');
    const methodColumn = modal.getByRole('columnheader', { name: 'Login Method', exact: true });
    await expect(methodColumn).toBeVisible();
    await modal.locator('.n-data-table-tr').filter({ hasText: 'Credential Login' })
      .getByRole('button', { name: 'Unbind Mail Address credential', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(methodColumn).toHaveCount(0);
    await testInfo.attach('Single token type hides the login method column', {
      body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png',
    });
    await page.keyboard.press('Escape');
    await expect(page.locator('.address-select .n-tag')).toHaveCount(0);
    await page.locator('.address-select').click();
    await expect(options.locator('.n-base-select-option')).toHaveCount(1);
    await expect(options.locator('.n-tag')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.evaluate(token => {
      localStorage.setItem('jwt', token);
      localStorage.setItem('LocalAddressCache', JSON.stringify([token]));
    }, mailbox.jwt);
    await page.reload();
    await expect(page.locator('.address-select')).toContainText(mailbox.address);
    await expect(page.locator('.address-select .n-tag')).toHaveCount(0);
    await page.locator('.address-select').click();
    await expect(options.locator('.n-tag')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.locator('.address-manage').click();
    await expect(methodColumn).toHaveCount(0);
  } finally {
    await deleteAddress(request, mailbox.jwt);
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

for (const sessionChange of ['cleared', 'changed']) {
  test(`pending renewal preserves a ${sessionChange} active session`, async ({ page, request }) => {
    const mailbox = await createTestAddress(request, 'pending-renewal');
    const other = await createTestAddress(request, 'new-session');
    const now = Math.floor(Date.now() / 1000);
    const token = await sign({
      address: mailbox.address, address_id: mailbox.address_id, type: 'address_password_login',
      iat: now - 24 * 86400, exp: now + 6 * 86400,
    }, 'e2e-test-secret-key', 'HS256');
    let releaseSettings: () => void;
    const pendingSettings = new Promise<void>(resolve => { releaseSettings = resolve; });
    try {
      await page.route('**/api/settings', async route => {
        const response = await route.fetch();
        await pendingSettings;
        await route.fulfill({ response });
      });
      const settingsRequest = page.waitForRequest(request =>
        new URL(request.url()).pathname === '/api/settings'
        && request.headers().authorization === `Bearer ${token}`);
      await page.goto(`${FRONTEND_URL}/en/?jwt=${token}`);
      await settingsRequest;
      const nextToken = sessionChange === 'cleared' ? '' : other.jwt;
      await page.evaluate(nextToken => {
        const oldValue = localStorage.getItem('jwt');
        localStorage.setItem('jwt', nextToken);
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'jwt', oldValue, newValue: nextToken, storageArea: localStorage,
        }));
      }, nextToken);
      releaseSettings();
      await expect(page.locator('.address-select')).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('jwt'))).toBe(nextToken);
    } finally {
      releaseSettings();
      await deleteAddress(request, mailbox.jwt);
      await deleteAddress(request, other.jwt);
    }
  });
}

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
