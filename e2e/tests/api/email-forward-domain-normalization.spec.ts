import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import {
  WORKER_URL,
  TEST_DOMAIN,
  createTestAddress,
  deleteAddress,
} from '../../fixtures/test-helpers';

const ADMIN_PASSWORD = 'e2e-admin-pass';
const ADMIN_HEADERS = { 'x-admin-auth': ADMIN_PASSWORD };

const DEFAULT_ACCOUNT_SETTINGS = {
  blockList: [],
  sendBlockList: [],
  verifiedAddressList: [],
  fromBlockList: [],
  noLimitSendAddressList: [],
  emailRuleSettings: {},
  addressCreationSettings: {},
};

async function resetAccountSettings(request: APIRequestContext) {
  const res = await request.post(`${WORKER_URL}/admin/account_settings`, {
    headers: ADMIN_HEADERS,
    data: DEFAULT_ACCOUNT_SETTINGS,
  });
  expect(res.ok()).toBe(true);
}

test.describe('Email forward domain normalization', () => {
  test.afterEach(async ({ request }) => {
    await resetAccountSettings(request);
  });

  test('normalizes uppercase forwarding rule and recipient domains', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'forward-case');
    const forwardAddress = 'forward-target@test.example.com';

    try {
      const saveRes = await request.post(`${WORKER_URL}/admin/account_settings`, {
        headers: ADMIN_HEADERS,
        data: {
          ...DEFAULT_ACCOUNT_SETTINGS,
          emailRuleSettings: {
            emailForwardingList: [{
              domains: [TEST_DOMAIN.toUpperCase()],
              forward: forwardAddress,
            }],
          },
        },
      });
      expect(saveRes.ok()).toBe(true);

      const to = address.replace(`@${TEST_DOMAIN}`, `@${TEST_DOMAIN.toUpperCase()}`);
      const subject = `forward-case-${Date.now()}`;
      const raw = [
        `From: sender@test.example.com`,
        `To: ${to}`,
        `Subject: ${subject}`,
        `Message-ID: <${subject}@test>`,
        `MIME-Version: 1.0`,
        `Content-Type: text/plain; charset=utf-8`,
        ``,
        `Forward domain normalization test`,
      ].join('\r\n');

      const res = await request.post(`${WORKER_URL}/admin/test/receive_mail`, {
        data: { from: 'sender@test.example.com', to, raw },
      });
      expect(res.ok()).toBe(true);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.forwardedTo).toEqual([forwardAddress]);

      const mailsRes = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(mailsRes.ok()).toBe(true);
      const mailsBody = await mailsRes.json();
      expect(mailsBody.results.some((mail: { address: string; raw: string }) => {
        return mail.address === address && mail.raw.includes(subject);
      })).toBe(true);
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('does not forward when only the domain suffix string matches', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'forward-boundary');
    const forwardAddress = 'forward-boundary-target@test.example.com';

    try {
      const saveRes = await request.post(`${WORKER_URL}/admin/account_settings`, {
        headers: ADMIN_HEADERS,
        data: {
          ...DEFAULT_ACCOUNT_SETTINGS,
          emailRuleSettings: {
            emailForwardingList: [{
              domains: [TEST_DOMAIN],
              forward: forwardAddress,
            }],
          },
        },
      });
      expect(saveRes.ok()).toBe(true);

      const to = address.replace(`@${TEST_DOMAIN}`, `@evil${TEST_DOMAIN}`);
      const subject = `forward-boundary-${Date.now()}`;
      const raw = [
        `From: sender@test.example.com`,
        `To: ${to}`,
        `Subject: ${subject}`,
        `Message-ID: <${subject}@test>`,
        `MIME-Version: 1.0`,
        `Content-Type: text/plain; charset=utf-8`,
        ``,
        `Forward domain boundary test`,
      ].join('\r\n');

      const res = await request.post(`${WORKER_URL}/admin/test/receive_mail`, {
        data: { from: 'sender@test.example.com', to, raw },
      });
      expect(res.ok()).toBe(true);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.forwardedTo).toEqual([]);
    } finally {
      await deleteAddress(request, jwt);
    }
  });
});
