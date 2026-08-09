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
  test('paginates, searches, filters mail, and excludes unmatched local addresses', async ({ page }) => {
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
      const localOnlyAddress = await createTestAddress(request, 'browser-local-');
      createdAddresses.push(localOnlyAddress);

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

      const searchedAddress = createdAddresses[7];
      await page.getByPlaceholder('Search bound addresses').fill(searchedAddress.address);
      await page.getByRole('button', { name: 'Query', exact: true }).click();
      await expect(addressRows).toHaveCount(1);
      await expect(addressRows.first()).toContainText(searchedAddress.address);

      const initialMailboxAddressesResponse = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return url.pathname === '/user_api/bind_address'
          && !url.searchParams.has('query')
          && url.searchParams.get('with_total') === 'false';
      });
      await page.getByText('Mail Box', { exact: true }).click();
      const initialMailboxResponse = await initialMailboxAddressesResponse;
      expect(initialMailboxResponse.ok()).toBe(true);
      const mailboxAddressSelect = page.getByTestId('user-mail-address-filter');
      const mailboxAddressInput = mailboxAddressSelect.locator('input');
      await mailboxAddressSelect.click();
      const [mailboxSearchResponse] = await Promise.all([
        page.waitForResponse((response) => {
          const url = new URL(response.url());
          return url.pathname === '/user_api/bind_address'
            && url.searchParams.get('query') === searchedAddress.address;
        }),
        mailboxAddressInput.pressSequentially(searchedAddress.address),
      ]);
      expect(mailboxSearchResponse.ok()).toBe(true);

      const mailboxOptions = page.locator('.n-base-select-menu:visible');
      await expect(mailboxOptions).toContainText(searchedAddress.address);
      const filteredMailResponse = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return url.pathname === '/user_api/mails'
          && url.searchParams.get('address') === searchedAddress.address;
      });
      await mailboxOptions.getByText(searchedAddress.address, { exact: true }).click();
      expect((await filteredMailResponse).ok()).toBe(true);

      await page.evaluate((localJwt) => {
        localStorage.setItem('LocalAddressCache', JSON.stringify([localJwt]));
      }, localOnlyAddress.jwt);
      const initialAddressOptionsResponse = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return url.pathname === '/user_api/bind_address'
          && !url.searchParams.has('query')
          && url.searchParams.get('with_total') === 'false';
      });
      await page.goto(`${FRONTEND_URL}/en/?jwt=${encodeURIComponent(createdAddresses[0].jwt)}`);
      expect((await initialAddressOptionsResponse).ok()).toBe(true);

      const addressSelect = page.locator('.address-select');
      await expect(addressSelect).toBeVisible({ timeout: 15_000 });
      await addressSelect.click();
      const [addressSearchResponse] = await Promise.all([
        page.waitForResponse((response) => {
          const url = new URL(response.url());
          return url.pathname === '/user_api/bind_address'
            && url.searchParams.get('query') === searchedAddress.address;
        }),
        addressSelect.locator('input').pressSequentially(searchedAddress.address),
      ]);
      expect(addressSearchResponse.ok()).toBe(true);

      const addressOptions = page.locator('.n-base-select-menu:visible');
      await expect(addressOptions).toContainText('User Addresses');
      await expect(addressOptions).toContainText(searchedAddress.address.split('@')[0]);
      await expect(addressOptions).not.toContainText('Local Addresses');
      await expect(addressOptions).not.toContainText(localOnlyAddress.address.split('@')[0]);
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
