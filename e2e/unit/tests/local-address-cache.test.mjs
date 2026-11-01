import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sign } from 'hono/jwt';
import { decodeAddressToken } from '../../../frontend/src/utils/local-address-cache.ts';

for (const address of ['percent%mail@example.com', '用户@example.com']) {
  test(`decoded mailbox strings preserve labels: ${address}`, async () => {
    const payload = { address, address_id: 1, type: 'address_password_login' };
    const token = await sign(payload, 'cache-test-secret', 'HS256');
    assert.deepEqual(decodeAddressToken(token), payload);
  });
}
