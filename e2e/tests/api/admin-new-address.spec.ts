import { test, expect } from '@playwright/test';
import { WORKER_URL, TEST_DOMAIN } from '../../fixtures/test-helpers';

test.describe('Admin New Address', () => {
  test('should return address_id in response', async ({ request }) => {
    const uniqueName = `admin-test${Date.now()}`;
    const res = await request.post(`${WORKER_URL}/admin/new_address`, {
      data: { name: uniqueName, domain: TEST_DOMAIN },
    });

    expect(res.ok()).toBe(true);
    const body = await res.json();

    expect(body.address).toContain('@' + TEST_DOMAIN);
    expect(body.jwt).toBeTruthy();
    expect(body.address_id).toBeGreaterThan(0);
    expect(typeof body.address_id).toBe('number');
  });

  test('normalizes uppercase configured prefix and domain', async ({ request }) => {
    const uniqueName = `admincase${Date.now()}`;
    const res = await request.post(`${WORKER_URL}/admin/new_address`, {
      data: { name: uniqueName, domain: TEST_DOMAIN.toUpperCase(), enablePrefix: true },
    });

    expect(res.ok()).toBe(true);
    const body = await res.json();

    expect(body.address).toBe(`tmp${uniqueName}@${TEST_DOMAIN}`);
    expect(body.jwt).toBeTruthy();
    expect(body.address_id).toBeGreaterThan(0);
  });

  test('falls back to domains when default domains is empty', async ({ request }) => {
    const uniqueName = `fallback${Date.now().toString(36)}`;
    const res = await request.post(`${WORKER_URL}/api/new_address`, {
      data: { name: uniqueName },
    });

    expect(res.ok()).toBe(true);
    const body = await res.json();

    expect(body.address).toBe(`tmp${uniqueName}@${TEST_DOMAIN}`);
    expect(body.jwt).toBeTruthy();
    expect(body.address_id).toBeGreaterThan(0);
  });

  test('normalizes user role domains and prefix', async ({ request }) => {
    const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    const email = `role-case-${suffix}@${TEST_DOMAIN}`;
    const password = `role-pass-${suffix}`;
    const name = `rolecase${suffix}`;

    const createUserRes = await request.post(`${WORKER_URL}/admin/users`, {
      data: { email, password },
    });
    expect(createUserRes.ok()).toBe(true);

    const usersRes = await request.get(`${WORKER_URL}/admin/users`, {
      params: { limit: '20', offset: '0', query: email },
    });
    expect(usersRes.ok()).toBe(true);
    const usersBody = await usersRes.json();
    const user = usersBody.results.find((row: { user_email: string }) => row.user_email === email);
    expect(user).toBeTruthy();

    const updateRoleRes = await request.post(`${WORKER_URL}/admin/user_roles`, {
      data: { user_id: user.id, role_text: 'case-role' },
    });
    expect(updateRoleRes.ok()).toBe(true);

    const loginRes = await request.post(`${WORKER_URL}/user_api/login`, {
      data: { email, password },
    });
    expect(loginRes.ok()).toBe(true);
    const { jwt: userJwt } = await loginRes.json();

    const createAddressRes = await request.post(`${WORKER_URL}/api/new_address`, {
      headers: { 'x-user-token': userJwt },
      data: { name },
    });
    expect(createAddressRes.ok()).toBe(true);
    const addressBody = await createAddressRes.json();

    expect(addressBody.address).toBe(`role${name}@${TEST_DOMAIN}`);
    expect(addressBody.jwt).toBeTruthy();
    expect(addressBody.address_id).toBeGreaterThan(0);
  });

  test('falls back to default domains when user role domains is empty', async ({ request }) => {
    const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    const email = `empty-role-${suffix}@${TEST_DOMAIN}`;
    const password = `empty-role-pass-${suffix}`;
    const name = `emptyrole${suffix}`;

    const createUserRes = await request.post(`${WORKER_URL}/admin/users`, {
      data: { email, password },
    });
    expect(createUserRes.ok()).toBe(true);

    const usersRes = await request.get(`${WORKER_URL}/admin/users`, {
      params: { limit: '20', offset: '0', query: email },
    });
    expect(usersRes.ok()).toBe(true);
    const usersBody = await usersRes.json();
    const user = usersBody.results.find((row: { user_email: string }) => row.user_email === email);
    expect(user).toBeTruthy();

    const updateRoleRes = await request.post(`${WORKER_URL}/admin/user_roles`, {
      data: { user_id: user.id, role_text: 'empty-role' },
    });
    expect(updateRoleRes.ok()).toBe(true);

    const loginRes = await request.post(`${WORKER_URL}/user_api/login`, {
      data: { email, password },
    });
    expect(loginRes.ok()).toBe(true);
    const { jwt: userJwt } = await loginRes.json();

    const createAddressRes = await request.post(`${WORKER_URL}/api/new_address`, {
      headers: { 'x-user-token': userJwt },
      data: { name },
    });
    expect(createAddressRes.ok()).toBe(true);
    const addressBody = await createAddressRes.json();

    expect(addressBody.address).toBe(`empty${name}@${TEST_DOMAIN}`);
    expect(addressBody.jwt).toBeTruthy();
    expect(addressBody.address_id).toBeGreaterThan(0);
  });
});
