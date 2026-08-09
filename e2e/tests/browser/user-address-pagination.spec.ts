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

      const initialMailboxAddressesResponse = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return url.pathname === '/user_api/bind_address'
          && url.searchParams.get('limit') === '100';
      });
      await page.getByText('Mail Box', { exact: true }).click();
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
