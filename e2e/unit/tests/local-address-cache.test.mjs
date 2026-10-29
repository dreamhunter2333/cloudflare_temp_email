import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sign } from 'hono/jwt';
import { decodeAddressToken, updateLocalAddressCache } from '../../../frontend/src/utils/local-address-cache.ts';

for (const address of ['percent%mail@example.com', '用户@example.com']) {
  test(`decoded mailbox strings preserve labels and renewal deduplication: ${address}`, async () => {
    const identity = { address, address_id: 1 };
    const legacy = await sign(identity, 'cache-test-secret', 'HS256');
    const session = iat => sign({ ...identity, type: 'address_password_login', iat, exp: iat + 100 }, 'cache-test-secret', 'HS256');
    const old = await session(1);
    const duplicate = await session(2);
    const renewed = await session(3);
    assert.equal(decodeAddressToken(old).address, address);
    assert.deepEqual(updateLocalAddressCache([legacy, old, duplicate], old, {
      address, type: 'address_password_login', new_address_token: renewed,
    }), [legacy, renewed]);
  });
}
