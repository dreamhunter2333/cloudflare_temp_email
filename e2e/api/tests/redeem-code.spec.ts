import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  WORKER_URL,
  createTestAddress,
  deleteAddress,
  getAddressSender,
  hashPassword,
} from '../../fixtures/test-helpers';

const ADMIN_HEADERS = { 'x-admin-auth': 'e2e-admin-pass' };

type RedeemType = 'role' | 'send_balance' | 'address_prefix_once';
type AddressRedeemResult = {
  type: 'address_prefix_once';
  address: string;
  address_id: number;
  jwt: string;
  password?: string;
};

const uniqueValue = (label: string) => (
  `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
);

async function createCode(
  request: APIRequestContext,
  type: RedeemType,
  value: string,
  options: { enabled?: boolean; expiresAt?: string } = {},
) {
  const response = await request.post(`${WORKER_URL}/admin/redeem_codes/batch`, {
    headers: ADMIN_HEADERS,
    data: {
      count: 1,
      redeem_type: type,
      value,
      enabled: options.enabled ?? true,
      expires_at: options.expiresAt ?? new Date(Date.now() + 3_600_000).toISOString(),
    },
  });
  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body.codes).toHaveLength(1);
  return body.codes[0] as string;
}

async function listCode(request: APIRequestContext, type: RedeemType, code: string) {
  const response = await request.get(
    `${WORKER_URL}/admin/redeem_codes?redeem_type=${type}`
    + `&limit=100&offset=0&query=${encodeURIComponent(code)}`,
    { headers: ADMIN_HEADERS },
  );
  expect(response.ok()).toBe(true);
  const body = await response.json();
  return body.results.find((row: { code: string }) => row.code === code);
}

async function deleteCode(request: APIRequestContext, type: RedeemType, code: string) {
  const row = await listCode(request, type, code);
  if (!row) return;
  const response = await request.delete(`${WORKER_URL}/admin/redeem_codes/${row.id}`, {
    headers: ADMIN_HEADERS,
  });
  expect(response.ok()).toBe(true);
}

async function queryCode(request: APIRequestContext, code: unknown) {
  return await request.post(`${WORKER_URL}/redeem_api/query`, { data: { code } });
}

async function queryResult(request: APIRequestContext, code: unknown) {
  return await request.post(`${WORKER_URL}/redeem_api/result`, { data: { code } });
}

async function createUser(request: APIRequestContext) {
  const email = `${uniqueValue('redeem-user')}@test.example.com`;
  const createResponse = await request.post(`${WORKER_URL}/admin/users`, {
    headers: ADMIN_HEADERS,
    data: { email, password: hashPassword('redeem-user-password') },
  });
  expect(createResponse.ok()).toBe(true);
  const listResponse = await request.get(
    `${WORKER_URL}/admin/users?limit=10&offset=0&query=${encodeURIComponent(email)}`,
    { headers: ADMIN_HEADERS },
  );
  const user = (await listResponse.json()).results.find(
    (row: { user_email: string }) => row.user_email === email,
  );
  expect(user).toBeTruthy();
  await setUserRole(request, user.id, null);
  return { id: user.id as number, email };
}

async function setUserRole(request: APIRequestContext, userId: number, role: string | null) {
  const response = await request.post(`${WORKER_URL}/admin/user_roles`, {
    headers: ADMIN_HEADERS,
    data: { user_id: userId, role_text: role },
  });
  expect(response.ok()).toBe(true);
}

async function deleteUser(request: APIRequestContext, userId: number) {
  await setUserRole(request, userId, null);
  const response = await request.delete(`${WORKER_URL}/admin/users/${userId}`, {
    headers: ADMIN_HEADERS,
  });
  expect(response.ok()).toBe(true);
}

test.describe('Redemption code query and guards', () => {
  test('previews each supported type without consuming it', async ({ request }) => {
    const roleCode = await createCode(request, 'role', 'case-role');
    const balanceCode = await createCode(request, 'send_balance', '12');
    const addressCode = await createCode(request, 'address_prefix_once', 'vip');
    try {
      const roleResponse = await queryCode(request, roleCode);
      expect(roleResponse.ok()).toBe(true);
      expect(await roleResponse.json()).toEqual({
        redeem_type: 'role', value: 'case-role', status: 'unused',
      });

      const balanceResponse = await queryCode(request, balanceCode);
      expect(balanceResponse.ok()).toBe(true);
      expect(await balanceResponse.json()).toEqual({
        redeem_type: 'send_balance', value: '12', status: 'unused',
      });

      const addressResponse = await queryCode(request, addressCode);
      expect(addressResponse.ok()).toBe(true);
      expect(await addressResponse.json()).toEqual({
        redeem_type: 'address_prefix_once',
        value: 'vip',
        status: 'unused',
      });

      expect((await listCode(request, 'role', roleCode)).redeemed_at).toBeNull();
      expect((await listCode(request, 'send_balance', balanceCode)).redeemed_at).toBeNull();
      expect((await listCode(request, 'address_prefix_once', addressCode)).redeemed_at).toBeNull();
      expect((await listCode(request, 'role', roleCode)).redeemed).toBe(false);
      expect((await listCode(request, 'send_balance', balanceCode)).redeemed).toBe(false);
      expect((await listCode(request, 'address_prefix_once', addressCode)).redeemed).toBe(false);
      expect((await queryResult(request, addressCode)).status()).toBe(400);
    } finally {
      await deleteCode(request, 'role', roleCode);
      await deleteCode(request, 'send_balance', balanceCode);
      await deleteCode(request, 'address_prefix_once', addressCode);
    }
  });

  test('rejects missing, malformed, unknown, and disabled codes, but reports expired codes', async ({ request }) => {
    const disabledCode = await createCode(request, 'role', 'case-role', { enabled: false });
    const expiredCode = await createCode(request, 'role', 'case-role', {
      expiresAt: new Date(Date.now() + 5_000).toISOString(),
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 5_500));
      for (const code of [undefined, null, '', 'x'.repeat(257), uniqueValue('missing')]) {
        expect((await queryCode(request, code)).status()).toBe(400);
      }
      expect((await queryCode(request, disabledCode)).status()).toBe(400);
      const expiredResponse = await queryCode(request, expiredCode);
      expect(expiredResponse.ok()).toBe(true);
      expect(await expiredResponse.json()).toEqual({
        redeem_type: 'role', value: 'case-role', status: 'expired',
      });
    } finally {
      await deleteCode(request, 'role', disabledCode);
      await deleteCode(request, 'role', expiredCode);
    }
  });

  test('rejects malformed JSON request bodies', async ({ request }) => {
    const options = {
      headers: { 'content-type': 'application/json' },
      data: '{',
    };
    for (const path of ['/query', '/result', '/redeem']) {
      const response = await request.post(`${WORKER_URL}/redeem_api${path}`, options);
      expect(response.status()).toBe(400);
    }
  });

  test('uses the code type and does not consume when its required target is missing', async ({ request }) => {
    const code = await createCode(request, 'send_balance', '9');
    try {
      const mismatchResponse = await request.post(`${WORKER_URL}/redeem_api/redeem`, {
        data: { code, user_email: 'nobody@test.example.com' },
      });
      expect(mismatchResponse.status()).toBe(400);
      expect((await queryCode(request, code)).ok()).toBe(true);
      expect((await listCode(request, 'send_balance', code)).redeemed_at).toBeNull();
    } finally {
      await deleteCode(request, 'send_balance', code);
    }
  });
});

test.describe('Role redemption', () => {
  test('concurrent different roles consume only the winning code', async ({ request }) => {
    const user = await createUser(request);
    const roles = ['case-role', 'empty-role'];
    const codes = await Promise.all(roles.map((role) => createCode(request, 'role', role)));
    try {
      const responses = await Promise.all(codes.map((code) => (
        request.post(`${WORKER_URL}/redeem_api/redeem`, {
          data: { code, user_email: user.email },
        })
      )));
      expect(responses.filter((response) => response.ok())).toHaveLength(1);
      expect(responses.filter((response) => response.status() === 409)).toHaveLength(1);
      const winner = responses.findIndex((response) => response.ok());
      const loser = 1 - winner;
      const rows = await Promise.all(codes.map((code) => listCode(request, 'role', code)));
      expect(rows[winner].redeemed).toBe(true);
      expect(rows[loser]).toMatchObject({ redeemed: false, result: null, redeemed_at: null });
      const users = await request.get(
        `${WORKER_URL}/admin/users?limit=10&offset=0&query=${encodeURIComponent(user.email)}`,
        { headers: ADMIN_HEADERS },
      );
      expect((await users.json()).results[0].role_text).toBe(roles[winner]);
    } finally {
      for (const code of codes) await deleteCode(request, 'role', code);
      await deleteUser(request, user.id);
    }
  });

  test('applies a configured role by case-insensitive account email and consumes once', async ({ request }) => {
    const user = await createUser(request);
    const code = await createCode(request, 'role', 'case-role');
    try {
      const response = await request.post(`${WORKER_URL}/redeem_api/redeem`, {
        data: { code, user_email: user.email.toUpperCase() },
      });
      expect(response.ok()).toBe(true);
      expect(await response.json()).toEqual({
        success: true,
        type: 'role',
        role: 'case-role',
        user_email: user.email,
      });

      const userResponse = await request.get(
        `${WORKER_URL}/admin/users?limit=10&offset=0&query=${encodeURIComponent(user.email)}`,
        { headers: ADMIN_HEADERS },
      );
      expect((await userResponse.json()).results[0].role_text).toBe('case-role');

      const row = await listCode(request, 'role', code);
      expect(row.redeemed).toBe(true);
      expect(row.redeemed_at).toEqual(expect.any(String));
      expect(JSON.parse(row.result)).toMatchObject({
        type: 'role',
        user_id: user.id,
        user_email: user.email,
        role: 'case-role',
      });
      const publicResult = await queryResult(request, code);
      expect(publicResult.ok()).toBe(true);
      expect(await publicResult.json()).toEqual({
        type: 'role', role: 'case-role', user_email: user.email,
      });

      const repeatedResponse = await request.post(`${WORKER_URL}/redeem_api/redeem`, {
        data: { code, user_email: user.email },
      });
      expect(repeatedResponse.status()).toBe(400);
      expect(await (await queryCode(request, code)).json()).toEqual({
        redeem_type: 'role', value: 'case-role', status: 'redeemed',
      });
    } finally {
      await deleteCode(request, 'role', code);
      await deleteUser(request, user.id);
    }
  });

  test('accepts the same existing role', async ({ request }) => {
    const user = await createUser(request);
    const code = await createCode(request, 'role', 'case-role');
    try {
      await setUserRole(request, user.id, 'case-role');
      const response = await request.post(`${WORKER_URL}/redeem_api/redeem`, {
        data: { code, user_email: user.email },
      });
      expect(response.ok()).toBe(true);
    } finally {
      await deleteCode(request, 'role', code);
      await deleteUser(request, user.id);
    }
  });

  test('keeps the code unused when the account is missing or has a conflicting role', async ({ request }) => {
    const missingCode = await createCode(request, 'role', 'case-role');
    const conflictCode = await createCode(request, 'role', 'case-role');
    const user = await createUser(request);
    try {
      const missingResponse = await request.post(`${WORKER_URL}/redeem_api/redeem`, {
        data: { code: missingCode, user_email: `${uniqueValue('missing')}@test.example.com` },
      });
      expect(missingResponse.status()).toBe(400);
      expect((await queryCode(request, missingCode)).ok()).toBe(true);

      await setUserRole(request, user.id, 'empty-role');
      const conflictResponse = await request.post(`${WORKER_URL}/redeem_api/redeem`, {
        data: { code: conflictCode, user_email: user.email },
      });
      expect(conflictResponse.status()).toBe(409);
      expect((await queryCode(request, conflictCode)).ok()).toBe(true);
      expect((await listCode(request, 'role', conflictCode)).result).toBeNull();
    } finally {
      await deleteCode(request, 'role', missingCode);
      await deleteCode(request, 'role', conflictCode);
      await deleteUser(request, user.id);
    }
  });
});

test.describe('Sending-credit redemption', () => {
  test('preserves default credits before the mailbox is first opened', async ({ request }) => {
    const address = await createTestAddress(request, 'rcfresh');
    const code = await createCode(request, 'send_balance', '7');
    try {
      const before = await request.get(
        `${WORKER_URL}/admin/address_sender?limit=1&offset=0&address=${encodeURIComponent(address.address)}`,
        { headers: ADMIN_HEADERS },
      );
      expect((await before.json()).results).toHaveLength(0);
      const response = await request.post(`${WORKER_URL}/redeem_api/redeem`, {
        data: { code, address: address.address },
      });
      expect(response.ok()).toBe(true);
      expect(await response.json()).toMatchObject({ amount: 7, balance: 17 });
      for (let index = 0; index < 2; index++) {
        const settings = await request.get(`${WORKER_URL}/api/settings`, {
          headers: { Authorization: `Bearer ${address.jwt}` },
        });
        expect(settings.ok()).toBe(true);
      }
      expect((await getAddressSender(request, address.address)).balance).toBe(17);
    } finally {
      await deleteCode(request, 'send_balance', code);
      await deleteAddress(request, address.jwt);
    }
  });

  test('coalesces NULL balance, preserves disabled state, records result, and consumes once', async ({ request }) => {
    const address = await createTestAddress(request, 'rcnull');
    const code = await createCode(request, 'send_balance', '7');
    try {
      const settingsResponse = await request.get(`${WORKER_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${address.jwt}` },
      });
      expect(settingsResponse.ok()).toBe(true);
      const sender = await getAddressSender(request, address.address);
      const nullResponse = await request.post(`${WORKER_URL}/admin/address_sender`, {
        headers: ADMIN_HEADERS,
        data: {
          address: address.address,
          address_id: sender.id,
          balance: null,
          enabled: false,
        },
      });
      expect(nullResponse.ok()).toBe(true);

      const redeemResponse = await request.post(`${WORKER_URL}/redeem_api/redeem`, {
        data: { code, address: address.address.toUpperCase() },
      });
      expect(redeemResponse.ok()).toBe(true);
      expect(await redeemResponse.json()).toEqual({
        success: true,
        type: 'send_balance',
        address: address.address,
        amount: 7,
        balance: 7,
      });

      const updatedSender = await getAddressSender(request, address.address);
      expect(updatedSender.balance).toBe(7);
      expect(updatedSender.enabled).toBe(0);
      expect(JSON.parse((await listCode(request, 'send_balance', code)).result)).toMatchObject({
        type: 'send_balance',
        address: address.address,
        amount: 7,
      });
      const publicResult = await queryResult(request, code);
      expect(publicResult.ok()).toBe(true);
      expect(await publicResult.json()).toEqual({
        type: 'send_balance', address: address.address, amount: 7,
      });

      const repeatedResponse = await request.post(`${WORKER_URL}/redeem_api/redeem`, {
        data: { code, address: address.address },
      });
      expect(repeatedResponse.status()).toBe(400);
      expect(await (await queryCode(request, code)).json()).toEqual({
        redeem_type: 'send_balance', value: '7', status: 'redeemed',
      });
    } finally {
      await deleteCode(request, 'send_balance', code);
      await deleteAddress(request, address.jwt);
    }
  });

  test('does not consume when the target address is missing', async ({ request }) => {
    const code = await createCode(request, 'send_balance', '5');
    try {
      const response = await request.post(`${WORKER_URL}/redeem_api/redeem`, {
        data: { code, address: `${uniqueValue('missing')}@test.example.com` },
      });
      expect(response.status()).toBe(400);
      expect((await queryCode(request, code)).ok()).toBe(true);
      expect((await listCode(request, 'send_balance', code)).result).toBeNull();
    } finally {
      await deleteCode(request, 'send_balance', code);
    }
  });

  test('concurrent requests add the balance exactly once', async ({ request }) => {
    const address = await createTestAddress(request, 'rcrace');
    const code = await createCode(request, 'send_balance', '5');
    try {
      await request.get(`${WORKER_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${address.jwt}` },
      });
      const before = await getAddressSender(request, address.address);
      const responses = await Promise.all([
        request.post(`${WORKER_URL}/redeem_api/redeem`, {
          data: { code, address: address.address },
        }),
        request.post(`${WORKER_URL}/redeem_api/redeem`, {
          data: { code, address: address.address },
        }),
      ]);
      expect(responses.filter((response) => response.ok())).toHaveLength(1);
      expect(responses.filter((response) => [400, 409].includes(response.status()))).toHaveLength(1);
      expect((await getAddressSender(request, address.address)).balance).toBe(before.balance + 5);
    } finally {
      await deleteCode(request, 'send_balance', code);
      await deleteAddress(request, address.jwt);
    }
  });
});

test.describe('Special-address redemption', () => {
  test('uses the redemption prefix without the system prefix and repeats the complete original result', async ({ request }) => {
    const code = await createCode(request, 'address_prefix_once', 'vip');
    const name = `a${Math.random().toString(36).slice(2, 8)}`;
    let result: AddressRedeemResult | undefined;
    try {
      const firstResponse = await request.post(`${WORKER_URL}/redeem_api/redeem`, {
        data: { code, name, domain: 'TEST.EXAMPLE.COM' },
      });
      expect(firstResponse.ok()).toBe(true);
      result = await firstResponse.json();
      expect(result).toMatchObject({
        type: 'address_prefix_once',
        address: `vip${name}@test.example.com`,
        address_id: expect.any(Number),
        jwt: expect.any(String),
        password: expect.any(String),
      });
      expect(result.address).not.toContain('tmpvip');

      const repeatedResponse = await request.post(`${WORKER_URL}/redeem_api/redeem`, {
        data: { code, name: 'ignored', domain: 'manual.example.com' },
      });
      expect(repeatedResponse.ok()).toBe(true);
      expect(await repeatedResponse.json()).toEqual(result);

      const previewResponse = await queryCode(request, code);
      expect(previewResponse.ok()).toBe(true);
      const preview = await previewResponse.json();
      expect(preview).toEqual({
        redeem_type: 'address_prefix_once', value: 'vip', status: 'redeemed',
      });
      const publicResult = await queryResult(request, code);
      expect(publicResult.ok()).toBe(true);
      expect(await publicResult.json()).toEqual({
        type: 'address_prefix_once',
        address: result.address,
        jwt: result.jwt,
        password: result.password,
      });
      const row = await listCode(request, 'address_prefix_once', code);
      expect(JSON.parse(row.result)).toEqual(result);
    } finally {
      if (result?.jwt) await deleteAddress(request, result.jwt);
      await deleteCode(request, 'address_prefix_once', code);
    }
  });

  test('supports an empty prefix and the longest usable prefix', async ({ request }) => {
    const emptyCode = await createCode(request, 'address_prefix_once', '');
    const maxCode = await createCode(request, 'address_prefix_once', 'a'.repeat(29));
    const emptyName = `n${Math.random().toString(36).slice(2, 8)}`;
    let emptyResult: AddressRedeemResult | undefined;
    let maxResult: AddressRedeemResult | undefined;
    try {
      const emptyResponse = await request.post(`${WORKER_URL}/redeem_api/redeem`, {
        data: { code: emptyCode, name: emptyName, domain: 'test.example.com' },
      });
      expect(emptyResponse.ok()).toBe(true);
      emptyResult = await emptyResponse.json();
      expect(emptyResult.address).toBe(`${emptyName}@test.example.com`);

      const maxResponse = await request.post(`${WORKER_URL}/redeem_api/redeem`, {
        data: { code: maxCode, name: 'z', domain: 'test.example.com' },
      });
      expect(maxResponse.ok()).toBe(true);
      maxResult = await maxResponse.json();
      expect(maxResult.address.split('@')[0]).toBe(`${'a'.repeat(29)}z`);
    } finally {
      if (emptyResult?.jwt) await deleteAddress(request, emptyResult.jwt);
      if (maxResult?.jwt) await deleteAddress(request, maxResult.jwt);
      await deleteCode(request, 'address_prefix_once', emptyCode);
      await deleteCode(request, 'address_prefix_once', maxCode);
    }
  });

  test('keeps length and domain validation without consuming failed codes', async ({ request }) => {
    const lengthCode = await createCode(request, 'address_prefix_once', 'a'.repeat(29));
    const domainCode = await createCode(request, 'address_prefix_once', 'vip');
    try {
      const lengthResponse = await request.post(`${WORKER_URL}/redeem_api/redeem`, {
        data: { code: lengthCode, name: 'zz', domain: 'test.example.com' },
      });
      expect(lengthResponse.status()).toBe(400);

      const domainResponse = await request.post(`${WORKER_URL}/redeem_api/redeem`, {
        data: { code: domainCode, name: 'valid', domain: 'invalid.example.com' },
      });
      expect(domainResponse.status()).toBe(400);

      expect((await queryCode(request, lengthCode)).ok()).toBe(true);
      expect((await queryCode(request, domainCode)).ok()).toBe(true);
    } finally {
      await deleteCode(request, 'address_prefix_once', lengthCode);
      await deleteCode(request, 'address_prefix_once', domainCode);
    }
  });

  test('generates a valid random suffix when the user omits the name', async ({ request }) => {
    const code = await createCode(request, 'address_prefix_once', 'rnd');
    let result: AddressRedeemResult | undefined;
    try {
      const response = await request.post(`${WORKER_URL}/redeem_api/redeem`, {
        data: { code, domain: 'test.example.com' },
      });
      expect(response.ok()).toBe(true);
      result = await response.json();
      const localPart = result.address.split('@')[0];
      expect(localPart.startsWith('rnd')).toBe(true);
      expect(localPart.length).toBeLessThanOrEqual(30);
      expect(localPart.length).toBeGreaterThan(3);
    } finally {
      if (result?.jwt) await deleteAddress(request, result.jwt);
      await deleteCode(request, 'address_prefix_once', code);
    }
  });

  test('does not return an address result after its original address is removed', async ({ request }) => {
    const code = await createCode(request, 'address_prefix_once', 'removed');
    try {
      const firstResponse = await request.post(`${WORKER_URL}/redeem_api/redeem`, {
        data: { code, name: 'mail', domain: 'test.example.com' },
      });
      const first = await firstResponse.json();
      await deleteAddress(request, first.jwt);

      const repeatResponse = await request.post(`${WORKER_URL}/redeem_api/redeem`, {
        data: { code, name: 'ignored', domain: 'test.example.com' },
      });
      expect(repeatResponse.status()).toBe(400);
      const resultResponse = await request.post(`${WORKER_URL}/redeem_api/result`, {
        data: { code },
      });
      expect(resultResponse.status()).toBe(400);
    } finally {
      await deleteCode(request, 'address_prefix_once', code);
    }
  });

  test('concurrent creations converge on one complete result', async ({ request }) => {
    const code = await createCode(request, 'address_prefix_once', 'race');
    let result: AddressRedeemResult | undefined;
    try {
      const responses = await Promise.all([
        request.post(`${WORKER_URL}/redeem_api/redeem`, {
          data: { code, name: `a${Math.random().toString(36).slice(2, 7)}`, domain: 'test.example.com' },
        }),
        request.post(`${WORKER_URL}/redeem_api/redeem`, {
          data: { code, name: `b${Math.random().toString(36).slice(2, 7)}`, domain: 'test.example.com' },
        }),
      ]);
      expect(responses.every((response) => response.ok())).toBe(true);
      const results = await Promise.all(responses.map((response) => response.json()));
      expect(results[1]).toEqual(results[0]);
      result = results[0];
      expect(result.password).toEqual(expect.any(String));
      expect(JSON.parse((await listCode(request, 'address_prefix_once', code)).result)).toEqual(result);
    } finally {
      if (result?.jwt) await deleteAddress(request, result.jwt);
      await deleteCode(request, 'address_prefix_once', code);
    }
  });

  test('expiry stops retrieval of an existing result', async ({ request }) => {
    const expiredCode = await createCode(request, 'address_prefix_once', 'exp', {
      expiresAt: new Date(Date.now() + 5_000).toISOString(),
    });
    let expiredResult: AddressRedeemResult | undefined;
    try {
      expiredResult = await (await request.post(`${WORKER_URL}/redeem_api/redeem`, {
        data: { code: expiredCode, name: 'mail', domain: 'test.example.com' },
      })).json();
      await new Promise((resolve) => setTimeout(resolve, 5_500));

      expect((await request.post(`${WORKER_URL}/redeem_api/redeem`, {
        data: { code: expiredCode },
      })).status()).toBe(400);
      expect(await (await queryCode(request, expiredCode)).json()).toMatchObject({ status: 'expired' });
      expect((await queryResult(request, expiredCode)).status()).toBe(400);
    } finally {
      if (expiredResult?.jwt) await deleteAddress(request, expiredResult.jwt);
      await deleteCode(request, 'address_prefix_once', expiredCode);
    }
  });
});
