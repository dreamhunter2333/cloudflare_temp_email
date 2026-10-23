import { expect, test, type APIRequestContext } from '@playwright/test';
import { deleteAddress, WORKER_URL } from '../../fixtures/test-helpers';

const ADMIN_HEADERS = { 'x-admin-auth': 'e2e-admin-pass' };
const MAX_BATCH_SIZE = 500;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type RedeemType = 'role' | 'send_balance' | 'address_prefix_once';

async function createCodes(
  request: APIRequestContext,
  {
    count = 1,
    type = 'role',
    value = 'case-role',
    enabled = true,
    expiresAt = new Date(Date.now() + 3_600_000).toISOString(),
  }: {
    count?: unknown;
    type?: string;
    value?: unknown;
    enabled?: unknown;
    expiresAt?: unknown;
  },
) {
  return await request.post(`${WORKER_URL}/admin/redeem_codes/batch`, {
    headers: ADMIN_HEADERS,
    data: {
      count,
      redeem_type: type,
      value,
      enabled,
      expires_at: expiresAt,
    },
  });
}

async function listCodes(
  request: APIRequestContext,
  type: RedeemType,
  query = '',
) {
  const response = await request.get(
    `${WORKER_URL}/admin/redeem_codes?redeem_type=${type}&limit=100&offset=0`
    + (query ? `&query=${encodeURIComponent(query)}` : ''),
    { headers: ADMIN_HEADERS },
  );
  expect(response.ok()).toBe(true);
  return await response.json();
}

async function deleteCode(request: APIRequestContext, id: number) {
  const response = await request.delete(`${WORKER_URL}/admin/redeem_codes/${id}`, {
    headers: ADMIN_HEADERS,
  });
  expect(response.ok()).toBe(true);
}

test.describe('Redemption code Admin API', () => {
  test('rejects malformed JSON when creating codes', async ({ request }) => {
    const response = await request.post(`${WORKER_URL}/admin/redeem_codes/batch`, {
      headers: { ...ADMIN_HEADERS, 'content-type': 'application/json' },
      data: '{',
    });
    expect(response.status()).toBe(400);
  });

  test('reports the enabled switch and exposes the migrated table', async ({ request }) => {
    const settingsResponse = await request.get(`${WORKER_URL}/open_api/settings`);
    expect(settingsResponse.ok()).toBe(true);
    expect((await settingsResponse.json()).enableRedeemCode).toBe(true);

    const listResponse = await request.get(
      `${WORKER_URL}/admin/redeem_codes?redeem_type=role&limit=20&offset=0`,
      { headers: ADMIN_HEADERS },
    );
    expect(listResponse.ok()).toBe(true);
    await expect(listResponse.json()).resolves.toMatchObject({
      results: expect.any(Array),
      count: expect.any(Number),
    });
  });

  test('batch generates UUIDs, filters by type, updates, and deletes', async ({ request }) => {
    const createResponse = await createCodes(request, { count: 2 });
    expect(createResponse.ok()).toBe(true);
    const created = await createResponse.json();
    expect(created).toMatchObject({ success: true, created: 2 });
    expect(created.codes).toHaveLength(2);
    expect(new Set(created.codes).size).toBe(2);
    expect(created.codes.every((code: string) => UUID_V4_PATTERN.test(code))).toBe(true);
    const [firstCode, secondCode] = created.codes as string[];
    const queryPrefix = firstCode.slice(0, 8);

    const roleList = await listCodes(request, 'role', queryPrefix);
    expect(roleList.count).toBe(1);
    expect(roleList.results[0]).toMatchObject({
      code: firstCode,
      redeem_type: 'role',
      value: 'case-role',
      enabled: 1,
      redeemed: false,
      result: null,
    });
    const balanceList = await listCodes(request, 'send_balance', queryPrefix);
    expect(balanceList.count).toBe(0);

    const firstId = roleList.results[0].id as number;
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();
    const updateResponse = await request.put(`${WORKER_URL}/admin/redeem_codes/${firstId}`, {
      headers: ADMIN_HEADERS,
      data: {
        redeem_type: 'role',
        value: 'empty-role',
        enabled: false,
        expires_at: expiresAt,
      },
    });
    expect(updateResponse.ok()).toBe(true);

    const updatedList = await listCodes(request, 'role', firstCode);
    expect(updatedList.count).toBe(1);
    expect(updatedList.results[0]).toMatchObject({
      id: firstId,
      code: firstCode,
      value: 'empty-role',
      enabled: 0,
    });
    expect(updatedList.results[0].expires_at).toEqual(expect.any(String));

    const secondList = await listCodes(request, 'role', secondCode);
    await deleteCode(request, firstId);
    await deleteCode(request, secondList.results[0].id);
    expect((await listCodes(request, 'role', firstCode)).count).toBe(0);
  });

  test('normalizes typed values and accepts both empty and maximum usable prefixes', async ({ request }) => {
    const emptyResponse = await createCodes(request, {
      type: 'address_prefix_once',
      value: '   ',
    });
    expect(emptyResponse.ok()).toBe(true);
    const emptyCode = (await emptyResponse.json()).codes[0] as string;
    const maxResponse = await createCodes(request, {
      type: 'address_prefix_once',
      value: `  ${'A'.repeat(29)}  `,
    });
    expect(maxResponse.ok()).toBe(true);
    const maxCode = (await maxResponse.json()).codes[0] as string;
    const balanceResponse = await createCodes(request, {
      type: 'send_balance',
      value: ' 42 ',
    });
    expect(balanceResponse.ok()).toBe(true);
    const balanceCode = (await balanceResponse.json()).codes[0] as string;

    const emptyRow = (await listCodes(request, 'address_prefix_once', emptyCode)).results[0];
    const maxRow = (await listCodes(request, 'address_prefix_once', maxCode)).results[0];
    const balanceRow = (await listCodes(request, 'send_balance', balanceCode)).results[0];
    expect(emptyRow.value).toBe('');
    expect(maxRow.value).toBe('a'.repeat(29));
    expect(balanceRow.value).toBe('42');
    await deleteCode(request, emptyRow.id);
    await deleteCode(request, maxRow.id);
    await deleteCode(request, balanceRow.id);
  });

  test('rejects every invalid batch shape and typed business value', async ({ request }) => {
    const invalidRequests = [
      { type: 'unknown', value: 'x' },
      { type: 'role', value: '' },
      { type: 'role', value: 'missing-role' },
      { type: 'role', value: 'admin' },
      { type: 'send_balance', value: '0' },
      { type: 'send_balance', value: '-1' },
      { type: 'send_balance', value: '1.5' },
      { type: 'send_balance', value: '1000000001' },
      { type: 'address_prefix_once', value: 'bad-' },
      { type: 'address_prefix_once', value: 'a'.repeat(30) },
      { count: 0 },
      { count: -1 },
      { count: 1.5 },
      { count: MAX_BATCH_SIZE + 1 },
      { count: '1' },
      { count: null },
      { enabled: 'yes' },
      { value: 1 },
      { expiresAt: null },
      { expiresAt: '' },
      { expiresAt: 'not-a-date' },
      { expiresAt: new Date(Date.now() - 60_000).toISOString() },
    ];

    for (const invalidRequest of invalidRequests) {
      const response = await createCodes(request, invalidRequest);
      expect(response.status(), JSON.stringify(invalidRequest)).toBe(400);
    }
  });

  test('rejects invalid updates and IDs', async ({ request }) => {
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();
    const createResponse = await createCodes(request, { count: 2 });
    expect(createResponse.ok()).toBe(true);
    const [firstCode, secondCode] = (await createResponse.json()).codes as string[];
    const firstRow = (await listCodes(request, 'role', firstCode)).results[0];
    const secondRow = (await listCodes(request, 'role', secondCode)).results[0];

    const invalidId = await request.put(`${WORKER_URL}/admin/redeem_codes/${firstRow.id}x`, {
      headers: ADMIN_HEADERS,
      data: { redeem_type: 'role', value: 'case-role', enabled: true, expires_at: expiresAt },
    });
    expect(invalidId.status()).toBe(400);

    const invalidRole = await request.put(`${WORKER_URL}/admin/redeem_codes/${firstRow.id}`, {
      headers: ADMIN_HEADERS,
      data: { redeem_type: 'role', value: 'admin', enabled: true, expires_at: expiresAt },
    });
    expect(invalidRole.status()).toBe(400);

    const wrongType = await request.put(`${WORKER_URL}/admin/redeem_codes/${firstRow.id}`, {
      headers: ADMIN_HEADERS,
      data: {
        redeem_type: 'send_balance',
        value: '1',
        enabled: true,
        expires_at: expiresAt,
      },
    });
    expect(wrongType.status()).toBe(404);

    const invalidDelete = await request.delete(`${WORKER_URL}/admin/redeem_codes/${firstRow.id}x`, {
      headers: ADMIN_HEADERS,
    });
    expect(invalidDelete.status()).toBe(400);

    await deleteCode(request, firstRow.id);
    await deleteCode(request, secondRow.id);
  });

  test('does not update a redeemed code', async ({ request }) => {
    let code = '';
    let addressResult: { jwt?: string } | undefined;
    try {
      const createResponse = await createCodes(request, {
        type: 'address_prefix_once',
        value: 'locked',
      });
      expect(createResponse.ok()).toBe(true);
      code = (await createResponse.json()).codes[0] as string;

      const redeemResponse = await request.post(`${WORKER_URL}/redeem_api/redeem`, {
        data: { code, name: 'mail', domain: 'test.example.com' },
      });
      expect(redeemResponse.ok()).toBe(true);
      addressResult = await redeemResponse.json();

      const row = (await listCodes(request, 'address_prefix_once', code)).results[0];
      expect(row.redeemed).toBe(true);
      expect(row.redeemed_at).toEqual(expect.any(String));
      const updateResponse = await request.put(`${WORKER_URL}/admin/redeem_codes/${row.id}`, {
        headers: ADMIN_HEADERS,
        data: {
          redeem_type: 'address_prefix_once',
          value: 'changed',
          enabled: false,
          expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        },
      });
      expect(updateResponse.status()).toBe(409);

      const unchanged = (await listCodes(request, 'address_prefix_once', code)).results[0];
      expect(unchanged).toMatchObject({
        code,
        value: 'locked',
        enabled: 1,
        redeemed: true,
      });
      await deleteCode(request, row.id);
    } finally {
      if (addressResult?.jwt) await deleteAddress(request, addressResult.jwt);
      const row = (await listCodes(request, 'address_prefix_once', code)).results[0];
      if (row) await deleteCode(request, row.id);
    }
  });

  test('exports one selected type with its business columns and enforces the limit', async ({ request }) => {
    const roleResponse = await createCodes(request, {});
    expect(roleResponse.ok()).toBe(true);
    const roleCode = (await roleResponse.json()).codes[0] as string;
    const balanceResponse = await createCodes(request, {
      type: 'send_balance',
      value: '25',
    });
    expect(balanceResponse.ok()).toBe(true);
    const balanceCode = (await balanceResponse.json()).codes[0] as string;

    const roleExport = await request.get(
      `${WORKER_URL}/admin/redeem_codes/export?redeem_type=role&limit=100`,
      { headers: ADMIN_HEADERS },
    );
    expect(roleExport.ok()).toBe(true);
    expect(roleExport.headers()['content-type']).toContain('text/csv');
    expect(roleExport.headers()['content-disposition']).toContain('redeem-codes-role.csv');
    const roleCsv = await roleExport.text();
    expect(roleCsv).toContain('role,redeemed_user_id');
    expect(roleCsv).toContain(roleCode);
    expect(roleCsv).not.toContain(balanceCode);

    const balanceExport = await request.get(
      `${WORKER_URL}/admin/redeem_codes/export?redeem_type=send_balance&limit=100`,
      { headers: ADMIN_HEADERS },
    );
    const balanceCsv = await balanceExport.text();
    expect(balanceCsv).toContain('amount,target_address');
    expect(balanceCsv).toContain(balanceCode);
    expect(balanceCsv).not.toContain(roleCode);

    for (const query of [
      'redeem_type=unknown&limit=1',
      'redeem_type=role&limit=0',
      'redeem_type=role&limit=10001',
      'redeem_type=role&limit=1x',
      'redeem_type=role',
    ]) {
      const response = await request.get(`${WORKER_URL}/admin/redeem_codes/export?${query}`, {
        headers: ADMIN_HEADERS,
      });
      expect(response.status(), query).toBe(400);
    }

    const roleRow = (await listCodes(request, 'role', roleCode)).results[0];
    const balanceRow = (await listCodes(request, 'send_balance', balanceCode)).results[0];
    await deleteCode(request, roleRow.id);
    await deleteCode(request, balanceRow.id);
  });
});
