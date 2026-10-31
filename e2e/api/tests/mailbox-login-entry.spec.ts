import { expect, test } from '@playwright/test';

import { WORKER_URL, TEST_DOMAIN, deleteAddress } from '../../fixtures/test-helpers';

for (const mode of ['default', 'password-only', 'password-disabled']) {
  test(`mailbox login entry configuration preserves credentials: ${mode}`, async ({ request }) => {
    const headers = mode === 'default' ? {} : { 'x-test-address-password-mode': mode };
    const settings = await request.get(`${WORKER_URL}/open_api/settings`, { headers });
    expect(settings.ok()).toBe(true);
    expect(await settings.json()).toMatchObject({
      enableAddressPassword: mode !== 'password-disabled',
      addressPasswordLoginOnly: mode === 'password-only',
    });

    const created = await request.post(`${WORKER_URL}/api/new_address`, {
      data: { name: `loginentry${Date.now()}`, domain: TEST_DOMAIN },
    });
    expect(created.ok()).toBe(true);
    const { jwt, address } = await created.json();
    try {
      const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
      expect(payload).not.toHaveProperty('type');
      expect(payload).not.toHaveProperty('exp');
      const login = await request.post(`${WORKER_URL}/open_api/credential_login`, {
        headers, data: { credential: jwt },
      });
      expect(login.ok()).toBe(true);
      const mailbox = await request.get(`${WORKER_URL}/api/settings`, {
        headers: { ...headers, Authorization: `Bearer ${jwt}` },
      });
      expect(mailbox.ok()).toBe(true);
      expect(await mailbox.json()).toMatchObject({ address });
    } finally {
      await deleteAddress(request, jwt);
    }
  });
}

test('mailboxes created in password-only mode receive usable password sessions', async ({ request }) => {
  const headers = { 'x-test-address-password-mode': 'password-only' };
  const response = await request.post(`${WORKER_URL}/api/new_address`, {
    headers, data: { name: `sessionentry${Date.now()}`, domain: TEST_DOMAIN },
  });
  expect(response.ok()).toBe(true);
  const { jwt, address } = await response.json();
  try {
    const settings = await request.get(`${WORKER_URL}/api/settings`, {
      headers: { ...headers, Authorization: `Bearer ${jwt}` },
    });
    expect(settings.ok()).toBe(true);
    const payload = await settings.json();
    expect(payload).toMatchObject({ address, type: 'address_password_login', new_address_token: null });
    expect(payload.exp - payload.iat).toBe(30 * 86400);
  } finally {
    await deleteAddress(request, jwt);
  }
});
