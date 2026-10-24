import { expect, test, type APIRequestContext } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { sign, verify } from 'hono/jwt';

import { WORKER_URL, TEST_DOMAIN, createTestAddress, seedTestMail, deleteAddress } from '../../fixtures/test-helpers';

function initData(userId: number) {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: userId }),
  };
  const key = createHmac('sha256', 'WebAppData').update('e2e-telegram-test-token').digest();
  const hash = createHmac('sha256', key)
    .update(Object.entries(fields).map(([name, value]) => `${name}=${value}`).join('\n'))
    .digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

async function bind(request: APIRequestContext, userId: number, jwt: string) {
  const response = await request.post(`${WORKER_URL}/telegram/bind_address`, {
    data: { initData: initData(userId), jwt },
  });
  expect(response.ok(), await response.text()).toBe(true);
}

async function unbind(request: APIRequestContext, userId: number, address: string, status = 200) {
  const response = await request.post(`${WORKER_URL}/telegram/unbind_address`, {
    data: { initData: initData(userId), address },
  });
  expect(response.status(), await response.text()).toBe(status);
}

async function addressList(request: APIRequestContext, userId: number) {
  const response = await request.post(`${WORKER_URL}/telegram/get_bind_address`, {
    data: { initData: initData(userId) },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}

async function expectPushOwner(request: APIRequestContext, address: string, userId: number | null) {
  const response = await request.get(`${WORKER_URL}/__test/telegram_binding`, {
    params: { address },
  });
  expect(response.ok(), await response.text()).toBe(true);
  expect(await response.json()).toBe(userId === null ? null : String(userId));
}

test('admin deletion frees a Telegram binding slot and preserves other bindings', async ({ request }) => {
  const owner = Date.now();
  const mailboxes: Awaited<ReturnType<typeof createTestAddress>>[] = [];
  try {
    for (let index = 0; index < 5; index++) {
      const mailbox = await createTestAddress(request, `tg-admin-${index}-`);
      mailboxes.push(mailbox);
      await bind(request, owner, mailbox.jwt);
    }
    const deleted = mailboxes[0];
    const deletion = await request.delete(`${WORKER_URL}/admin/delete_address/${deleted.address_id}`);
    expect(deletion.ok(), await deletion.text()).toBe(true);
    await expectPushOwner(request, deleted.address, null);
    const stored = await request.get(`${WORKER_URL}/__test/telegram_binding`, {
      params: { userId: String(owner) },
    });
    expect(stored.ok()).toBe(true);
    expect(await stored.json()).toHaveLength(4);
    expect(await addressList(request, owner)).toEqual(
      mailboxes.slice(1).map(({ address, jwt }) => ({ address, jwt })),
    );
    for (const mailbox of mailboxes.slice(1)) await expectPushOwner(request, mailbox.address, owner);

    const replacement = await createTestAddress(request, 'tg-replacement');
    mailboxes.push(replacement);
    await bind(request, owner, replacement.jwt);
    expect(await addressList(request, owner)).toHaveLength(5);

    const [name, domain] = deleted.address.split('@');
    const creation = await request.post(`${WORKER_URL}/admin/new_address`, {
      data: { name, domain, enablePrefix: false },
    });
    expect(creation.ok(), await creation.text()).toBe(true);
    const recreated = await creation.json();
    mailboxes.push(recreated);
    expect(recreated.address_id).not.toBe(deleted.address_id);
    await expectPushOwner(request, recreated.address, null);
  } finally {
    for (const mailbox of mailboxes) {
      await request.delete(`${WORKER_URL}/admin/delete_address/${mailbox.address_id}`);
    }
  }
});

for (const failure of ['result', 'throw']) {
  test(`failed database deletion leaves the mailbox available for retry (${failure})`, async ({ request }) => {
    const mailbox = await createTestAddress(request, 'tg-admin-failure');
    const owner = Date.now();
    try {
      await bind(request, owner, mailbox.jwt);
      const deletion = await request.delete(`${WORKER_URL}/admin/delete_address/${mailbox.address_id}`, {
        headers: { 'x-test-fail-db-batch': failure },
      });
      expect(deletion.status()).toBe(500);
      const settings = await request.get(`${WORKER_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${mailbox.jwt}` },
      });
      expect(settings.ok()).toBe(true);
      await expectPushOwner(request, mailbox.address, null);
      const stored = await request.get(`${WORKER_URL}/__test/telegram_binding`, {
        params: { userId: String(owner) },
      });
      expect(stored.ok()).toBe(true);
      expect(await stored.json()).toEqual([]);
      expect(await addressList(request, owner)).toEqual([]);
      const retry = await request.delete(`${WORKER_URL}/admin/delete_address/${mailbox.address_id}`);
      expect(retry.ok(), await retry.text()).toBe(true);
      const deletedSettings = await request.get(`${WORKER_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${mailbox.jwt}` },
      });
      expect(deletedSettings.status()).toBe(401);
    } finally {
      await request.delete(`${WORKER_URL}/admin/delete_address/${mailbox.address_id}`);
    }
  });
}

for (const failure of ['get', 'put', 'delete', 'delete-after']) {
  test(`admin deletion can retry after KV cleanup fails (${failure})`, async ({ request }) => {
    const mailbox = await createTestAddress(request, 'tg-kv-failure');
    const unrelated = await createTestAddress(request, 'tg-kv-other');
    const owner = Date.now();
    try {
      await bind(request, owner, mailbox.jwt);
      await bind(request, owner, unrelated.jwt);
      const deletion = await request.delete(`${WORKER_URL}/admin/delete_address/${mailbox.address_id}`, {
        headers: { 'x-test-fail-kv': failure },
      });
      expect(deletion.status()).toBe(500);
      const settings = await request.get(`${WORKER_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${mailbox.jwt}` },
      });
      expect(settings.ok()).toBe(true);
      await expectPushOwner(request, mailbox.address, failure === 'delete-after' ? null : owner);
      const stored = await request.get(`${WORKER_URL}/__test/telegram_binding`, {
        params: { userId: String(owner) },
      });
      expect(stored.ok()).toBe(true);
      expect(await stored.json()).toHaveLength(failure === 'get' || failure === 'put' ? 2 : 1);

      const retry = await request.delete(`${WORKER_URL}/admin/delete_address/${mailbox.address_id}`);
      expect(retry.ok(), await retry.text()).toBe(true);
      const deletedSettings = await request.get(`${WORKER_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${mailbox.jwt}` },
      });
      expect(deletedSettings.status()).toBe(401);
      await expectPushOwner(request, mailbox.address, null);
      expect(await addressList(request, owner)).toEqual([{ address: unrelated.address, jwt: unrelated.jwt }]);
      await expectPushOwner(request, unrelated.address, owner);
    } finally {
      for (const address of [mailbox, unrelated]) {
        await request.delete(`${WORKER_URL}/admin/delete_address/${address.address_id}`);
      }
    }
  });
}

for (const action of ['bind', 'create']) {
  test(`Telegram ${action} stores an internal token and returns a mailbox credential`, async ({ request }) => {
    const owner = Date.now();
    let mailbox: { address: string; address_id: number; jwt: string };
    if (action === 'create') {
      const response = await request.post(`${WORKER_URL}/telegram/new_address`, {
        data: { initData: initData(owner), address: `tg-created-${owner}@${TEST_DOMAIN}` },
      });
      expect(response.ok(), await response.text()).toBe(true);
      mailbox = await response.json();
    } else {
      mailbox = await createTestAddress(request, 'tg-internal');
    }
    try {
      if (action === 'bind') await bind(request, owner, mailbox.jwt);
      const stored = await request.get(`${WORKER_URL}/__test/telegram_binding`, {
        params: { userId: String(owner) },
      });
      expect(stored.ok()).toBe(true);
      const tokens = await stored.json();
      expect(tokens).toHaveLength(1);
      expect(await verify(tokens[0], 'e2e-test-secret-key', 'HS256')).toEqual({
        type: 'telegram_binding', address: mailbox.address, address_id: mailbox.address_id,
      });
      const direct = await request.get(`${WORKER_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${tokens[0]}` },
      });
      expect(direct.status()).toBe(401);
      const login = await request.post(`${WORKER_URL}/open_api/credential_login`, {
        data: { credential: tokens[0] },
      });
      expect(login.status()).toBe(401);
      const rebind = await request.post(`${WORKER_URL}/telegram/bind_address`, {
        data: { initData: initData(owner + 1), jwt: tokens[0] },
      });
      expect(rebind.status()).toBe(400);
      expect(await addressList(request, owner + 1)).toEqual([]);
      const bindings = await addressList(request, owner);
      expect(bindings).toEqual([{ address: mailbox.address, jwt: mailbox.jwt }]);
      const settings = await request.get(`${WORKER_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${bindings[0].jwt}` },
      });
      expect(settings.ok()).toBe(true);
      await unbind(request, owner, mailbox.address);
      await expectPushOwner(request, mailbox.address, null);
    } finally {
      await deleteAddress(request, mailbox.jwt);
    }
  });
}

test('expired historical Telegram bindings still allow opening and unbinding the mailbox', async ({ request }) => {
  const mailbox = await createTestAddress(request, 'tg-expired');
  const owner = Date.now();
  try {
    await seedTestMail(request, mailbox.address, {
      subject: 'Historical Telegram mail', text: 'Historical binding mail body',
    });
    const now = Math.floor(Date.now() / 1000);
    const expiredJwt = await sign({
      address: mailbox.address, address_id: mailbox.address_id,
      iat: now - 31 * 86400, exp: now - 86400,
    }, 'e2e-test-secret-key', 'HS256');
    const seed = await request.post(`${WORKER_URL}/__test/telegram_binding`, {
      data: { userId: owner, address: mailbox.address, jwt: expiredJwt },
    });
    expect(seed.ok()).toBe(true);

    const expiredSettings = await request.get(`${WORKER_URL}/api/settings`, {
      headers: { Authorization: `Bearer ${expiredJwt}` },
    });
    expect(expiredSettings.status()).toBe(401);
    const rebind = await request.post(`${WORKER_URL}/telegram/bind_address`, {
      data: { initData: initData(owner + 1), jwt: expiredJwt },
    });
    expect(rebind.status()).toBe(400);
    expect(await addressList(request, owner + 1)).toEqual([]);
    await expectPushOwner(request, mailbox.address, owner);

    const mails = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
      headers: { Authorization: `Bearer ${mailbox.jwt}` },
    });
    expect(mails.ok(), await mails.text()).toBe(true);
    const { results } = await mails.json();
    expect(results).toHaveLength(1);
    const response = await request.post(`${WORKER_URL}/telegram/get_mail`, {
      data: { initData: initData(owner), mailId: results[0].id },
    });
    expect(response.ok(), await response.text()).toBe(true);
    const mail = await response.json();
    expect(mail).toMatchObject({ id: results[0].id, address: mailbox.address });
    expect(mail.raw).toContain('Historical binding mail body');

    const listing = await request.post(`${WORKER_URL}/telegram/get_bind_address`, {
      data: { initData: initData(owner) },
    });
    expect(listing.ok()).toBe(true);
    const bindings = await listing.json();
    expect(bindings).toHaveLength(1);
    expect(bindings[0].address).toBe(mailbox.address);
    expect(bindings[0].jwt).not.toBe(expiredJwt);
    const settings = await request.get(`${WORKER_URL}/api/settings`, {
      headers: { Authorization: `Bearer ${bindings[0].jwt}` },
    });
    expect(settings.ok()).toBe(true);
    expect((await settings.json()).address).toBe(mailbox.address);

    await unbind(request, owner, mailbox.address);
    expect(await addressList(request, owner)).toEqual([]);
    await expectPushOwner(request, mailbox.address, null);
  } finally {
    await deleteAddress(request, mailbox.jwt);
  }
});

test('Telegram users can remove their own bindings after another user binds the mailbox', async ({ request }) => {
  const mailbox = await createTestAddress(request, 'tg-owner');
  const owner = Date.now();
  const other = owner + 1;
  try {
    await bind(request, owner, mailbox.jwt);
    await unbind(request, other, mailbox.address, 400);
    await expectPushOwner(request, mailbox.address, owner);
    await unbind(request, owner, mailbox.address);
    await expectPushOwner(request, mailbox.address, null);

    await bind(request, owner, mailbox.jwt);
    await bind(request, other, mailbox.jwt);
    await expectPushOwner(request, mailbox.address, other);
    await unbind(request, owner, mailbox.address);
    expect(await addressList(request, owner)).toEqual([]);
    expect(await addressList(request, other)).toEqual([{ address: mailbox.address, jwt: mailbox.jwt }]);
    await expectPushOwner(request, mailbox.address, other);
    await unbind(request, other, mailbox.address);
    expect(await addressList(request, other)).toEqual([]);
    await expectPushOwner(request, mailbox.address, null);

    await bind(request, owner, mailbox.jwt);
    await bind(request, other, mailbox.jwt);
    await bind(request, owner, mailbox.jwt);
    expect(await addressList(request, owner)).toEqual([{ address: mailbox.address, jwt: mailbox.jwt }]);
    await expectPushOwner(request, mailbox.address, owner);
    await unbind(request, other, mailbox.address);
    await expectPushOwner(request, mailbox.address, owner);
    await unbind(request, owner, mailbox.address);
    expect(await addressList(request, owner)).toEqual([]);
    await expectPushOwner(request, mailbox.address, null);
  } finally {
    await request.delete(`${WORKER_URL}/api/delete_address`, {
      headers: { Authorization: `Bearer ${mailbox.jwt}` },
    });
  }
});

test('stale Telegram credentials cannot unbind; internal mailbox cleanup still works', async ({ request }) => {
  const original = await createTestAddress(request, 'tg-stale');
  const owner = Date.now();
  await bind(request, owner, original.jwt);
  const deletion = await request.delete(`${WORKER_URL}/admin/delete_address/${original.address_id}`);
  expect(deletion.ok()).toBe(true);
  const seed = await request.post(`${WORKER_URL}/__test/telegram_binding`, {
    data: { userId: owner, address: original.address, jwt: original.jwt },
  });
  expect(seed.ok()).toBe(true);
  const [name, domain] = original.address.split('@');
  const creation = await request.post(`${WORKER_URL}/admin/new_address`, {
    data: { name, domain, enablePrefix: false },
  });
  expect(creation.ok()).toBe(true);
  const recreated = await creation.json();
  try {
    expect(recreated.address_id).not.toBe(original.address_id);
    await unbind(request, owner, recreated.address, 400);
    await expectPushOwner(request, recreated.address, owner);
    const response = await request.delete(`${WORKER_URL}/api/delete_address`, {
      headers: { Authorization: `Bearer ${recreated.jwt}` },
    });
    expect(response.ok(), await response.text()).toBe(true);
    await expectPushOwner(request, recreated.address, null);

    const listing = await request.post(`${WORKER_URL}/telegram/get_bind_address`, {
      data: { initData: initData(owner) },
    });
    expect(listing.ok()).toBe(true);
    expect(await listing.json()).toEqual([]);
  } finally {
    await request.delete(`${WORKER_URL}/admin/delete_address/${recreated.address_id}`);
  }
});

test('Telegram unbind accepts a current credential after a stale credential for the same address', async ({ request }) => {
  const original = await createTestAddress(request, 'tg-recreated');
  const unrelated = await createTestAddress(request, 'tg-retained');
  const owner = Date.now();
  await bind(request, owner, original.jwt);
  const deletion = await request.delete(`${WORKER_URL}/admin/delete_address/${original.address_id}`);
  expect(deletion.ok()).toBe(true);
  const seed = await request.post(`${WORKER_URL}/__test/telegram_binding`, {
    data: { userId: owner, address: original.address, jwt: original.jwt },
  });
  expect(seed.ok()).toBe(true);
  await bind(request, owner, unrelated.jwt);
  const [name, domain] = original.address.split('@');
  const creation = await request.post(`${WORKER_URL}/admin/new_address`, {
    data: { name, domain, enablePrefix: false },
  });
  expect(creation.ok()).toBe(true);
  const recreated = await creation.json();
  try {
    expect(recreated.address_id).not.toBe(original.address_id);
    await bind(request, owner, recreated.jwt);
    await unbind(request, owner, recreated.address);
    await expectPushOwner(request, recreated.address, null);
    expect(await addressList(request, owner)).toEqual([{ address: unrelated.address, jwt: unrelated.jwt }]);
    await expectPushOwner(request, unrelated.address, owner);
  } finally {
    for (const mailbox of [recreated, unrelated]) {
      await request.delete(`${WORKER_URL}/api/delete_address`, {
        headers: { Authorization: `Bearer ${mailbox.jwt}` },
      });
    }
  }
});
