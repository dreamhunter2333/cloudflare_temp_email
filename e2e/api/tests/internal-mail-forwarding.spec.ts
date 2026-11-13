import { test, expect } from '@playwright/test';
import http from 'node:http';
import type { APIRequestContext } from '@playwright/test';
import PostalMime from 'postal-mime';
import { createTestAddress, TEST_DOMAIN, WORKER_URL, WORKER_GZIP_URL, WORKER_URL_ENV_OFF } from '../../fixtures/test-helpers';

const ADMIN_HEADERS = { 'x-admin-auth': 'e2e-admin-pass' };
const DEFAULT_SETTINGS = {
  blockList: [], sendBlockList: [], verifiedAddressList: [], fromBlockList: [],
  noLimitSendAddressList: [], emailRuleSettings: {}, addressCreationSettings: {},
};

const setRules = async (request: APIRequestContext, base: string, emailRuleSettings = {}) => {
  const response = await request.post(`${base}/admin/account_settings`, {
    headers: ADMIN_HEADERS, data: { ...DEFAULT_SETTINGS, emailRuleSettings },
  });
  expect(response.ok(), await response.text()).toBe(true);
};

const makeRaw = (address: string) => [
  'From: Original Sender <sender@outside.example>',
  `To: ${address}`, 'Subject: Internal forwarding',
  `Message-ID: <internal-${crypto.randomUUID()}@test>`,
  'MIME-Version: 1.0', 'Content-Type: multipart/mixed; boundary=internal', '',
  '--internal', 'Content-Type: text/plain; charset=utf-8', '', 'Original body 正文',
  '--internal', 'Content-Type: application/octet-stream',
  'Content-Disposition: attachment; filename="original.bin"',
  'Content-Transfer-Encoding: base64', '', 'AAH+/w==', '--internal--', '',
].join('\r\n');

const listMails = async (request: APIRequestContext, base: string, jwt: string) => {
  const response = await request.get(`${base}/api/mails?limit=20&offset=0`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()).results;
};

for (const [name, base] of [['plaintext', WORKER_URL], ['gzip', WORKER_GZIP_URL], ['remove attachments', WORKER_URL_ENV_OFF]]) {
  test.describe(`Internal forwarding: ${name}`, () => {
    test.beforeEach(async ({ request }) => {
      test.skip(!base, `${name} worker is not configured`);
      await setRules(request, base);
    });
    test.afterEach(async ({ request }) => {
      if (base) await setRules(request, base);
    });

    test('stores an independently processed copy under the target mailbox', async ({ request }) => {
      const source = await createTestAddress(request, 'internalsource', TEST_DOMAIN, base);
      const target = await createTestAddress(request, 'internaltarget', name === 'plaintext' ? 'manual.example.com' : TEST_DOMAIN, base);
      try {
        await setRules(request, base, { emailForwardingList: [{
          domains: [TEST_DOMAIN.toUpperCase()], sourcePatterns: ['^sender@outside\\.example$'],
          recipientPatterns: ['internalsource'],
          forward: target.address.replace(/@(.+)$/, (_, domain: string) => `@${domain.toUpperCase()}`),
          deleteOriginal: false,
        }] });
        const raw = makeRaw(source.address);
        const response = await request.post(`${base}/__test/receive_mail`, {
          data: { from: 'sender@outside.example', to: source.address, raw },
        });
        expect(await response.json()).toMatchObject({ success: true, forwardedTo: [], replyCalled: false });
        const original = await listMails(request, base, source.jwt);
        const copies = await listMails(request, base, target.jwt);
        expect(original).toHaveLength(1);
        expect(copies).toHaveLength(1);
        expect(copies[0]).toMatchObject({ address: target.address, source: 'sender@outside.example' });
        expect(copies[0].message_id).toBe(original[0].message_id);
        expect(copies[0].id).not.toBe(original[0].id);
        const parsed = await PostalMime.parse(copies[0].raw);
        expect(parsed.to).toEqual([{ address: name === 'remove attachments' ? target.address : source.address, name: '' }]);
        expect(parsed.from?.address).toBe('sender@outside.example');
        expect(parsed.text?.trim()).toBe('Original body 正文');
        if (name === 'remove attachments') {
          expect(parsed.attachments).toHaveLength(0);
        } else {
          expect(copies[0].raw).toBe(raw);
          expect(parsed.attachments).toHaveLength(1);
          expect(parsed.attachments[0].filename).toBe('original.bin');
          expect(Buffer.from(parsed.attachments[0].content)).toEqual(Buffer.from([0, 1, 254, 255]));
        }
        if (name === 'plaintext') expect(copies[0].is_unread).toBe(1);
        const forbidden = await request.get(`${base}/api/mail/${copies[0].id}`, {
          headers: { Authorization: `Bearer ${source.jwt}` },
        });
        expect(await forbidden.json()).toBeNull();
      } finally {
        for (const mailbox of [source, target]) await request.delete(`${base}/api/delete_address`, {
          headers: { Authorization: `Bearer ${mailbox.jwt}` },
        });
      }
    });

    for (const blockUnknown of [false, true]) {
      test(`routes by domain and respects unknown-recipient rejection: ${blockUnknown}`, async ({ request }) => {
        const source = await createTestAddress(request, 'mixedsource', TEST_DOMAIN, base);
        const target = await createTestAddress(request, 'mixedtarget', TEST_DOMAIN, base);
        const external = 'recipient@outside.example';
        const missing = `missing${crypto.randomUUID().replaceAll('-', '')}@${TEST_DOMAIN}`;
        try {
          await setRules(request, base, {
            blockReceiveUnknowAddressEmail: blockUnknown,
            emailForwardingList: [target.address, external, missing].map(forward => ({
              forward, deleteOriginal: blockUnknown && forward === missing,
            })),
          });
          const response = await request.post(`${base}/__test/receive_mail`, {
            data: { from: 'sender@outside.example', to: source.address, raw: makeRaw(source.address) },
          });
          expect(await response.json()).toMatchObject({
            success: true, forwardedTo: [external],
          });
          expect(await listMails(request, base, target.jwt)).toHaveLength(1);
          expect(await listMails(request, base, source.jwt)).toHaveLength(1);
          const unknownMails = await request.get(`${base}/admin/mails?address=${encodeURIComponent(missing)}&limit=20&offset=0`, {
            headers: ADMIN_HEADERS,
          });
          expect(unknownMails.ok()).toBe(true);
          expect((await unknownMails.json()).results).toHaveLength(blockUnknown ? 0 : 1);
        } finally {
          const unknownMails = await request.get(`${base}/admin/mails?address=${encodeURIComponent(missing)}&limit=20&offset=0`, {
            headers: ADMIN_HEADERS,
          });
          for (const mail of (await unknownMails.json()).results) await request.delete(`${base}/admin/mails/${mail.id}`, {
            headers: ADMIN_HEADERS,
          });
          for (const mailbox of [source, target]) await request.delete(`${base}/api/delete_address`, {
            headers: { Authorization: `Bearer ${mailbox.jwt}` },
          });
        }
      });
    }

    for (const route of ['admin', 'environment']) {
      test(`${route} recipient regex preserves filtering, internal delivery and original deletion`, async ({ request }) => {
        test.setTimeout(60_000);
        const source = await createTestAddress(request, 'adminalias', TEST_DOMAIN, base);
        const target = await createTestAddress(request, 'regextarget', TEST_DOMAIN, base);
        const external = 'recipient@outside.example';
        const cases = [
          { title: 'legacy rule', filter: {}, matches: true },
          { title: 'empty patterns', filter: { recipientPatterns: [] }, matches: true },
          { title: 'default any', filter: { recipientPatterns: ['^nobody@', 'adminalias'] }, matches: true },
          { title: 'case-insensitive any', filter: { recipientPatterns: ['^nobody@', 'ADMINALIAS'], recipientMatchMode: 'any' }, matches: true },
          { title: 'all', filter: { recipientPatterns: ['adminalias', '@test\\.example\\.com$'], recipientMatchMode: 'all' }, matches: true },
          { title: 'all requires every pattern', filter: { recipientPatterns: ['adminalias', '^nobody@'], recipientMatchMode: 'all' }, matches: false },
          { title: 'recipient mismatch', filter: { recipientPatterns: ['^nobody@'] }, matches: false },
          { title: 'invalid regex', filter: { recipientPatterns: ['['] }, matches: false },
          { title: 'overlong regex', filter: { recipientPatterns: ['a'.repeat(201)] }, matches: false },
          { title: 'sender must also match', filter: { recipientPatterns: ['adminalias'], sourcePatterns: ['^nobody@'] }, matches: false },
          { title: 'domain must also match', filter: { recipientPatterns: ['adminalias'], domains: ['outside.example'] }, matches: false },
          { title: 'MIME To is not the envelope recipient', filter: { recipientPatterns: ['^headeronly@'] }, matches: false },
        ];
        const totals = { originals: 0, copies: 0 };
        try {
          for (const scenario of cases) await test.step(scenario.title, async () => {
            const rules = [target.address, external].map(forward => ({
              domains: [TEST_DOMAIN.toUpperCase()], sourcePatterns: ['^sender@outside\\.example$'],
              ...scenario.filter, forward, deleteOriginal: true,
            }));
            await setRules(request, base, { emailForwardingList: route === 'admin' ? rules : [] });
            const response = await request.post(`${base}/__test/receive_mail`, {
              data: {
                from: 'sender@outside.example', to: source.address, raw: makeRaw('headeronly@outside.example'),
                ...(route === 'environment' ? { subdomain_forward_address_list: rules } : {}),
              },
            });
            expect(await response.json()).toMatchObject({ success: true, forwardedTo: scenario.matches ? [external] : [] });
            if (scenario.matches) totals.copies++;
            else totals.originals++;
            expect(await listMails(request, base, source.jwt)).toHaveLength(totals.originals);
            expect(await listMails(request, base, target.jwt)).toHaveLength(totals.copies);
          });
        } finally {
          for (const mailbox of [source, target]) await request.delete(`${base}/api/delete_address`, {
            headers: { Authorization: `Bearer ${mailbox.jwt}` },
          });
        }
      });
    }

    test('does not duplicate self-forwards or recursively apply cyclic rules', async ({ request }) => {
      const source = await createTestAddress(request, 'cyclesource', TEST_DOMAIN, base);
      const target = await createTestAddress(request, 'cycletarget', TEST_DOMAIN, base);
      try {
        await setRules(request, base, { emailForwardingList: [
          { forward: source.address, deleteOriginal: true }, { forward: target.address },
        ] });
        const response = await request.post(`${base}/__test/receive_mail`, {
          data: { from: 'sender@outside.example', to: source.address, raw: makeRaw(source.address) },
        });
        expect(await response.json()).toMatchObject({ success: true, forwardedTo: [], replyCalled: false });
        expect(await listMails(request, base, source.jwt)).toHaveLength(1);
        expect(await listMails(request, base, target.jwt)).toHaveLength(1);
      } finally {
        for (const mailbox of [source, target]) await request.delete(`${base}/api/delete_address`, {
          headers: { Authorization: `Bearer ${mailbox.jwt}` },
        });
      }
    });

    test('keeps global forwarding on the Cloudflare path without changing rule filtering', async ({ request }) => {
      const source = await createTestAddress(request, 'globalsource', TEST_DOMAIN, base);
      const target = await createTestAddress(request, 'globaltarget', TEST_DOMAIN, base);
      const external = 'global@outside.example';
      try {
        await setRules(request, base, { emailForwardingList: [{
          forward: target.address, sourcePatterns: ['^different@outside\\.example$'], deleteOriginal: true,
        }] });
        const response = await request.post(`${base}/__test/receive_mail`, {
          data: {
            from: 'sender@outside.example', to: source.address, raw: makeRaw(source.address),
            forward_address_list: [source.address, target.address, external],
          },
        });
        expect(await response.json()).toMatchObject({ success: true, forwardedTo: [source.address, target.address, external] });
        expect(await listMails(request, base, source.jwt)).toHaveLength(1);
        expect(await listMails(request, base, target.jwt)).toHaveLength(0);
      } finally {
        for (const mailbox of [source, target]) await request.delete(`${base}/api/delete_address`, {
          headers: { Authorization: `Bearer ${mailbox.jwt}` },
        });
      }
    });

    for (const blockUnknown of [true, false]) test(`recipient regex respects unknown-recipient rejection: ${blockUnknown}`, async ({ request }) => {
      const target = await createTestAddress(request, 'rejectedtarget', TEST_DOMAIN, base);
      const unknown = `unknown${crypto.randomUUID().replaceAll('-', '')}@${TEST_DOMAIN}`;
      try {
        await setRules(request, base, {
          blockReceiveUnknowAddressEmail: blockUnknown,
          emailForwardingList: [{ forward: target.address, recipientPatterns: ['^unknown'], deleteOriginal: true }],
        });
        const response = await request.post(`${base}/__test/receive_mail`, {
          data: { from: 'sender@outside.example', to: unknown, raw: makeRaw(unknown) },
        });
        expect(await response.json()).toMatchObject(blockUnknown
          ? { success: false, rejected: 'Unknown address', forwardedTo: [] }
          : { success: true, forwardedTo: [] });
        expect(await listMails(request, base, target.jwt)).toHaveLength(blockUnknown ? 0 : 1);
      } finally {
        await request.delete(`${base}/api/delete_address`, { headers: { Authorization: `Bearer ${target.jwt}` } });
      }
    });

    test('delivers environment forwarding rules directly to an internal mailbox', async ({ request }) => {
      const source = await createTestAddress(request, 'envsource', TEST_DOMAIN, base);
      const target = await createTestAddress(request, 'envtarget', TEST_DOMAIN, base);
      try {
        const response = await request.post(`${base}/__test/receive_mail`, {
          data: {
            from: 'sender@outside.example', to: source.address, raw: makeRaw(source.address),
            subdomain_forward_address_list: [{
              domains: [TEST_DOMAIN.toUpperCase()], forward: target.address,
              sourcePatterns: ['^sender@outside\\.example$'],
            }],
          },
        });
        expect(await response.json()).toMatchObject({ success: true, forwardedTo: [] });
        expect(await listMails(request, base, target.jwt)).toHaveLength(1);
      } finally {
        for (const mailbox of [source, target]) await request.delete(`${base}/api/delete_address`, {
          headers: { Authorization: `Bearer ${mailbox.jwt}` },
        });
      }
    });

    test('keeps global failure handling unchanged and still processes forwarding rules', async ({ request }) => {
      const source = await createTestAddress(request, 'globalfailsource', TEST_DOMAIN, base);
      const target = await createTestAddress(request, 'globalfailtarget', TEST_DOMAIN, base);
      const failed = 'failed@outside.example';
      try {
        await setRules(request, base, { emailForwardingList: [{ forward: target.address }] });
        const response = await request.post(`${base}/__test/receive_mail`, {
          headers: { 'x-test-forward-failure': 'external', 'x-test-forward-failure-address': failed },
          data: {
            from: 'sender@outside.example', to: source.address, raw: makeRaw(source.address),
            forward_address_list: [failed, 'later@outside.example'],
          },
        });
        expect(await response.json()).toMatchObject({ success: true, forwardedTo: [] });
        expect(await listMails(request, base, source.jwt)).toHaveLength(1);
        expect(await listMails(request, base, target.jwt)).toHaveLength(1);
      } finally {
        for (const mailbox of [source, target]) await request.delete(`${base}/api/delete_address`, {
          headers: { Authorization: `Bearer ${mailbox.jwt}` },
        });
      }
    });

    for (const route of ['admin', 'environment']) {
      for (const failure of ['write-throw', 'write-false', 'external', 'reject']) {
        test(`${route} forwarding continues after ${failure} failure`, async ({ request }) => {
          const source = await createTestAddress(request, 'failsource', TEST_DOMAIN, base);
          const failed = await createTestAddress(request, 'failtarget', TEST_DOMAIN, base);
          const target = await createTestAddress(request, 'latertarget', TEST_DOMAIN, base);
          const failedAddress = failure === 'external' ? 'failed@outside.example' : failed.address;
          const external = 'later@outside.example';
          const targets = [failedAddress, target.address, external];
          const rules = targets.map(forward => ({
            forward, deleteOriginal: forward === failedAddress,
          }));
          try {
            await setRules(request, base, {
              blockReceiveUnknowAddressEmail: failure === 'reject',
              emailForwardingList: route === 'admin' ? rules : [],
            });
            const response = await request.post(`${base}/__test/receive_mail`, {
              headers: { 'x-test-forward-failure': failure, 'x-test-forward-failure-address': failedAddress },
              data: {
                from: 'sender@outside.example', to: source.address, raw: makeRaw(source.address),
                record_another_worker: true,
                ...(route === 'environment' ? { subdomain_forward_address_list: rules } : {}),
              },
            });
            const result = await response.json();
            expect(result).toMatchObject({
              success: true, forwardedTo: [external],
            });
            expect(result.workerCalls.map((mail: { to: string }) => mail.to)).toEqual([
              ...(failure.startsWith('write-') ? [failed.address] : []), target.address, source.address,
            ]);
            expect(await listMails(request, base, source.jwt)).toHaveLength(1);
            expect(await listMails(request, base, target.jwt)).toHaveLength(1);
            expect(await listMails(request, base, failed.jwt)).toHaveLength(0);
          } finally {
            for (const mailbox of [source, failed, target]) await request.delete(`${base}/api/delete_address`, {
              headers: { Authorization: `Bearer ${mailbox.jwt}` },
            });
          }
        });
      }
    }

    for (const route of ['admin', 'environment']) {
      for (const destination of ['internal', 'external']) {
        test(`${route} deletes only the current original after ${destination} forwarding succeeds`, async ({ request }) => {
          const source = await createTestAddress(request, 'deletesource', TEST_DOMAIN, base);
          const target = await createTestAddress(request, 'deletetarget', TEST_DOMAIN, base);
          try {
            const raw = makeRaw(source.address);
            const seeded = await request.post(`${base}/__test/receive_mail`, {
              data: { from: 'sender@outside.example', to: source.address, raw },
            });
            expect(await seeded.json()).toMatchObject({ success: true });
            const previous = await listMails(request, base, source.jwt);
            expect(previous).toHaveLength(1);
            const forward = destination === 'internal' ? target.address : 'recipient@outside.example';
            const rules = [{ domains: [TEST_DOMAIN], forward, deleteOriginal: true }];
            if (route === 'admin') await setRules(request, base, { emailForwardingList: rules });
            const response = await request.post(`${base}/__test/receive_mail`, {
              data: {
                from: 'sender@outside.example', to: source.address, raw,
                ...(route === 'environment' ? { subdomain_forward_address_list: rules } : {}),
              },
            });
            expect(await response.json()).toMatchObject({
              success: true, forwardedTo: destination === 'external' ? [forward] : [],
            });
            const originals = await listMails(request, base, source.jwt);
            expect(originals.map((mail: { id: number }) => mail.id)).toEqual([previous[0].id]);
            const copies = await listMails(request, base, target.jwt);
            expect(copies).toHaveLength(destination === 'internal' ? 1 : 0);
            if (destination === 'internal') {
              expect(copies[0].message_id).toBe(previous[0].message_id);
              if (name !== 'remove attachments') expect(copies[0].raw).toBe(previous[0].raw);
            }
          } finally {
            for (const mailbox of [source, target]) await request.delete(`${base}/api/delete_address`, {
              headers: { Authorization: `Bearer ${mailbox.jwt}` },
            });
          }
        });
      }
    }

    test('keeps the original available for webhook processing before deleting it', async ({ request }) => {
      const source = await createTestAddress(request, 'notifysource', TEST_DOMAIN, base);
      const target = await createTestAddress(request, 'notifytarget', TEST_DOMAIN, base);
      const payloads: { id: string; to: string; attachments: { url: string }[] }[] = [];
      const server = http.createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
          payloads.push(JSON.parse(Buffer.concat(chunks).toString()));
          res.writeHead(200).end();
        });
      });
      try {
        await new Promise<void>(resolve => server.listen(0, '0.0.0.0', resolve));
        const port = (server.address() as import('node:net').AddressInfo).port;
        const hostname = process.env.CI ? 'e2e-runner' : 'localhost';
        for (const mailbox of [source, target]) expect((await request.post(`${base}/api/webhook/settings`, {
          headers: { Authorization: `Bearer ${mailbox.jwt}` },
          data: {
            enabled: true, url: `http://${hostname}:${port}`, method: 'POST',
            headers: '{"Content-Type":"application/json"}',
            body: '{"id":"${id}","to":"${to}","attachments":${attachments}}',
          },
        })).ok()).toBe(true);
        await setRules(request, base, { emailForwardingList: [{ forward: target.address, deleteOriginal: true }] });
        const response = await request.post(`${base}/__test/receive_mail`, {
          data: { from: 'sender@outside.example', to: source.address, raw: makeRaw(source.address), extract_mode: 'local' },
        });
        expect(await response.json()).toMatchObject({ success: true });
        expect(payloads).toHaveLength(2);
        expect(payloads.map(payload => payload.to)).toEqual([target.address, source.address]);
        for (const payload of payloads) {
          expect(payload.id).toMatch(/^\d+$/);
          expect(payload.attachments).toHaveLength(name === 'remove attachments' ? 0 : 1);
        }
        expect(await listMails(request, base, source.jwt)).toHaveLength(0);
        const copies = await listMails(request, base, target.jwt);
        expect(copies).toHaveLength(1);
        expect(copies[0].id).toBe(Number(payloads[0].id));
        expect(copies[0].id).not.toBe(Number(payloads[1].id));
      } finally {
        server.close();
        for (const mailbox of [source, target]) await request.delete(`${base}/api/delete_address`, {
          headers: { Authorization: `Bearer ${mailbox.jwt}` },
        });
      }
    });

    test('extracts metadata per recipient without updating older rows with the same Message-ID', async ({ request }) => {
      const source = await createTestAddress(request, 'metasource', TEST_DOMAIN, base);
      const target = await createTestAddress(request, 'metatarget', TEST_DOMAIN, base);
      const aiSettings = await (await request.get(`${base}/admin/ai_extract/settings`, { headers: ADMIN_HEADERS })).json();
      try {
        expect((await request.post(`${base}/admin/ai_extract/settings`, {
          headers: ADMIN_HEADERS, data: { enableAllowList: true, allowList: [source.address] },
        })).ok()).toBe(true);
        const raw = makeRaw(source.address).replace('Subject: Internal forwarding', 'Subject: Your verification code is 482913');
        const messageId = raw.match(/^Message-ID: (.+)$/m)![1].trim();
        expect((await request.post(`${base}/__test/seed_mail`, {
          data: { address: source.address, raw, message_id: messageId },
        })).ok()).toBe(true);
        await setRules(request, base, { emailForwardingList: [{ forward: target.address }] });
        const response = await request.post(`${base}/__test/receive_mail`, {
          data: {
            from: 'sender@outside.example', to: source.address, raw, extract_mode: 'ai',
            ai_extract_result: { type: 'auth_code', result: '123456', result_text: '' },
          },
        });
        expect(await response.json()).toMatchObject({ success: true });
        const originals = await listMails(request, base, source.jwt);
        const copies = await listMails(request, base, target.jwt);
        expect(originals).toHaveLength(2);
        expect(copies).toHaveLength(1);
        expect(originals[0].message_id).toBe(messageId);
        expect(copies[0].message_id).toBe(messageId);
        expect(JSON.parse(originals[0].metadata).ai_extract.result).toBe('123456');
        expect(JSON.parse(copies[0].metadata).ai_extract.result).toBe('482913');
        expect(originals[1].metadata).toBeFalsy();
      } finally {
        await request.post(`${base}/admin/ai_extract/settings`, { headers: ADMIN_HEADERS, data: aiSettings });
        for (const mailbox of [source, target]) await request.delete(`${base}/admin/delete_address/${mailbox.address_id}`, {
          headers: ADMIN_HEADERS,
        });
      }
    });

    test('runs other-Worker processing for both recipients but auto-replies only once', async ({ request }) => {
      const source = await createTestAddress(request, 'replysource', TEST_DOMAIN, base);
      const target = await createTestAddress(request, 'replytarget', TEST_DOMAIN, base);
      try {
        for (const mailbox of [source, target]) expect((await request.post(`${base}/api/auto_reply`, {
          headers: { Authorization: `Bearer ${mailbox.jwt}` },
          data: { auto_reply: { enabled: true, name: 'E2E', subject: 'Reply', message: 'Automatic reply', source_prefix: '' } },
        })).ok()).toBe(true);
        await setRules(request, base, { emailForwardingList: [source.address, target.address].map(forward => ({ forward })) });
        const response = await request.post(`${base}/__test/receive_mail`, {
          data: { from: 'sender@outside.example', to: source.address, raw: makeRaw(source.address), record_another_worker: true },
        });
        const result = await response.json();
        expect(result).toMatchObject({ success: true, replyCalled: true, replyCount: 1, forwardedTo: [] });
        expect(result.workerCalls.map((mail: { to: string }) => mail.to)).toEqual([target.address, source.address]);
        expect(await listMails(request, base, source.jwt)).toHaveLength(1);
        expect(await listMails(request, base, target.jwt)).toHaveLength(1);
      } finally {
        for (const mailbox of [source, target]) await request.delete(`${base}/admin/delete_address/${mailbox.address_id}`, {
          headers: ADMIN_HEADERS,
        });
      }
    });

    if (name === 'plaintext') test('uses the newly stored row IDs in Telegram links even when older Message-IDs match', async ({ request }) => {
      const source = await createTestAddress(request, 'tgsource', TEST_DOMAIN, base);
      const target = await createTestAddress(request, 'tgtarget', TEST_DOMAIN, base);
      const settings = await (await request.get(`${base}/admin/telegram/settings`, { headers: ADMIN_HEADERS })).json();
      const owner = Date.now();
      try {
        expect((await request.post(`${base}/admin/telegram/settings`, {
          headers: ADMIN_HEADERS, data: { enableAllowList: false, allowList: [], miniAppUrl: 'https://example.com', enableGlobalMailPush: false, globalMailPushList: [] },
        })).ok()).toBe(true);
        const raw = makeRaw(source.address);
        const messageId = raw.match(/^Message-ID: (.+)$/m)![1].trim();
        for (const [index, mailbox] of [source, target].entries()) {
          expect((await request.post(`${base}/__test/telegram_binding`, {
            data: { userId: owner + index, address: mailbox.address, jwt: mailbox.jwt },
          })).ok()).toBe(true);
          expect((await request.post(`${base}/__test/seed_mail`, {
            data: { address: mailbox.address, raw, message_id: messageId },
          })).ok()).toBe(true);
        }
        await setRules(request, base, { emailForwardingList: [{ forward: target.address }] });
        const response = await request.post(`${base}/__test/receive_mail`, {
          data: { from: 'sender@outside.example', to: source.address, raw, record_telegram: true },
        });
        const result = await response.json();
        expect(result.success).toBe(true);
        expect(result.telegramCalls).toHaveLength(2);
        for (const [index, mailbox] of [source, target].entries()) {
          const mails = await listMails(request, base, mailbox.jwt);
          expect(mails).toHaveLength(2);
          const call = result.telegramCalls.find((call: { payload: { chat_id: number } }) => Number(call.payload.chat_id) === owner + index);
          expect(call.method).toBe('sendMessage');
          const link = new URL(call.payload.reply_markup.inline_keyboard[0][0].web_app.url);
          expect(link.searchParams.get('mail_id')).toBe(String(mails[0].id));
          expect(link.searchParams.get('mail_id')).not.toBe(String(mails[1].id));
        }
      } finally {
        await request.post(`${base}/admin/telegram/settings`, { headers: ADMIN_HEADERS, data: settings });
        for (const mailbox of [source, target]) await request.delete(`${base}/admin/delete_address/${mailbox.address_id}`, {
          headers: ADMIN_HEADERS,
        });
      }
    });

    test('extracts metadata for both recipients without a Message-ID header', async ({ request }) => {
      const source = await createTestAddress(request, 'noidsource', TEST_DOMAIN, base);
      const target = await createTestAddress(request, 'noidtarget', TEST_DOMAIN, base);
      try {
        await setRules(request, base, { emailForwardingList: [{ forward: target.address }] });
        const raw = makeRaw(source.address)
          .replace(/^Message-ID: .+\r\n/m, '')
          .replace('Subject: Internal forwarding', 'Subject: Your verification code is 482913');
        const response = await request.post(`${base}/__test/receive_mail`, {
          headers: { 'x-test-no-message-id': 'true' },
          data: { from: 'sender@outside.example', to: source.address, raw, extract_mode: 'local' },
        });
        expect(await response.json()).toMatchObject({ success: true });
        for (const mailbox of [source, target]) {
          const mails = await listMails(request, base, mailbox.jwt);
          expect(mails).toHaveLength(1);
          expect(mails[0].message_id).toBeNull();
          expect(JSON.parse(mails[0].metadata).ai_extract.result).toBe('482913');
        }
      } finally {
        for (const mailbox of [source, target]) await request.delete(`${base}/admin/delete_address/${mailbox.address_id}`, {
          headers: ADMIN_HEADERS,
        });
      }
    });

    for (const deleteOriginal of [false, true]) {
      for (const mode of ['local', 'ai']) {
        test(`${mode} extraction preserves copy metadata with deleteOriginal=${deleteOriginal}`, async ({ request }) => {
          const source = await createTestAddress(request, 'extractsource', TEST_DOMAIN, base);
          const target = await createTestAddress(request, 'extracttarget', TEST_DOMAIN, base);
          const aiSettings = await (await request.get(`${base}/admin/ai_extract/settings`, { headers: ADMIN_HEADERS })).json();
          try {
            expect((await request.post(`${base}/admin/ai_extract/settings`, {
              headers: ADMIN_HEADERS, data: { enableAllowList: false, allowList: [] },
            })).ok()).toBe(true);
            await setRules(request, base, { emailForwardingList: [{ forward: target.address, deleteOriginal }] });
            const raw = makeRaw(source.address).replace('Subject: Internal forwarding', 'Subject: Your verification code is 482913');
            const response = await request.post(`${base}/__test/receive_mail`, {
              data: {
                from: 'sender@outside.example', to: source.address, raw, extract_mode: mode,
                ai_extract_result: { type: 'auth_code', result: '123456', result_text: '' },
              },
            });
            expect(await response.json()).toMatchObject({ success: true, forwardedTo: [] });
            const originals = await listMails(request, base, source.jwt);
            const copies = await listMails(request, base, target.jwt);
            expect(originals).toHaveLength(deleteOriginal ? 0 : 1);
            expect(copies).toHaveLength(1);
            expect(JSON.parse(copies[0].metadata).ai_extract).toEqual({
              type: 'auth_code', result: mode === 'local' ? '482913' : '123456', result_text: '',
            });
            if (!deleteOriginal) {
              expect(copies[0].message_id).toBe(originals[0].message_id);
              expect(JSON.parse(copies[0].metadata).ai_extract).toEqual(JSON.parse(originals[0].metadata).ai_extract);
            }
          } finally {
            await request.post(`${base}/admin/ai_extract/settings`, { headers: ADMIN_HEADERS, data: aiSettings });
            for (const mailbox of [source, target]) await request.delete(`${base}/api/delete_address`, {
              headers: { Authorization: `Bearer ${mailbox.jwt}` },
            });
          }
        });
      }
    }
  });
}
