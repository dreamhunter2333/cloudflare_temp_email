import { test, expect } from '@playwright/test';
import { WORKER_URL, createTestAddress, deleteAddress, hashPassword } from '../../fixtures/test-helpers';

test.describe('Address Password Login', () => {
  test('set password then login with it', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'pwd-login');
    const passwordHash = hashPassword('test-password-123');

    try {
      // Set a password on the address
      const changePwdRes = await request.post(`${WORKER_URL}/api/address_change_password`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: { new_password: passwordHash },
      });
      expect(changePwdRes.ok()).toBe(true);
      const changePwdBody = await changePwdRes.json();
      expect(changePwdBody.success).toBe(true);

      // Login with the correct password
      const loginRes = await request.post(`${WORKER_URL}/api/address_login`, {
        data: { email: address, password: passwordHash },
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
      const settings = await settingsRes.json();
      expect(settings.type).toBe('address_password_login');
      expect(settings.exp - settings.iat).toBe(30 * 24 * 60 * 60);
      expect(settings.new_address_token).toBeNull();
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('login with wrong password returns 401', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'pwd-wrong');
    const passwordHash = hashPassword('correct-password');

    try {
      // Set a password
      const changePwdRes = await request.post(`${WORKER_URL}/api/address_change_password`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: { new_password: passwordHash },
      });
      expect(changePwdRes.ok()).toBe(true);
      const changePwdBody = await changePwdRes.json();
      expect(changePwdBody.success).toBe(true);

      // Login with wrong password
      const loginRes = await request.post(`${WORKER_URL}/api/address_login`, {
        data: { email: address, password: hashPassword('wrong-password') },
      });
      expect(loginRes.status()).toBe(401);
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('admin reset stores frontend-hashed address password', async ({ request }) => {
    const { jwt, address, address_id } = await createTestAddress(request, 'pwd-admin-reset');
    const plainPassword = `admin-reset-${Date.now()}`;
    const passwordHash = hashPassword(plainPassword);

    try {
      const resetRes = await request.post(`${WORKER_URL}/admin/address/${address_id}/reset_password`, {
        data: { password: passwordHash },
      });
      expect(resetRes.ok()).toBe(true);
      await expect(resetRes.json()).resolves.toMatchObject({ success: true });

      const plaintextLoginRes = await request.post(`${WORKER_URL}/api/address_login`, {
        data: { email: address, password: plainPassword },
      });
      expect(plaintextLoginRes.status()).toBe(401);

      const loginRes = await request.post(`${WORKER_URL}/api/address_login`, {
        data: { email: address, password: passwordHash },
      });
      expect(loginRes.ok()).toBe(true);
      const loginBody = await loginRes.json();
      expect(loginBody.jwt).toBeTruthy();
      expect(loginBody.address).toBe(address);
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('admin address list does not expose stored password hash', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'pwd-list-hidden');
    const passwordHash = hashPassword('list-hidden-password');

    try {
      const changePwdRes = await request.post(`${WORKER_URL}/api/address_change_password`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: { new_password: passwordHash },
      });
      expect(changePwdRes.ok()).toBe(true);

      const listRes = await request.get(
        `${WORKER_URL}/admin/address?limit=10&offset=0&query=${encodeURIComponent(address)}`
      );
      expect(listRes.ok()).toBe(true);
      const listBody = await listRes.json();
      const listedAddress = listBody.results.find((row: { name: string }) => row.name === address);
      expect(listedAddress).toBeTruthy();
      expect(listedAddress).not.toHaveProperty('password');
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('user bind address list does not expose stored password hash', async ({ request }) => {
    const userEmail = `pwd-bind-hidden-${Date.now()}@test.example.com`;
    const userPasswordHash = hashPassword('bind-hidden-user-password');
    const { jwt, address } = await createTestAddress(request, 'pwd-bind-hidden');
    const addressPasswordHash = hashPassword('bind-hidden-address-password');

    try {
      const enableRes = await request.post(`${WORKER_URL}/admin/user_settings`, {
        data: {
          enable: true,
          enableMailVerify: false,
        },
      });
      expect(enableRes.ok()).toBe(true);

      const registerRes = await request.post(`${WORKER_URL}/user_api/register`, {
        data: { email: userEmail, password: userPasswordHash },
      });
      expect(registerRes.ok()).toBe(true);

      const loginRes = await request.post(`${WORKER_URL}/user_api/login`, {
        data: { email: userEmail, password: userPasswordHash },
      });
      expect(loginRes.ok()).toBe(true);
      const { jwt: userJwt } = await loginRes.json();

      const changePwdRes = await request.post(`${WORKER_URL}/api/address_change_password`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: { new_password: addressPasswordHash },
      });
      expect(changePwdRes.ok()).toBe(true);

      const bindRes = await request.post(`${WORKER_URL}/user_api/bind_address`, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'x-user-token': userJwt,
        },
      });
      expect(bindRes.ok()).toBe(true);

      const listRes = await request.get(`${WORKER_URL}/user_api/bind_address`, {
        headers: { 'x-user-token': userJwt },
      });
      expect(listRes.ok()).toBe(true);
      const listBody = await listRes.json();
      const listedAddress = listBody.results.find((row: { name: string }) => row.name === address);
      expect(listedAddress).toBeTruthy();
      expect(listedAddress).not.toHaveProperty('password');
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('users can reset a mailbox password only while it is bound to them', async ({ request }) => {
    const { jwt, address, address_id } = await createTestAddress(request, 'pwd-user-reset');
    const email = `pwd-reset-user-${Date.now()}@test.example.com`;
    const password = hashPassword('password-reset-user');
    const newPassword = hashPassword('replacement-mailbox-password');
    try {
      const enable = await request.post(`${WORKER_URL}/admin/user_settings`, {
        data: { enable: true, enableMailVerify: false },
      });
      expect(enable.ok()).toBe(true);
      const register = await request.post(`${WORKER_URL}/user_api/register`, { data: { email, password } });
      expect(register.ok()).toBe(true);
      const login = await request.post(`${WORKER_URL}/user_api/login`, { data: { email, password } });
      expect(login.ok()).toBe(true);
      const { jwt: userJwt } = await login.json();
      const headers = { 'x-user-token': userJwt };
      const reset = (value = newPassword) => request.post(`${WORKER_URL}/user_api/address/${address_id}/reset_password`, {
        headers, data: { new_password: value },
      });
      expect((await reset()).status()).toBe(403);
      const bind = await request.post(`${WORKER_URL}/user_api/bind_address`, {
        headers: { ...headers, Authorization: `Bearer ${jwt}` },
      });
      expect(bind.ok()).toBe(true);
      expect((await reset('plaintext')).status()).toBe(400);
      expect((await reset()).ok()).toBe(true);
      const mailboxLogin = await request.post(`${WORKER_URL}/api/address_login`, {
        data: { email: address, password: newPassword },
      });
      expect(mailboxLogin.ok()).toBe(true);
      const unbind = await request.post(`${WORKER_URL}/user_api/unbind_address`, {
        headers, data: { address_id },
      });
      expect(unbind.ok()).toBe(true);
      expect((await reset()).status()).toBe(403);
    } finally {
      await deleteAddress(request, jwt);
    }
  });
});
