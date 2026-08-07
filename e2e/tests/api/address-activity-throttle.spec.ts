import { test, expect } from '@playwright/test';
import {
  WORKER_URL,
  createTestAddress,
  deleteAddress,
  hashPassword,
} from '../../fixtures/test-helpers';

const waitForNextTimestamp = () => new Promise((resolve) => setTimeout(resolve, 1_100));

test.describe('Address activity throttling', () => {
  test('does not rewrite recently active addresses from user settings', async ({ request }) => {
    const email = `activity-throttle-${Date.now()}@test.example.com`;
    const password = hashPassword('test-password-123');
    const address = await createTestAddress(request, 'activity-throttle');
    let userId: number | undefined;

    try {
      const settingsRes = await request.post(`${WORKER_URL}/admin/user_settings`, {
        data: { enable: true, enableMailVerify: false },
      });
      expect(settingsRes.ok()).toBe(true);

      const registerRes = await request.post(`${WORKER_URL}/user_api/register`, {
        data: { email, password },
      });
      expect(registerRes.ok()).toBe(true);

      const loginRes = await request.post(`${WORKER_URL}/user_api/login`, {
        data: { email, password },
      });
      expect(loginRes.ok()).toBe(true);
      const { jwt: userJwt } = await loginRes.json();
      const payload = JSON.parse(Buffer.from(userJwt.split('.')[1], 'base64url').toString('utf8'));
      userId = payload.user_id;

      const bindRes = await request.post(`${WORKER_URL}/user_api/bind_address`, {
        headers: {
          Authorization: `Bearer ${address.jwt}`,
          'x-user-token': userJwt,
        },
      });
      expect(bindRes.ok()).toBe(true);

      const beforeRes = await request.get(`${WORKER_URL}/user_api/bind_address`, {
        headers: { 'x-user-token': userJwt },
      });
      expect(beforeRes.ok()).toBe(true);
      const before = await beforeRes.json();
      const initialUpdatedAt = before.results.find(
        (row: { name: string }) => row.name === address.address,
      )?.updated_at;
      expect(initialUpdatedAt).toBeTruthy();

      await waitForNextTimestamp();
      const userSettingsRes = await request.get(`${WORKER_URL}/user_api/settings`, {
        headers: { 'x-user-token': userJwt },
      });
      expect(userSettingsRes.ok()).toBe(true);
      await waitForNextTimestamp();

      const afterRes = await request.get(`${WORKER_URL}/user_api/bind_address`, {
        headers: { 'x-user-token': userJwt },
      });
      expect(afterRes.ok()).toBe(true);
      const after = await afterRes.json();
      const updatedAt = after.results.find(
        (row: { name: string }) => row.name === address.address,
      )?.updated_at;
      expect(updatedAt).toBe(initialUpdatedAt);
    } finally {
      await deleteAddress(request, address.jwt);
      if (userId) {
        const deleteUserRes = await request.delete(`${WORKER_URL}/admin/users/${userId}`);
        expect(deleteUserRes.ok()).toBe(true);
      }
    }
  });
});
