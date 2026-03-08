import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { WORKER_URL } from '../../fixtures/test-helpers';

const TEST_USER_EMAIL = `passkey-e2e-${Date.now()}@test.example.com`;
const TEST_USER_PASSWORD = 'test-password-123';

/**
 * Enable user registration via admin API, register a user, and login to get JWT.
 */
async function createTestUser(request: APIRequestContext): Promise<string> {
  // Enable user registration (KV setting)
  const enableRes = await request.post(`${WORKER_URL}/admin/user_settings`, {
    data: {
      enable: true,
      enableMailVerify: false,
    },
  });
  expect(enableRes.ok()).toBe(true);

  // Register user
  const registerRes = await request.post(`${WORKER_URL}/user_api/register`, {
    data: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
  });
  expect(registerRes.ok()).toBe(true);

  // Login to get JWT
  const loginRes = await request.post(`${WORKER_URL}/user_api/login`, {
    data: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
  });
  expect(loginRes.ok()).toBe(true);
  const { jwt } = await loginRes.json();
  expect(jwt).toBeTruthy();
  return jwt;
}

test.describe('Passkey API', () => {
  let userJwt: string;

  test.beforeAll(async ({ request }) => {
    userJwt = await createTestUser(request);
  });

  test('register_request returns valid WebAuthn options', async ({ request }) => {
    const res = await request.post(`${WORKER_URL}/user_api/passkey/register_request`, {
      headers: { 'x-user-token': userJwt },
      data: { domain: 'localhost' },
    });
    expect(res.ok()).toBe(true);
    const options = await res.json();

    // Verify WebAuthn registration options structure
    expect(options.rp).toBeDefined();
    expect(options.rp.id).toBe('localhost');
    expect(options.user).toBeDefined();
    expect(options.user.name).toBe(TEST_USER_EMAIL);
    expect(options.challenge).toBeTruthy();
    expect(options.pubKeyCredParams).toBeInstanceOf(Array);
    expect(options.pubKeyCredParams.length).toBeGreaterThan(0);
  });

  test('authenticate_request returns valid WebAuthn options', async ({ request }) => {
    const res = await request.post(`${WORKER_URL}/user_api/passkey/authenticate_request`, {
      data: { domain: 'localhost' },
    });
    expect(res.ok()).toBe(true);
    const options = await res.json();

    // Verify WebAuthn authentication options structure
    expect(options.challenge).toBeTruthy();
    expect(options.rpId).toBe('localhost');
    expect(options.allowCredentials).toBeInstanceOf(Array);
  });

  test('authenticate_response with invalid credential returns error', async ({ request }) => {
    const res = await request.post(`${WORKER_URL}/user_api/passkey/authenticate_response`, {
      data: {
        domain: 'localhost',
        origin: 'http://localhost',
        credential: { id: 'nonexistent-passkey-id' },
      },
    });
    expect(res.ok()).toBe(false);
    expect(res.status()).toBe(404);
  });

  test('passkey list is empty for new user', async ({ request }) => {
    const res = await request.get(`${WORKER_URL}/user_api/passkey`, {
      headers: { 'x-user-token': userJwt },
    });
    expect(res.ok()).toBe(true);
    const passkeys = await res.json();
    expect(passkeys).toBeInstanceOf(Array);
    expect(passkeys.length).toBe(0);
  });

  test('passkey list remains empty without registration', async ({ request }) => {
    const listRes = await request.get(`${WORKER_URL}/user_api/passkey`, {
      headers: { 'x-user-token': userJwt },
    });
    expect(listRes.ok()).toBe(true);
    const passkeys = await listRes.json();
    expect(passkeys).toBeInstanceOf(Array);
    expect(passkeys.length).toBe(0);
  });

  test('register_response with invalid credential returns 400', async ({ request }) => {
    const res = await request.post(`${WORKER_URL}/user_api/passkey/register_response`, {
      headers: { 'x-user-token': userJwt },
      data: {
        credential: {
          id: 'fake-id',
          rawId: 'fake-raw-id',
          type: 'public-key',
          response: {
            attestationObject: 'invalid-data',
            clientDataJSON: 'invalid-data',
          },
        },
        origin: 'http://localhost',
        passkey_name: 'test-passkey',
      },
    });
    expect(res.ok()).toBe(false);
    // Should fail verification
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('rename nonexistent passkey succeeds silently', async ({ request }) => {
    const res = await request.post(`${WORKER_URL}/user_api/passkey/rename`, {
      headers: { 'x-user-token': userJwt },
      data: {
        passkey_id: 'nonexistent-id',
        passkey_name: 'new-name',
      },
    });
    // The SQL UPDATE just affects 0 rows, still returns success
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('rename with invalid name returns 400', async ({ request }) => {
    const res = await request.post(`${WORKER_URL}/user_api/passkey/rename`, {
      headers: { 'x-user-token': userJwt },
      data: {
        passkey_id: 'any-id',
        passkey_name: 'x'.repeat(256),
      },
    });
    expect(res.status()).toBe(400);
  });

  test('delete nonexistent passkey succeeds silently', async ({ request }) => {
    const res = await request.delete(`${WORKER_URL}/user_api/passkey/nonexistent-id`, {
      headers: { 'x-user-token': userJwt },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
