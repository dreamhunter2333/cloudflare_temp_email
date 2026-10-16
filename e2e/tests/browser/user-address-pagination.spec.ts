import { expect, request as apiRequest, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

import {
  FRONTEND_URL,
  WORKER_URL,
  createTestAddress,
  deleteAddress,
  hashPassword,
} from '../../fixtures/test-helpers';

async function saveUserSettings(request: APIRequestContext, settings: Record<string, unknown>) {
  const response = await request.post(`${WORKER_URL}/admin/user_settings`, { data: settings });
  expect(response.ok()).toBe(true);
}

async function createUser(request: APIRequestContext) {
  const email = `address-browser-${Date.now()}@test.example.com`;
  const password = hashPassword('test-password-123');
  const registerResponse = await request.post(`${WORKER_URL}/user_api/register`, {
    data: { email, password },
  });
  expect(registerResponse.ok()).toBe(true);

  const loginResponse = await request.post(`${WORKER_URL}/user_api/login`, {
    data: { email, password },
  });
  expect(loginResponse.ok()).toBe(true);
  const { jwt } = await loginResponse.json();
  const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
  return { email, jwt, userId: payload.user_id as number };
}

async function bindAddress(request: APIRequestContext, userJwt: string, addressJwt: string) {
  const response = await request.post(`${WORKER_URL}/user_api/bind_address`, {
    headers: {
      Authorization: `Bearer ${addressJwt}`,
      'x-user-token': userJwt,
    },
  });
  expect(response.ok()).toBe(true);
}

test('bound mailbox password form validates, preserves failed input and clears on close or success', async ({ page, request }) => {
  const originalSettingsResponse = await request.get(`${WORKER_URL}/admin/user_settings`);
  expect(originalSettingsResponse.ok()).toBe(true);
  const originalSettings = await originalSettingsResponse.json();
  const mailbox = await createTestAddress(request, 'browser-reset');
  let userId: number | undefined;
  try {
    await saveUserSettings(request, { ...originalSettings, enable: true, enableMailVerify: false });
    const user = await createUser(request);
    userId = user.userId;
    await bindAddress(request, user.jwt, mailbox.jwt);
    await page.setExtraHTTPHeaders({ 'x-test-address-password-mode': 'password-only' });
    await page.goto(`${FRONTEND_URL}/en/`);
    await page.evaluate(jwt => localStorage.setItem('userJwt', jwt), user.jwt);
    await page.goto(`${FRONTEND_URL}/en/user`);
    const row = page.locator('.n-data-table-tr').filter({ hasText: mailbox.address });
    const resetButton = row.getByRole('button', { name: 'Reset Password', exact: true });
    await resetButton.click();
    const dialog = page.locator('.n-dialog[role="dialog"]');
    const inputs = dialog.locator('input[type="password"]');
    const submit = dialog.getByRole('button', { name: 'Reset Password', exact: true });
    await expect(dialog).toContainText(mailbox.address);
    await submit.click();
    await expect(page.getByText('Enter a new password.', { exact: true })).toBeVisible();
    await inputs.nth(0).fill('discard-me');
    await inputs.nth(1).fill('different');
    await submit.click();
    await expect(page.getByText('Passwords do not match', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await resetButton.click();
    await expect(inputs.nth(0)).toHaveValue('');
    await expect(inputs.nth(1)).toHaveValue('');

    const password = 'browser-replacement-password';
    await inputs.nth(0).fill(password);
    await inputs.nth(1).fill(password);
    const resetPath = `**/user_api/address/${mailbox.address_id}/reset_password`;
    await page.route(resetPath, route => route.fulfill({ status: 503, body: 'Reset temporarily unavailable' }));
    await submit.click();
    await expect(page.getByText('[503]: Reset temporarily unavailable', { exact: true })).toBeVisible();
    await expect(inputs.nth(0)).toHaveValue(password);
    await expect(inputs.nth(1)).toHaveValue(password);
    await page.unroute(resetPath);
    const resetResponse = page.waitForResponse(response => response.url().endsWith(`/address/${mailbox.address_id}/reset_password`));
    await submit.click();
    const response = await resetResponse;
    expect(response.request().postDataJSON()).toEqual({ new_password: hashPassword(password) });
    expect(response.ok()).toBe(true);
    await expect(dialog).toBeHidden();
    const login = await request.post(`${WORKER_URL}/api/address_login`, {
      headers: { 'x-test-address-password-mode': 'password-only' },
      data: { email: mailbox.address, password: hashPassword(password) },
    });
    expect(login.ok()).toBe(true);
    await resetButton.click();
    await expect(inputs.nth(0)).toHaveValue('');
    await expect(inputs.nth(1)).toHaveValue('');
  } finally {
    await deleteAddress(request, mailbox.jwt);
    if (userId !== undefined) await request.delete(`${WORKER_URL}/admin/users/${userId}`);
    await saveUserSettings(request, originalSettings);
  }
});

test.describe('User address pagination browser flow', () => {
  test('paginates addresses and filters mail', async ({ page }) => {
    test.setTimeout(120_000);

    const request = await apiRequest.newContext();
    const createdAddresses: Awaited<ReturnType<typeof createTestAddress>>[] = [];
    let originalUserSettings: Record<string, unknown> | undefined;
    let userId: number | undefined;

    try {
      const settingsResponse = await request.get(`${WORKER_URL}/admin/user_settings`);
      expect(settingsResponse.ok()).toBe(true);
      originalUserSettings = await settingsResponse.json();
      await saveUserSettings(request, {
        ...originalUserSettings,
        enable: true,
        enableMailVerify: false,
        maxAddressCount: 0,
      });

      const user = await createUser(request);
      userId = user.userId;

      for (let index = 0; index < 21; index += 1) {
        const address = await createTestAddress(request, `browser-page-${index}-`);
        createdAddresses.push(address);
        await bindAddress(request, user.jwt, address.jwt);
      }
      const defaultAddressPageResponse = await request.get(
        `${WORKER_URL}/user_api/bind_address`,
        { headers: { 'x-user-token': user.jwt } },
      );
      expect(defaultAddressPageResponse.ok()).toBe(true);
      const defaultAddressPage = await defaultAddressPageResponse.json();
      expect(defaultAddressPage.count).toBe(21);
      expect(defaultAddressPage.results).toHaveLength(20);

      await page.goto(`${FRONTEND_URL}/en/`);
      await page.evaluate((userJwt) => {
        localStorage.setItem('userJwt', userJwt);
      }, user.jwt);
      await page.goto(`${FRONTEND_URL}/en/user`);

      await expect(page.getByText(user.email)).toBeVisible({ timeout: 15_000 });
      const pagination = page.locator('.n-pagination').first();
      const addressRows = page.locator('.n-data-table-tbody .n-data-table-tr');
      await expect(pagination).toContainText(/Total:\s*21/);
      await expect(addressRows).toHaveCount(20);

      await pagination.locator('.n-pagination-item').filter({ hasText: /^2$/ }).click();
      await expect(addressRows).toHaveCount(1);

      const selectedAddress = createdAddresses[20];

      const addressSearch = page.getByTestId('user-address-search').locator('input');
      await addressSearch.fill(selectedAddress.address);
      await addressSearch.press('Enter');
      await expect(pagination).toContainText(/Total:\s*1/);
      await expect(addressRows).toHaveCount(1);
      await expect(addressRows.first()).toContainText(selectedAddress.address);

      await addressSearch.fill('');
      await addressSearch.press('Enter');
      await expect(pagination).toContainText(/Total:\s*21/);
      await expect(addressRows).toHaveCount(20);

      const initialMailboxAddressesResponse = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return url.pathname === '/user_api/bind_address'
          && url.searchParams.get('limit') === '100';
      });
      await page.getByText('Inbox', { exact: true }).click();
      const initialMailboxResponse = await initialMailboxAddressesResponse;
      expect(initialMailboxResponse.ok()).toBe(true);
      const mailboxAddressSelect = page.locator('.n-input-group .n-select').first();
      await mailboxAddressSelect.click();

      const mailboxOptions = page.locator('.n-base-select-menu:visible');
      await expect(mailboxOptions).toContainText(selectedAddress.address);
      const filteredMailResponse = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return url.pathname === '/user_api/mails'
          && url.searchParams.get('address') === selectedAddress.address;
      });
      await mailboxOptions.getByText(selectedAddress.address, { exact: true }).click();
      expect((await filteredMailResponse).ok()).toBe(true);
    } finally {
      try {
        try {
          await Promise.allSettled(createdAddresses.map((address) => deleteAddress(request, address.jwt)));
          if (userId !== undefined) {
            await request.delete(`${WORKER_URL}/admin/users/${userId}`);
          }
        } finally {
          if (originalUserSettings) {
            await saveUserSettings(request, originalUserSettings);
          }
        }
      } finally {
        await request.dispose();
      }
    }
  });
});
