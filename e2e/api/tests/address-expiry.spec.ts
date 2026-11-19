import { test, expect } from '@playwright/test';
import { WORKER_URL, WORKER_URL_ENV_OFF, TEST_DOMAIN, deleteAddress, hashPassword } from '../../fixtures/test-helpers';

test.describe('Address Expiration', () => {
  test('disabled/unset feature flag keeps existing behavior and rejects explicit expiry inputs', async ({ request }) => {
    test.skip(!WORKER_URL_ENV_OFF, 'WORKER_URL_ENV_OFF is not configured');

    for (const [label, url, extraHeaders] of [
      ['unset', WORKER_URL_ENV_OFF, {}],
      ['explicitly disabled', WORKER_URL, { 'x-test-address-expiry-mode': 'off' }],
    ] as const) {
      const settingsRes = await request.get(`${url}/open_api/settings`, { headers: extraHeaders });
      expect(settingsRes.ok(), `${label} /open_api/settings`).toBe(true);
      expect((await settingsRes.json()).enableAddressExpiry).toBe(false);

      const normalRes = await request.post(`${url}/api/new_address`, {
        headers: extraHeaders,
        data: { name: `noflag${Date.now().toString(36)}`, domain: TEST_DOMAIN },
      });
      expect(normalRes.ok(), `${label} normal /api/new_address`).toBe(true);
      const normalBody = await normalRes.json();
      expect(normalBody.expires_at).toBeUndefined();

      const explicitApiRes = await request.post(`${url}/api/new_address`, {
        headers: extraHeaders,
        data: { name: `expdis${Date.now().toString(36)}`, domain: TEST_DOMAIN, expiresIn: 3600 },
      });
      expect(explicitApiRes.status(), `${label} explicit expiresIn`).toBe(403);

      const explicitAdminRes = await request.post(`${url}/admin/new_address`, {
        headers: extraHeaders,
        data: {
          name: `admdis${Date.now().toString(36)}`,
          domain: TEST_DOMAIN,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      });
      expect(explicitAdminRes.status(), `${label} explicit admin expiresAt`).toBe(403);

      const cleanupRes = await request.post(`${url}/admin/cleanup`, {
        headers: extraHeaders,
        data: { cleanType: 'expiredAddress' },
      });
      expect(cleanupRes.status(), `${label} disabled cleanup`).toBe(403);

      // Normal mailbox access continues unaffected when disabled
      const accessRes = await request.get(`${url}/api/settings`, {
        headers: { ...extraHeaders, Authorization: `Bearer ${normalBody.jwt}` },
      });
      expect(accessRes.ok(), `${label} access`).toBe(true);

      const delRes = await request.delete(`${url}/admin/delete_address/${normalBody.address_id}`, {
        headers: { ...extraHeaders, 'x-admin-auth': 'e2e-admin-pass' },
      });
      expect(delRes.ok(), `${label} cleanup delete`).toBe(true);
    }
  });

  test('defaults to never expiring when expiresAt is omitted', async ({ request }) => {
    const settingsRes = await request.get(`${WORKER_URL}/open_api/settings`);
    expect(settingsRes.ok()).toBe(true);
    expect((await settingsRes.json()).enableAddressExpiry).toBe(true);

    const uniqueName = `noexp${Date.now()}`;
    const res = await request.post(`${WORKER_URL}/admin/new_address`, {
      data: { name: uniqueName, domain: TEST_DOMAIN },
    });

    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.expires_at).toBeNull();
    await deleteAddress(request, body.jwt);
  });

  test('rejects invalid or past expiresAt values', async ({ request }) => {
    const pastIso = new Date(Date.now() - 60_000).toISOString();
    const pastRes = await request.post(`${WORKER_URL}/admin/new_address`, {
      data: { name: `pastexp${Date.now()}`, domain: TEST_DOMAIN, expiresAt: pastIso },
    });
    expect(pastRes.status()).toBe(400);
    expect(await pastRes.text()).toContain('Invalid expiration time');

    const invalidRes = await request.post(`${WORKER_URL}/api/new_address`, {
      data: { name: `badexp${Date.now()}`, domain: TEST_DOMAIN, expiresAt: 'not-a-date' },
    });
    expect(invalidRes.status()).toBe(400);
    expect(await invalidRes.text()).toContain('Invalid expiration time');

    const blankRes = await request.post(`${WORKER_URL}/api/new_address`, {
      data: { name: `blankexp${Date.now()}`, domain: TEST_DOMAIN, expiresAt: '   ' },
    });
    expect(blankRes.status()).toBe(400);
    expect(await blankRes.text()).toContain('Invalid expiration time');

    const invalidInRes = await request.post(`${WORKER_URL}/api/new_address`, {
      data: { name: `badin${Date.now()}`, domain: TEST_DOMAIN, expiresIn: -60 },
    });
    expect(invalidInRes.status()).toBe(400);
    expect(await invalidInRes.text()).toContain('Invalid expiration time');

    const bothRes = await request.post(`${WORKER_URL}/admin/new_address`, {
      data: {
        name: `bothexp${Date.now()}`,
        domain: TEST_DOMAIN,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        expiresIn: 60,
      },
    });
    expect(bothRes.status()).toBe(400);
    expect(await bothRes.text()).toContain('Invalid expiration time');
  });

  test('supports relative expiresIn duration in seconds', async ({ request }) => {
    const startedAt = Date.now();
    const res = await request.post(`${WORKER_URL}/api/new_address`, {
      data: { name: `relexp${Date.now().toString(36)}`, domain: TEST_DOMAIN, expiresIn: 86400 },
    });
    const finishedAt = Date.now();
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.expires_at).toBeTruthy();
    const storedMs = Date.parse(`${body.expires_at.replace(' ', 'T')}Z`);
    expect(storedMs).toBeGreaterThanOrEqual(Math.floor((startedAt + 86400_000) / 1000) * 1000);
    expect(storedMs).toBeLessThanOrEqual(Math.floor((finishedAt + 86400_000) / 1000) * 1000);
    await deleteAddress(request, body.jwt);
  });

  test('enforces expiry in shared auth, keeps pre-cleanup inbound mail & mixed lists, and cleans up', async ({ request }) => {
    const userSettingsRes = await request.get(`${WORKER_URL}/admin/user_settings`);
    expect(userSettingsRes.ok()).toBe(true);
    const originalUserSettings = await userSettingsRes.json();
    expect((await request.post(`${WORKER_URL}/admin/user_settings`, {
      data: {
        ...originalUserSettings,
        enable: true,
        enableMailVerify: false,
        maxAddressCount: 0,
      },
    })).ok()).toBe(true);

    let addrBody: any;
    let permBody: any;
    let originalSettings: any;
    try {
      const email = `user-exp-${Date.now()}@${TEST_DOMAIN}`;
      const password = hashPassword('test-password-123');
      expect((await request.post(`${WORKER_URL}/user_api/register`, { data: { email, password } })).ok()).toBe(true);
      const loginRes = await request.post(`${WORKER_URL}/user_api/login`, { data: { email, password } });
      expect(loginRes.ok()).toBe(true);
      const { jwt: userJwt } = await loginRes.json();

      const expiresAt = new Date(Date.now() + 5000).toISOString();
      const addrRes = await request.post(`${WORKER_URL}/api/new_address`, {
        headers: { 'x-user-token': userJwt },
        data: { name: `uexp${Date.now().toString(36)}`, domain: TEST_DOMAIN, expiresAt },
      });
      expect(addrRes.ok()).toBe(true);
      addrBody = await addrRes.json();

      const permRes = await request.post(`${WORKER_URL}/api/new_address`, {
        headers: { 'x-user-token': userJwt },
        data: { name: `uperm${Date.now().toString(36)}`, domain: TEST_DOMAIN },
      });
      expect(permRes.ok()).toBe(true);
      permBody = await permRes.json();
      expect(permBody.expires_at).toBeNull();

      expect((await request.post(`${WORKER_URL}/user_api/bind_address`, {
        headers: { Authorization: `Bearer ${addrBody.jwt}`, 'x-user-token': userJwt },
      })).ok()).toBe(true);

      expect((await request.post(`${WORKER_URL}/user_api/bind_address`, {
        headers: { Authorization: `Bearer ${permBody.jwt}`, 'x-user-token': userJwt },
      })).ok()).toBe(true);

      const permSeedRes = await request.post(`${WORKER_URL}/__test/seed_mail`, {
        data: {
          address: permBody.address,
          raw: 'Subject: Permanent\r\n\r\nSurvives expiry cleanup',
          message_id: `<uperm-${Date.now()}@test>`,
        },
      });
      expect(permSeedRes.ok()).toBe(true);

      // Wait until strictly past stored expires_at (1s granularity in SQLite DATETIME)
      const storedExpiryMs = Date.parse(`${addrBody.expires_at.replace(' ', 'T')}Z`);
      const waitMs = Math.max(0, storedExpiryMs - Date.now() + 1200);
      await new Promise((resolve) => setTimeout(resolve, waitMs));

      // Shared mailbox auth & single-address user ops reject expired address immediately
      const apiSettingsRes = await request.get(`${WORKER_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${addrBody.jwt}` },
      });
      expect(apiSettingsRes.status()).toBe(401);

      const credLoginRes = await request.post(`${WORKER_URL}/open_api/credential_login`, {
        data: { credential: addrBody.jwt },
      });
      expect(credLoginRes.status()).toBe(401);

      if (addrBody.password) {
        const expiredPwLoginRes = await request.post(`${WORKER_URL}/api/address_login`, {
          data: { email: addrBody.address, password: hashPassword(addrBody.password) },
        });
        expect(expiredPwLoginRes.status()).toBe(404);
      }
      if (permBody.password) {
        const permPwLoginRes = await request.post(`${WORKER_URL}/api/address_login`, {
          data: { email: permBody.address, password: hashPassword(permBody.password) },
        });
        expect(permPwLoginRes.ok()).toBe(true);
      }

      const jwtRes = await request.get(`${WORKER_URL}/user_api/bind_address_jwt/${addrBody.address_id}`, {
        headers: { 'x-user-token': userJwt },
      });
      expect(jwtRes.status()).toBe(400);

      const sendSettingsRes = await request.get(`${WORKER_URL}/user_api/address/${addrBody.address_id}/settings`, {
        headers: { 'x-user-token': userJwt },
      });
      expect(sendSettingsRes.status()).toBe(400);

      // Disabling the flag pauses enforcement without erasing saved deadlines
      const pausedAccessRes = await request.get(`${WORKER_URL}/api/settings`, {
        headers: {
          Authorization: `Bearer ${addrBody.jwt}`,
          'x-test-address-expiry-mode': 'off',
        },
      });
      expect(pausedAccessRes.ok()).toBe(true);

      // Pre-cleanup inbound mail still delivers for expired registered addresses under both unknown-address modes
      const originalSettingsRes = await request.get(`${WORKER_URL}/admin/account_settings`);
      expect(originalSettingsRes.ok()).toBe(true);
      originalSettings = await originalSettingsRes.json();

      for (const blockUnknown of [false, true]) {
        const updateRes = await request.post(`${WORKER_URL}/admin/account_settings`, {
          data: {
            ...originalSettings,
            emailRuleSettings: {
              ...(originalSettings.emailRuleSettings || {}),
              blockReceiveUnknowAddressEmail: blockUnknown,
            },
          },
        });
        expect(updateRes.ok()).toBe(true);

        const receiveRes = await request.post(`${WORKER_URL}/__test/receive_mail`, {
          data: {
            from: 'sender@outside.example',
            to: addrBody.address,
            raw: `From: sender@outside.example\r\nTo: ${addrBody.address}\r\nSubject: Pre-cleanup ${blockUnknown}\r\n\r\nBody`,
          },
        });
        expect(receiveRes.ok()).toBe(true);
        const receiveBody = await receiveRes.json();
        expect(receiveBody.rejected).toBeFalsy();
      }

      // Unfiltered mixed-mailbox user list retains both expired and permanent mails before cleanup
      const preCleanupMixedRes = await request.get(`${WORKER_URL}/user_api/mails`, {
        headers: { 'x-user-token': userJwt },
        params: { limit: '20', offset: '0' },
      });
      expect(preCleanupMixedRes.ok()).toBe(true);
      const preCleanupMixedBody = await preCleanupMixedRes.json();
      expect(preCleanupMixedBody.count).toBe(3);
      expect(new Set(preCleanupMixedBody.results.map((r: { address: string }) => r.address))).toEqual(
        new Set([addrBody.address, permBody.address])
      );

      // Cleanup deletes only expired address, mails, and bindings; permanent mailbox survives
      const cleanupRes = await request.post(`${WORKER_URL}/admin/cleanup`, {
        data: { cleanType: 'expiredAddress' },
      });
      expect(cleanupRes.ok()).toBe(true);

      const postCleanupList = await request.get(`${WORKER_URL}/admin/address`, {
        params: { query: addrBody.address, limit: '10', offset: '0' },
      });
      expect(postCleanupList.ok()).toBe(true);
      expect((await postCleanupList.json()).count).toBe(0);

      const postCleanupMixedRes = await request.get(`${WORKER_URL}/user_api/mails`, {
        headers: { 'x-user-token': userJwt },
        params: { limit: '20', offset: '0' },
      });
      expect(postCleanupMixedRes.ok()).toBe(true);
      const postCleanupMixedBody = await postCleanupMixedRes.json();
      expect(postCleanupMixedBody.count).toBe(1);
      expect(postCleanupMixedBody.results[0].address).toBe(permBody.address);

      const postCleanupUnknownRes = await request.post(`${WORKER_URL}/__test/receive_mail`, {
        data: {
          from: 'sender@outside.example',
          to: addrBody.address,
          raw: `From: sender@outside.example\r\nTo: ${addrBody.address}\r\nSubject: Post-cleanup\r\n\r\nBody`,
        },
      });
      expect(postCleanupUnknownRes.ok()).toBe(true);
      expect((await postCleanupUnknownRes.json()).rejected).toBeTruthy();
    } finally {
      if (originalSettings) {
        await request.post(`${WORKER_URL}/admin/account_settings`, { data: originalSettings });
      }
      await request.post(`${WORKER_URL}/admin/user_settings`, { data: originalUserSettings });
      if (addrBody?.address_id) {
        await request.delete(`${WORKER_URL}/admin/delete_address/${addrBody.address_id}`);
      }
      if (permBody?.jwt) {
        await deleteAddress(request, permBody.jwt);
      }
    }
  });
});
