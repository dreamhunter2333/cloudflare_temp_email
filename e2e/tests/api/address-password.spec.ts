import { test, expect } from '@playwright/test';
import { WORKER_URL, createTestAddress, deleteAddress } from '../../fixtures/test-helpers';

test.describe('Address Password Login', () => {
  test('set password then login with it', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'pwd-login');

    try {
      // Set a password on the address
      const changePwdRes = await request.post(`${WORKER_URL}/api/address_change_password`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: { new_password: 'test-password-123' },
      });
      expect(changePwdRes.ok()).toBe(true);
      const changePwdBody = await changePwdRes.json();
      expect(changePwdBody.success).toBe(true);

      // Login with the correct password
      const loginRes = await request.post(`${WORKER_URL}/api/address_login`, {
        data: { email: address, password: 'test-password-123' },
      });
      expect(loginRes.ok()).toBe(true);
      const loginBody = await loginRes.json();
      expect(loginBody.jwt).toBeTruthy();
      expect(loginBody.address).toBe(address);

      // The new JWT should work — verify by fetching settings
      const settingsRes = await request.get(`${WORKER_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${loginBody.jwt}` },
      });
      expect(settingsRes.ok()).toBe(true);
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('login with wrong password returns 401', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'pwd-wrong');

    try {
      // Set a password
      const changePwdRes = await request.post(`${WORKER_URL}/api/address_change_password`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: { new_password: 'correct-password' },
      });
      expect(changePwdRes.ok()).toBe(true);

      // Login with wrong password
      const loginRes = await request.post(`${WORKER_URL}/api/address_login`, {
        data: { email: address, password: 'wrong-password' },
      });
      expect(loginRes.status()).toBe(401);
    } finally {
      await deleteAddress(request, jwt);
    }
  });
});
