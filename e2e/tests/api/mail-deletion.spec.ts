import { createHash } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { WORKER_URL, WORKER_URL_ENV_OFF, createTestAddress, seedTestMail, deleteAddress } from '../../fixtures/test-helpers';

test.describe('Mail Deletion', () => {
  test('user mail deletion is disabled when ENABLE_USER_DELETE_EMAIL is false', async ({ request }) => {
    test.skip(!WORKER_URL_ENV_OFF, 'WORKER_URL_ENV_OFF is not configured');

    const testUserEmail = `mail-delete-e2e-${Date.now()}@test.example.com`;
    const testUserPassword = 'test-password-123';
    const testUserPasswordHash = createHash('sha256').update(testUserPassword).digest('hex');

    const enableRes = await request.post(`${WORKER_URL_ENV_OFF}/admin/user_settings`, {
      data: {
        enable: true,
        enableMailVerify: false,
      },
    });
    expect(enableRes.ok()).toBe(true);

    const registerRes = await request.post(`${WORKER_URL_ENV_OFF}/user_api/register`, {
      data: { email: testUserEmail, password: testUserPasswordHash },
    });
    expect(registerRes.ok()).toBe(true);

    const loginRes = await request.post(`${WORKER_URL_ENV_OFF}/user_api/login`, {
      data: { email: testUserEmail, password: testUserPasswordHash },
    });
    expect(loginRes.ok()).toBe(true);
    const { jwt: userJwt } = await loginRes.json();
    expect(userJwt).toBeTruthy();

    const createRes = await request.post(`${WORKER_URL_ENV_OFF}/api/new_address`, {
      data: {
        name: `user-del-disabled${Date.now()}`,
        domain: 'test.example.com',
      },
    });
    expect(createRes.ok()).toBe(true);
    const { jwt, address, address_id } = await createRes.json();

    try {
      const bindRes = await request.post(`${WORKER_URL_ENV_OFF}/user_api/bind_address`, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'x-user-token': userJwt,
        },
      });
      expect(bindRes.ok()).toBe(true);

      const from = 'sender@test.example.com';
      const subject = 'Disabled Mail Delete';
      const boundary = `----E2E${Date.now()}`;
      const raw = [
        `From: ${from}`,
        `To: ${address}`,
        `Subject: ${subject}`,
        `Message-ID: <e2e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@test>`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        'Hello from E2E',
        `--${boundary}`,
        'Content-Type: text/html; charset=utf-8',
        '',
        '<p>Hello from E2E</p>',
        `--${boundary}--`,
      ].join('\r\n');

      const seedRes = await request.post(`${WORKER_URL_ENV_OFF}/admin/test/receive_mail`, {
        data: { from, to: address, raw },
      });
      expect(seedRes.ok()).toBe(true);
      const seedBody = await seedRes.json();
      expect(seedBody.success).toBe(true);

      const listRes = await request.get(`${WORKER_URL_ENV_OFF}/user_api/mails?limit=10&offset=0`, {
        headers: { 'x-user-token': userJwt },
      });
      expect(listRes.ok()).toBe(true);
      const { results } = await listRes.json();
      expect(results).toHaveLength(1);

      const targetId = results[0].id;
      const delRes = await request.delete(`${WORKER_URL_ENV_OFF}/user_api/mails/${targetId}`, {
        headers: { 'x-user-token': userJwt },
      });
      expect(delRes.status()).toBe(403);

      const afterRes = await request.get(`${WORKER_URL_ENV_OFF}/user_api/mails?limit=10&offset=0`, {
        headers: { 'x-user-token': userJwt },
      });
      expect(afterRes.ok()).toBe(true);
      const after = await afterRes.json();
      expect(after.results).toHaveLength(1);
      expect(after.results[0].id).toBe(targetId);
    } finally {
      const deleteRes = await request.delete(`${WORKER_URL_ENV_OFF}/admin/delete_address/${address_id}`);
      expect(deleteRes.ok()).toBe(true);
    }
  });

  test('delete a single mail by ID', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'del-single');

    try {
      // Seed 3 emails
      for (let i = 1; i <= 3; i++) {
        await seedTestMail(request, address, { subject: `Mail ${i}` });
      }

      // List mails — should have 3
      const listRes = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(listRes.ok()).toBe(true);
      const { results } = await listRes.json();
      expect(results).toHaveLength(3);

      // Delete the second mail
      const targetId = results[1].id;
      const delRes = await request.delete(`${WORKER_URL}/api/mails/${targetId}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(delRes.ok()).toBe(true);
      const delBody = await delRes.json();
      expect(delBody.success).toBe(true);

      // List again — should have 2, and the deleted ID should be gone
      const afterRes = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(afterRes.ok()).toBe(true);
      const after = await afterRes.json();
      expect(after.results).toHaveLength(2);
      expect(after.results.every((m: any) => m.id !== targetId)).toBe(true);
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('clear entire inbox', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'del-clear');

    try {
      // Seed 3 emails
      for (let i = 1; i <= 3; i++) {
        await seedTestMail(request, address, { subject: `Mail ${i}` });
      }

      // Verify 3 mails exist
      const listRes = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(listRes.ok()).toBe(true);
      const { results } = await listRes.json();
      expect(results).toHaveLength(3);

      // Clear inbox
      const clearRes = await request.delete(`${WORKER_URL}/api/clear_inbox`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(clearRes.ok()).toBe(true);
      const clearBody = await clearRes.json();
      expect(clearBody.success).toBe(true);

      // Verify inbox is empty
      const afterRes = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(afterRes.ok()).toBe(true);
      const after = await afterRes.json();
      expect(after.results).toHaveLength(0);
    } finally {
      await deleteAddress(request, jwt);
    }
  });
});
