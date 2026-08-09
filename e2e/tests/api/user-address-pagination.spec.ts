import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  WORKER_URL,
  createTestAddress,
  deleteAddress,
  hashPassword,
  seedTestMail,
} from '../../fixtures/test-helpers';

async function createUser(request: APIRequestContext) {
  const email = `address-page-${Date.now()}@test.example.com`;
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
  return { jwt, userId: payload.user_id as number };
}

test.describe('User address pagination', () => {
  test('paginates addresses and enforces mail ownership', async ({ request }) => {
    const addresses: Awaited<ReturnType<typeof createTestAddress>>[] = [];
    let outsider: Awaited<ReturnType<typeof createTestAddress>> | undefined;
    let originalUserSettings: Record<string, unknown> | undefined;
    let userId: number | undefined;

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
      const userJwt = user.jwt;
      userId = user.userId;
      addresses.push(...await Promise.all([
        createTestAddress(request, 'user-page-a'),
        createTestAddress(request, 'user-page-b'),
        createTestAddress(request, 'user-page-c'),
      ]));
      outsider = await createTestAddress(request, 'user-page-outsider');

      for (const item of addresses) {
        const bindRes = await request.post(`${WORKER_URL}/user_api/bind_address`, {
          headers: {
            Authorization: `Bearer ${item.jwt}`,
            'x-user-token': userJwt,
          },
        });
        expect(bindRes.ok()).toBe(true);
      }

      const defaultPageRes = await request.get(`${WORKER_URL}/user_api/bind_address`, {
        headers: { 'x-user-token': userJwt },
      });
      expect(defaultPageRes.ok()).toBe(true);
      const defaultPage = await defaultPageRes.json();
      expect(defaultPage.count).toBe(3);
      expect(defaultPage.results).toHaveLength(3);

      const firstPageRes = await request.get(
        `${WORKER_URL}/user_api/bind_address?limit=2&offset=0`,
        { headers: { 'x-user-token': userJwt } },
      );
      expect(firstPageRes.ok()).toBe(true);
      const firstPage = await firstPageRes.json();
      expect(firstPage.count).toBe(3);
      expect(firstPage.results).toHaveLength(2);
      expect(firstPage.results[0].mail_count).toBe(0);
      expect(firstPage.results[0].send_count).toBe(0);
      expect(firstPage.results[0]).toHaveProperty('source_meta');
      expect(firstPage.results[0]).not.toHaveProperty('password');

      const secondPageRes = await request.get(
        `${WORKER_URL}/user_api/bind_address?limit=2&offset=2`,
        { headers: { 'x-user-token': userJwt } },
      );
      expect(secondPageRes.ok()).toBe(true);
      const secondPage = await secondPageRes.json();
      expect(secondPage.count).toBe(0);
      expect(secondPage.results).toHaveLength(1);

      const invalidLimitRes = await request.get(
        `${WORKER_URL}/user_api/bind_address?limit=101&offset=0`,
        { headers: { 'x-user-token': userJwt } },
      );
      expect(invalidLimitRes.status()).toBe(400);

      const invalidOffsetRes = await request.get(
        `${WORKER_URL}/user_api/bind_address?limit=20&offset=-1`,
        { headers: { 'x-user-token': userJwt } },
      );
      expect(invalidOffsetRes.status()).toBe(400);

      await seedTestMail(request, addresses[0].address, { subject: 'Bound mail' });
      await seedTestMail(request, outsider.address, { subject: 'Outsider mail' });

      const userMailsRes = await request.get(`${WORKER_URL}/user_api/mails?limit=20&offset=0`, {
        headers: { 'x-user-token': userJwt },
      });
      expect(userMailsRes.ok()).toBe(true);
      const userMails = await userMailsRes.json();
      expect(userMails.count).toBe(1);
      expect(userMails.results[0].address).toBe(addresses[0].address);

      const filteredOutsiderMailsRes = await request.get(
        `${WORKER_URL}/user_api/mails?limit=20&offset=0&address=${encodeURIComponent(outsider.address)}`,
        { headers: { 'x-user-token': userJwt } },
      );
      expect(filteredOutsiderMailsRes.ok()).toBe(true);
      const filteredOutsiderMails = await filteredOutsiderMailsRes.json();
      expect(filteredOutsiderMails.count).toBe(0);
      expect(filteredOutsiderMails.results).toHaveLength(0);

      const outsiderMailsRes = await request.get(`${WORKER_URL}/api/mails?limit=20&offset=0`, {
        headers: { Authorization: `Bearer ${outsider.jwt}` },
      });
      expect(outsiderMailsRes.ok()).toBe(true);
      const outsiderMails = await outsiderMailsRes.json();
      expect(outsiderMails.results).toHaveLength(1);

      const forbiddenDeleteRes = await request.delete(
        `${WORKER_URL}/user_api/mails/${outsiderMails.results[0].id}`,
        { headers: { 'x-user-token': userJwt } },
      );
      expect(forbiddenDeleteRes.ok()).toBe(true);

      const outsiderAfterRes = await request.get(`${WORKER_URL}/api/mails?limit=20&offset=0`, {
        headers: { Authorization: `Bearer ${outsider.jwt}` },
      });
      expect(outsiderAfterRes.ok()).toBe(true);
      const outsiderAfter = await outsiderAfterRes.json();
      expect(outsiderAfter.results).toHaveLength(1);
    } finally {
      try {
        await Promise.allSettled(
          [...addresses, outsider].filter((item) => item !== undefined)
            .map((item) => deleteAddress(request, item.jwt)),
        );
        if (userId !== undefined) {
          const deleteUserRes = await request.delete(`${WORKER_URL}/admin/users/${userId}`);
          expect(deleteUserRes.ok()).toBe(true);
        }
      } finally {
        if (originalUserSettings) {
          const restoreSettingsRes = await request.post(`${WORKER_URL}/admin/user_settings`, {
            data: originalUserSettings,
          });
          expect(restoreSettingsRes.ok()).toBe(true);
        }
      }
    }
  });
});
