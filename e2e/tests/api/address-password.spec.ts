import { test, expect } from '@playwright/test';
import { WORKER_URL, createTestAddress, deleteAddress, requestSendAccess, sendTestMail } from '../../fixtures/test-helpers';

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
      const changePwdBody = await changePwdRes.json();
      expect(changePwdBody.success).toBe(true);

      // Login with wrong password
      const loginRes = await request.post(`${WORKER_URL}/api/address_login`, {
        data: { email: address, password: 'wrong-password' },
      });
      expect(loginRes.status()).toBe(401);
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('mixed-case address login can read inbox, settings, and sendbox', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'pwd-mixed-case');

    try {
      const changePwdRes = await request.post(`${WORKER_URL}/api/address_change_password`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: { new_password: 'mixed-case-password' },
      });
      expect(changePwdRes.ok()).toBe(true);

      const mixedCaseAddress = address.replace(/^[^@]+/, (local) => `${local[0].toUpperCase()}${local.slice(1)}`);
      expect(mixedCaseAddress).not.toBe(address);

      const loginRes = await request.post(`${WORKER_URL}/api/address_login`, {
        data: { email: mixedCaseAddress, password: 'mixed-case-password' },
      });
      expect(loginRes.ok()).toBe(true);
      const loginBody = await loginRes.json();
      expect(loginBody.address).toBe(address);
      expect(loginBody.jwt).toBeTruthy();

      await requestSendAccess(request, loginBody.jwt);
      await sendTestMail(request, mixedCaseAddress, {
        to_mail: 'recipient@test.example.com',
        subject: `Mixed Case Send ${Date.now()}`,
        content: 'Mixed case sendbox body',
        is_html: false,
      });

      const seedSubject = `Mixed Case Inbox ${Date.now()}`;
      const seedRes = await request.post(`${WORKER_URL}/admin/test/receive_mail`, {
        data: {
          from: 'sender@test.example.com',
          to: mixedCaseAddress,
          raw: [
            'From: sender@test.example.com',
            `To: ${mixedCaseAddress}`,
            `Subject: ${seedSubject}`,
            `Message-ID: <mixed-case-${Date.now()}@test>`,
            'Content-Type: text/plain; charset=utf-8',
            '',
            'Mixed case inbox body',
          ].join('\r\n'),
        },
      });
      expect(seedRes.ok()).toBe(true);
      const seedBody = await seedRes.json();
      expect(seedBody.success).toBe(true);

      const mailsRes = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${loginBody.jwt}` },
      });
      expect(mailsRes.ok()).toBe(true);
      const mailsBody = await mailsRes.json();
      expect(mailsBody.results).toHaveLength(1);
      expect(mailsBody.results[0].address).toBe(address);

      const detailRes = await request.get(`${WORKER_URL}/api/mail/${mailsBody.results[0].id}`, {
        headers: { Authorization: `Bearer ${loginBody.jwt}` },
      });
      expect(detailRes.ok()).toBe(true);
      const detailBody = await detailRes.json();
      expect(detailBody.address).toBe(address);
      expect(detailBody.raw).toContain(seedSubject);

      const settingsRes = await request.get(`${WORKER_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${loginBody.jwt}` },
      });
      expect(settingsRes.ok()).toBe(true);
      const settingsBody = await settingsRes.json();
      expect(settingsBody.address).toBe(address);

      const sendboxRes = await request.get(`${WORKER_URL}/api/sendbox?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${loginBody.jwt}` },
      });
      expect(sendboxRes.ok()).toBe(true);
      const sendboxBody = await sendboxRes.json();
      expect(sendboxBody.results.length).toBeGreaterThanOrEqual(1);
      expect(sendboxBody.results[0].address).toBe(address);

      const clearInboxRes = await request.delete(`${WORKER_URL}/api/clear_inbox`, {
        headers: { Authorization: `Bearer ${loginBody.jwt}` },
      });
      expect(clearInboxRes.ok()).toBe(true);
      const clearSentRes = await request.delete(`${WORKER_URL}/api/clear_sent_items`, {
        headers: { Authorization: `Bearer ${loginBody.jwt}` },
      });
      expect(clearSentRes.ok()).toBe(true);

      const mailsAfterClearRes = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${loginBody.jwt}` },
      });
      expect(mailsAfterClearRes.ok()).toBe(true);
      const mailsAfterClearBody = await mailsAfterClearRes.json();
      expect(mailsAfterClearBody.results).toHaveLength(0);

      const sendboxAfterClearRes = await request.get(`${WORKER_URL}/api/sendbox?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${loginBody.jwt}` },
      });
      expect(sendboxAfterClearRes.ok()).toBe(true);
      const sendboxAfterClearBody = await sendboxAfterClearRes.json();
      expect(sendboxAfterClearBody.results).toHaveLength(0);
    } finally {
      await deleteAddress(request, jwt);
    }
  });
});
