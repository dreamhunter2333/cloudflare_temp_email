import { expect, test, type APIRequestContext } from '@playwright/test';
import { createTestAddress, TEST_DOMAIN, WORKER_URL, WORKER_GZIP_URL, WORKER_URL_ENV_OFF } from '../../fixtures/test-helpers';

const ADMIN_HEADERS = { 'x-admin-auth': 'e2e-admin-pass' };
const makeRaw = (address: string, code: string, messageId?: string) => [
  'From: Sender <sender@outside.example>', `To: ${address}`,
  `Subject: Your verification code is ${code}`,
  ...(messageId ? [`Message-ID: ${messageId}`] : []),
  'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', '', 'Mail row ID regression',
].join('\r\n');

const listMails = async (request: APIRequestContext, base: string, jwt: string) => {
  const response = await request.get(`${base}/api/mails?limit=20&offset=0`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()).results;
};

for (const [name, base] of [['plaintext', WORKER_URL], ['gzip', WORKER_GZIP_URL], ['remove attachments', WORKER_URL_ENV_OFF]]) {
  test.describe(`Mail row identity: ${name}`, () => {
    for (const mode of ['local', 'ai']) {
      for (const hasMessageId of [true, false]) {
        test(`${mode} extraction isolates rows with ${hasMessageId ? 'repeated' : 'missing'} Message-ID`, async ({ request }) => {
          expect(base, 'Worker variant must be configured in CI').toBeTruthy();
          const first = await createTestAddress(request, 'rowfirst', TEST_DOMAIN, base);
          const other = await createTestAddress(request, 'rowother', TEST_DOMAIN, base);
          const settings = await (await request.get(`${base}/admin/ai_extract/settings`, { headers: ADMIN_HEADERS })).json();
          const messageId = hasMessageId ? `<row-${crypto.randomUUID()}@test>` : undefined;
          try {
            expect((await request.post(`${base}/admin/ai_extract/settings`, {
              headers: ADMIN_HEADERS, data: { enableAllowList: false, allowList: [] },
            })).ok()).toBe(true);
            if (messageId) expect((await request.post(`${base}/__test/seed_mail`, {
              data: { address: first.address, raw: makeRaw(first.address, '000000', messageId), message_id: messageId },
            })).ok()).toBe(true);

            const receive = async (address: string, code: string, aiCode: string) => {
              const response = await request.post(`${base}/__test/receive_mail`, {
                headers: { 'x-test-no-message-id': 'true' },
                data: {
                  from: 'sender@outside.example', to: address, raw: makeRaw(address, code, messageId), extract_mode: mode,
                  ai_extract_result: { type: 'auth_code', result: aiCode, result_text: '' },
                },
              });
              expect(response.ok()).toBe(true);
              expect(await response.json()).toMatchObject({ success: true });
            };
            await receive(first.address, '482913', '111111');
            const initial = await listMails(request, base, first.jwt);
            expect(initial).toHaveLength(hasMessageId ? 2 : 1);
            expect(initial[0].message_id).toBe(messageId ?? null);
            expect(JSON.parse(initial[0].metadata).ai_extract.result).toBe(mode === 'local' ? '482913' : '111111');
            if (hasMessageId) expect(initial[1].metadata).toBeFalsy();

            await receive(other.address, '736251', '222222');
            const otherMails = await listMails(request, base, other.jwt);
            expect(otherMails).toHaveLength(1);
            expect(otherMails[0].message_id).toBe(messageId ?? null);
            expect(JSON.parse(otherMails[0].metadata).ai_extract.result).toBe(mode === 'local' ? '736251' : '222222');
            expect((await listMails(request, base, first.jwt))[0].metadata).toBe(initial[0].metadata);

            await receive(first.address, '914628', '333333');
            const final = await listMails(request, base, first.jwt);
            expect(final).toHaveLength(hasMessageId ? 3 : 2);
            expect(final[0].id).not.toBe(initial[0].id);
            expect(JSON.parse(final[0].metadata).ai_extract.result).toBe(mode === 'local' ? '914628' : '333333');
            expect(final[1].id).toBe(initial[0].id);
            expect(final[1].metadata).toBe(initial[0].metadata);
            if (hasMessageId) expect(final[2].metadata).toBeFalsy();
            expect((await listMails(request, base, other.jwt))[0].metadata).toBe(otherMails[0].metadata);
          } finally {
            await request.post(`${base}/admin/ai_extract/settings`, { headers: ADMIN_HEADERS, data: settings });
            for (const mailbox of [first, other]) await request.delete(`${base}/admin/delete_address/${mailbox.address_id}`, {
              headers: ADMIN_HEADERS,
            });
          }
        });
      }
    }
  });
}

for (const hasMessageId of [true, false]) {
  test(`Telegram links use the inserted row ID with ${hasMessageId ? 'repeated' : 'missing'} Message-ID`, async ({ request }) => {
    const mailbox = await createTestAddress(request, 'rowtelegram');
    const settings = await (await request.get(`${WORKER_URL}/admin/telegram/settings`, { headers: ADMIN_HEADERS })).json();
    const messageId = hasMessageId ? `<telegram-row-${crypto.randomUUID()}@test>` : undefined;
    const raw = makeRaw(mailbox.address, '482913', messageId);
    try {
      expect((await request.post(`${WORKER_URL}/admin/telegram/settings`, {
        headers: ADMIN_HEADERS,
        data: { enableAllowList: false, allowList: [], miniAppUrl: 'https://example.com', enableGlobalMailPush: false, globalMailPushList: [] },
      })).ok()).toBe(true);
      expect((await request.post(`${WORKER_URL}/__test/telegram_binding`, {
        data: { userId: Date.now(), address: mailbox.address, jwt: mailbox.jwt },
      })).ok()).toBe(true);
      if (messageId) expect((await request.post(`${WORKER_URL}/__test/seed_mail`, {
        data: { address: mailbox.address, raw, message_id: messageId },
      })).ok()).toBe(true);
      const response = await request.post(`${WORKER_URL}/__test/receive_mail`, {
        headers: { 'x-test-no-message-id': 'true' },
        data: { from: 'sender@outside.example', to: mailbox.address, raw, record_telegram: true },
      });
      expect(response.ok()).toBe(true);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.telegramCalls).toHaveLength(1);
      expect(result.telegramCalls[0].method).toBe('sendMessage');
      const mails = await listMails(request, WORKER_URL, mailbox.jwt);
      expect(mails).toHaveLength(hasMessageId ? 2 : 1);
      expect(mails[0].message_id).toBe(messageId ?? null);
      const link = new URL(result.telegramCalls[0].payload.reply_markup.inline_keyboard[0][0].web_app.url);
      expect(link.searchParams.get('mail_id')).toBe(String(mails[0].id));
      if (hasMessageId) expect(link.searchParams.get('mail_id')).not.toBe(String(mails[1].id));
    } finally {
      await request.post(`${WORKER_URL}/admin/telegram/settings`, { headers: ADMIN_HEADERS, data: settings });
      await request.delete(`${WORKER_URL}/admin/delete_address/${mailbox.address_id}`, { headers: ADMIN_HEADERS });
    }
  });
}

test('concurrent Telegram recordings stay within their own receive requests', async ({ request }) => {
  const first = await createTestAddress(request, 'concurrentfirst');
  const other = await createTestAddress(request, 'concurrentother');
  const mailboxes = [first, other];
  const settings = await (await request.get(`${WORKER_URL}/admin/telegram/settings`, { headers: ADMIN_HEADERS })).json();
  const owner = Date.now();
  try {
    expect((await request.post(`${WORKER_URL}/admin/telegram/settings`, {
      headers: ADMIN_HEADERS,
      data: { enableAllowList: false, allowList: [], miniAppUrl: 'https://example.com', enableGlobalMailPush: false, globalMailPushList: [] },
    })).ok()).toBe(true);
    for (const [index, mailbox] of mailboxes.entries()) expect((await request.post(`${WORKER_URL}/__test/telegram_binding`, {
      data: { userId: owner + index, address: mailbox.address, jwt: mailbox.jwt },
    })).ok()).toBe(true);
    const responses = await Promise.all(mailboxes.map(mailbox => request.post(`${WORKER_URL}/__test/receive_mail`, {
      data: {
        from: 'sender@outside.example', to: mailbox.address,
        raw: makeRaw(mailbox.address, '482913', `<concurrent-${crypto.randomUUID()}@test>`), record_telegram: true,
      },
    })));
    for (const [index, response] of responses.entries()) {
      expect(response.ok()).toBe(true);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.telegramCalls).toHaveLength(1);
      expect(result.telegramCalls[0].method).toBe('sendMessage');
      expect(Number(result.telegramCalls[0].payload.chat_id)).toBe(owner + index);
      const mails = await listMails(request, WORKER_URL, mailboxes[index].jwt);
      expect(mails).toHaveLength(1);
      const link = new URL(result.telegramCalls[0].payload.reply_markup.inline_keyboard[0][0].web_app.url);
      expect(link.searchParams.get('mail_id')).toBe(String(mails[0].id));
    }
  } finally {
    await request.post(`${WORKER_URL}/admin/telegram/settings`, { headers: ADMIN_HEADERS, data: settings });
    for (const mailbox of mailboxes) await request.delete(`${WORKER_URL}/admin/delete_address/${mailbox.address_id}`, {
      headers: ADMIN_HEADERS,
    });
  }
});
