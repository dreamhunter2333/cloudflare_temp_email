import { expect, test, type APIRequestContext } from '@playwright/test';
import { createHmac } from 'node:crypto';

import { WORKER_URL, TEST_DOMAIN, createTestAddress, deleteAddress, seedTestMail } from '../../fixtures/test-helpers';

function signToken(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', 'e2e-test-secret-key')
    .update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

async function expectRejected(request: APIRequestContext, jwt: string) {
  for (const [method, path] of [
    ['GET', '/api/settings'],
    ['GET', '/api/mails?limit=20&offset=0'],
    ['GET', '/api/mail/1'],
    ['GET', '/api/parsed_mails?limit=20&offset=0'],
    ['GET', '/api/parsed_mail/1'],
    ['GET', '/api/sendbox?limit=20&offset=0'],
    ['GET', '/api/auto_reply'],
    ['POST', '/api/webhook/settings'],
    ['POST', '/api/attachment/get_url'],
    ['POST', '/api/address_change_password'],
    ['POST', '/api/request_send_mail_access'],
    ['POST', '/api/send_mail'],
    ['PATCH', '/api/mails/1/read'],
    ['DELETE', '/api/mails/1'],
    ['DELETE', '/api/sendbox/1'],
    ['DELETE', '/api/clear_inbox'],
    ['DELETE', '/api/clear_sent_items'],
    ['DELETE', '/api/delete_address'],
  ]) {
    const response = await request.fetch(`${WORKER_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${jwt}` },
      ...(method === 'POST' || method === 'PATCH' ? { data: {} } : {}),
    });
    expect(response.status(), `${method} ${path}`).toBe(401);
  }
  const login = await request.post(`${WORKER_URL}/open_api/credential_login`, {
    data: { credential: jwt },
  });
  expect(login.status()).toBe(401);
  const send = await request.post(`${WORKER_URL}/external/api/send_mail`, {
    headers: { 'x-lang': 'en' },
    data: { token: jwt },
  });
  expect(send.status()).toBe(400);
  expect(await send.text()).toBe('Failed to send mail Invalid address credential');
  const bind = await request.post(`${WORKER_URL}/user_api/bind_address`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      'x-user-token': signToken({ user_id: 1, exp: Math.floor(Date.now() / 1000) + 60 }),
    },
  });
  expect(bind.status()).toBe(401);
}

test('deleted credentials cannot access or delete a recreated mailbox', async ({ request }) => {
  const name = `credential${Date.now()}`;
  const create = async () => {
    const response = await request.post(`${WORKER_URL}/api/new_address`, {
      data: { name, domain: TEST_DOMAIN },
    });
    expect(response.ok()).toBe(true);
    return await response.json();
  };
  const original = await create();
  await deleteAddress(request, original.jwt);
  await expectRejected(request, original.jwt);

  const recreated = await create();
  try {
    expect(recreated.address).toBe(original.address);
    expect(recreated.address_id).not.toBe(original.address_id);
    await seedTestMail(request, recreated.address, { subject: 'New owner mail' });
    await expectRejected(request, original.jwt);
    const mails = await request.get(`${WORKER_URL}/api/mails?limit=20&offset=0`, {
      headers: { Authorization: `Bearer ${recreated.jwt}` },
    });
    expect(mails.ok()).toBe(true);
    expect((await mails.json()).count).toBe(1);
  } finally {
    await deleteAddress(request, recreated.jwt);
  }
});

test('valid numeric/string IDs work; missing, invalid and mismatched IDs are rejected', async ({ request }) => {
  const mailbox = await createTestAddress(request, 'credential-id');
  try {
    for (const address_id of [mailbox.address_id, String(mailbox.address_id)]) {
      const token = signToken({ address: mailbox.address, address_id });
      const settings = await request.get(`${WORKER_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(settings.ok()).toBe(true);
      const login = await request.post(`${WORKER_URL}/open_api/credential_login`, {
        data: { credential: token },
      });
      expect(login.ok()).toBe(true);
    }
    for (const payload of [
      { address: mailbox.address },
      ...[0, -1, 1.5, true, null, '', '1e3', {}, Number.MAX_SAFE_INTEGER + 1]
        .map(address_id => ({ address: mailbox.address, address_id })),
      { address: `other@${TEST_DOMAIN}`, address_id: mailbox.address_id },
      { address_id: mailbox.address_id },
    ]) {
      const jwt = signToken(payload);
      const response = await request.get(`${WORKER_URL}/api/mails?limit=20&offset=0`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(response.status(), JSON.stringify(payload)).toBe(401);
      const login = await request.post(`${WORKER_URL}/open_api/credential_login`, {
        data: { credential: jwt },
      });
      expect(login.status(), JSON.stringify(payload)).toBe(401);
    }
  } finally {
    await deleteAddress(request, mailbox.jwt);
  }
});
