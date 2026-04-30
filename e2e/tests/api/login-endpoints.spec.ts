import { test, expect } from '@playwright/test';
import { WORKER_URL, createTestAddress, deleteAddress, hashPassword } from '../../fixtures/test-helpers';

test.describe('Turnstile Login Endpoints (ENABLE_GLOBAL_TURNSTILE_CHECK disabled)', () => {

  test('settings returns enableGlobalTurnstileCheck as false', async ({ request }) => {
    const res = await request.get(`${WORKER_URL}/open_api/settings`);
    expect(res.ok()).toBe(true);
    const settings = await res.json();
    expect(settings.enableGlobalTurnstileCheck).toBe(false);
  });

  test.describe('/open_api/site_login', () => {
    test('returns 401 when no PASSWORDS configured', async ({ request }) => {
      const res = await request.post(`${WORKER_URL}/open_api/site_login`, {
        data: {
          password: hashPassword('any-pass'),
          cf_token: ''
        }
      });
      expect(res.status()).toBe(401);
    });
  });

  test.describe('/open_api/admin_login', () => {
    test('correct hashed password succeeds', async ({ request }) => {
      const res = await request.post(`${WORKER_URL}/open_api/admin_login`, {
        data: {
          password: hashPassword('e2e-admin-pass'),
          cf_token: ''
        }
      });
      expect(res.ok()).toBe(true);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    test('wrong password returns 401', async ({ request }) => {
      const res = await request.post(`${WORKER_URL}/open_api/admin_login`, {
        data: {
          password: hashPassword('wrong-admin'),
          cf_token: ''
        }
      });
      expect(res.status()).toBe(401);
    });

    test('empty password returns 401', async ({ request }) => {
      const res = await request.post(`${WORKER_URL}/open_api/admin_login`, {
        data: {
          password: '',
          cf_token: ''
        }
      });
      expect(res.status()).toBe(401);
    });
  });

  test.describe('/open_api/credential_login', () => {
    test('valid JWT credential succeeds', async ({ request }) => {
      const { jwt, address } = await createTestAddress(request, 'cred-login');
      try {
        const res = await request.post(`${WORKER_URL}/open_api/credential_login`, {
          data: {
            credential: jwt,
            cf_token: ''
          }
        });
        expect(res.ok()).toBe(true);
        const body = await res.json();
        expect(body.success).toBe(true);
      } finally {
        await deleteAddress(request, jwt);
      }
    });

    test('invalid JWT returns 401', async ({ request }) => {
      const res = await request.post(`${WORKER_URL}/open_api/credential_login`, {
        data: {
          credential: 'invalid.jwt.token',
          cf_token: ''
        }
      });
      expect(res.status()).toBe(401);
    });

    test('empty credential returns 401', async ({ request }) => {
      const res = await request.post(`${WORKER_URL}/open_api/credential_login`, {
        data: {
          credential: '',
          cf_token: ''
        }
      });
      expect(res.status()).toBe(401);
    });
  });

  test.describe('/api/address_login with cf_token', () => {
    test('address login with empty cf_token works when turnstile disabled', async ({ request }) => {
      const { jwt, address } = await createTestAddress(request, 'addr-cf');
      try {
        // Set a password
        await request.post(`${WORKER_URL}/api/address_change_password`, {
          headers: { Authorization: `Bearer ${jwt}` },
          data: { new_password: hashPassword('addr-pass-123') },
        });

        // Login with cf_token field present but empty
        const loginRes = await request.post(`${WORKER_URL}/api/address_login`, {
          data: {
            email: address,
            password: hashPassword('addr-pass-123'),
            cf_token: ''
          },
        });
        expect(loginRes.ok()).toBe(true);
        const body = await loginRes.json();
        expect(body.jwt).toBeTruthy();
      } finally {
        await deleteAddress(request, jwt);
      }
    });
  });
});
