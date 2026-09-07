import { expect, test, type APIRequestContext } from '@playwright/test';
import { createHmac } from 'node:crypto';

import { WORKER_URL, createTestAddress } from '../../fixtures/test-helpers';

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
  await bind(request, owner, unrelated.jwt);
  const deletion = await request.delete(`${WORKER_URL}/admin/delete_address/${original.address_id}`);
  expect(deletion.ok()).toBe(true);
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
