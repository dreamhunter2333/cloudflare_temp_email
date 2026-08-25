import { expect, request as apiRequest, test, type APIRequestContext } from '@playwright/test';

import {
  FRONTEND_URL,
  WORKER_URL,
  createTestAddress,
  deleteAddress,
  hashPassword,
} from '../../fixtures/test-helpers';

async function createUser(request: APIRequestContext) {
  const email = `user-send-browser-${Date.now()}@test.example.com`;
  const password = hashPassword('test-password-123');
  const registerRes = await request.post(`${WORKER_URL}/user_api/register`, {
    data: { email, password },
  });
  expect(registerRes.ok()).toBe(true);

  const loginRes = await request.post(`${WORKER_URL}/user_api/login`, {
    data: { email, password },
  });
  expect(loginRes.ok()).toBe(true);
  const { jwt } = await loginRes.json();
  const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
  return { email, jwt, userId: payload.user_id as number };
}

test.describe('User send mail page', () => {
  test('selects a bound address, sends mail, and opens its sent items', async ({ page }) => {
    const request = await apiRequest.newContext();
    const addresses: Awaited<ReturnType<typeof createTestAddress>>[] = [];
    let userId: number | undefined;
    let originalUserSettings: Record<string, unknown> | undefined;

    try {
      const settingsRes = await request.get(`${WORKER_URL}/admin/user_settings`);
      expect(settingsRes.ok()).toBe(true);
      originalUserSettings = await settingsRes.json();
      const enableUserRes = await request.post(`${WORKER_URL}/admin/user_settings`, {
        data: {
          ...originalUserSettings,
          enable: true,
          enableMailVerify: false,
          maxAddressCount: 0,
        },
      });
      expect(enableUserRes.ok()).toBe(true);

      const user = await createUser(request);
      userId = user.userId;
      const address = await createTestAddress(request, 'usr-browser-');
      const secondAddress = await createTestAddress(request, 'usr-second-');
      addresses.push(address, secondAddress);
      for (const boundAddress of addresses) {
        const bindRes = await request.post(`${WORKER_URL}/user_api/bind_address`, {
          headers: {
            Authorization: `Bearer ${boundAddress.jwt}`,
            'x-user-token': user.jwt,
          },
        });
        expect(bindRes.ok()).toBe(true);
      }

      await page.goto(`${FRONTEND_URL}/en/`);
      await page.evaluate((userJwt) => {
        localStorage.setItem('userJwt', userJwt);
      }, user.jwt);
      await page.goto(`${FRONTEND_URL}/en/user`);

      await expect(page.getByText(user.email)).toBeVisible({ timeout: 15_000 });
      const credentialResponse = page.waitForResponse((response) => (
        response.request().method() === 'GET'
        && new URL(response.url()).pathname
          === `/user_api/bind_address_jwt/${address.address_id}`
      ));
      const addressRow = page.getByRole('row').filter({ hasText: address.address });
      await addressRow.getByRole('button', { name: 'Address Credential' }).click();
      expect((await credentialResponse).ok()).toBe(true);
      await expect(page.getByRole('dialog')).toContainText(address.address);
      await page.getByRole('button', { name: 'close' }).click();

      const initialSettingsResponse = page.waitForResponse((response) => (
        new URL(response.url()).pathname
          === `/user_api/address/${secondAddress.address_id}/settings`
      ));
      await page.getByText('Send Mail', { exact: true }).click();
      expect((await initialSettingsResponse).ok()).toBe(true);
      await expect(page.locator('.composer-title h2')).toHaveText('Compose email');

      const settingsResponse = page.waitForResponse((response) => (
        new URL(response.url()).pathname
          === `/user_api/address/${address.address_id}/settings`
      ));
      await page.locator('.address-picker-select').click();
      await page.locator('.n-base-select-option').filter({ hasText: address.address }).click();
      expect((await settingsResponse).ok()).toBe(true);
      await expect(page.locator('.address-picker-select')).toContainText(address.address);

      const subject = `Browser user send ${Date.now()}`;
      await page.getByRole('textbox', { name: /^Recipient address/ })
        .fill('recipient@test.example.com');
      await page.getByRole('textbox', { name: /^Subject/ }).fill(subject);
      await page.locator('.compose-textarea textarea').fill('Sent from the user page');

      const sendResponse = page.waitForResponse((response) => (
        response.request().method() === 'POST'
        && new URL(response.url()).pathname
          === `/user_api/address/${address.address_id}/send_mail`
      ));
      const sendboxResponse = page.waitForResponse((response) => (
        response.request().method() === 'GET'
        && new URL(response.url()).pathname === '/user_api/sendbox'
      ));
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      expect((await sendResponse).ok()).toBe(true);
      expect((await sendboxResponse).ok()).toBe(true);

      await expect(page.locator('.n-tabs-tab--active')).toHaveText('Sent');
      await expect(page.locator('.n-thing-header__title').filter({ hasText: subject }))
        .toHaveText(subject, { timeout: 15_000 });
    } finally {
      try {
        await Promise.allSettled(addresses.map((address) => deleteAddress(request, address.jwt)));
        if (userId !== undefined) {
          await request.delete(`${WORKER_URL}/admin/users/${userId}`);
        }
      } finally {
        if (originalUserSettings) {
          await request.post(`${WORKER_URL}/admin/user_settings`, {
            data: originalUserSettings,
          });
        }
        await request.dispose();
      }
    }
  });
});
