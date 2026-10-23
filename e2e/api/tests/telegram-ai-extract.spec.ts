import { test, expect } from '@playwright/test';
import { WORKER_URL, WORKER_URL_ENV_OFF, createTestAddress, deleteAddress } from '../../fixtures/test-helpers';

const ADMIN_HEADERS = { 'x-admin-auth': 'e2e-admin-pass' };

function collectAiExtracts(results: Array<{ metadata?: string | null }>) {
  return results.flatMap((mail) => {
    if (!mail.metadata) return [];
    try {
      const metadata = JSON.parse(mail.metadata);
      return metadata.ai_extract ? [metadata.ai_extract] : [];
    } catch {
      return [];
    }
  });
}

test.describe('Telegram AI extraction rendering', () => {
  test('realtime mail stores AI extraction metadata for Telegram rendering', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'tg-ai');

    try {
      const subject = `Telegram AI realtime ${Date.now()}`;
      const raw = [
        'From: sender@test.example.com',
        `To: ${address}`,
        `Subject: ${subject}`,
        `Message-ID: <telegram-ai-${Date.now()}@test>`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        '',
        'Telegram AI extraction realtime body',
      ].join('\r\n');

      const receiveRes = await request.post(`${WORKER_URL}/__test/receive_mail`, {
        data: {
          from: 'sender@test.example.com',
          to: address,
          raw,
          ai_extract_result: {
            type: 'auth_code',
            result: '123456',
            result_text: '',
          },
        },
      });
      expect(receiveRes.ok()).toBe(true);
      const receiveBody = await receiveRes.json();
      expect(receiveBody.success).toBe(true);

      const mailsRes = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(mailsRes.ok()).toBe(true);
      const { results } = await mailsRes.json();
      expect(results).toHaveLength(1);

      const metadata = JSON.parse(results[0].metadata);
      expect(metadata.ai_extract).toEqual({
        type: 'auth_code',
        result: '123456',
        result_text: '',
      });
      expect(metadata.extracted_at).toBeTruthy();
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('local extract mode uses built-in rules on subject and body, never calling AI', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'tg-local');

    try {
      const raw = [
        'From: sender@test.example.com',
        `To: ${address}`,
        'Subject: G-482913 is your Google verification code',
        `Message-ID: <local-extract-${Date.now()}@test>`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        '',
        'Thanks for signing up. This message has no code in its body.',
      ].join('\r\n');

      const receiveRes = await request.post(`${WORKER_URL}/__test/receive_mail`, {
        data: {
          from: 'sender@test.example.com',
          to: address,
          raw,
          extract_mode: 'local',
          // The AI binding is still present; local mode must ignore this result.
          ai_extract_result: {
            type: 'auth_link',
            result: 'https://example.com/should-not-be-used',
            result_text: '',
          },
        },
      });
      expect(receiveRes.ok()).toBe(true);
      expect((await receiveRes.json()).success).toBe(true);

      const mailsRes = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(mailsRes.ok()).toBe(true);
      const { results } = await mailsRes.json();
      expect(results).toHaveLength(1);

      const metadata = JSON.parse(results[0].metadata);
      expect(metadata.ai_extract).toEqual({
        type: 'auth_code',
        result: '482913',
        result_text: '',
      });
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('ai allowlist only gates Workers AI and falls back to local rules on miss', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'tg-ai-local-fallback');

    try {
      const offSettingsRes = await request.post(`${WORKER_URL}/admin/ai_extract/settings`, {
        headers: ADMIN_HEADERS,
        data: {
          enableAllowList: false,
          allowList: [],
        },
      });
      expect(offSettingsRes.ok()).toBe(true);

      const aiRaw = [
        'From: sender@test.example.com',
        `To: ${address}`,
        'Subject: AI allowlist off',
        `Message-ID: <ai-allowlist-off-${Date.now()}@test>`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        '',
        'Your verification code is: 593817',
      ].join('\r\n');

      const aiReceiveRes = await request.post(`${WORKER_URL}/__test/receive_mail`, {
        data: {
          from: 'sender@test.example.com',
          to: address,
          raw: aiRaw,
          extract_mode: 'ai',
          ai_extract_result: {
            type: 'auth_link',
            result: 'https://example.com/ai-used',
            result_text: '',
          },
        },
      });
      expect(aiReceiveRes.ok()).toBe(true);
      expect((await aiReceiveRes.json()).success).toBe(true);

      const aiMailsRes = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(aiMailsRes.ok()).toBe(true);
      const aiMailsBody = await aiMailsRes.json();
      expect(aiMailsBody.results[0].metadata).toBeTruthy();
      expect(JSON.parse(aiMailsBody.results[0].metadata).ai_extract).toEqual({
        type: 'auth_link',
        result: 'https://example.com/ai-used',
        result_text: '',
      });

      const emptySettingsRes = await request.post(`${WORKER_URL}/admin/ai_extract/settings`, {
        headers: ADMIN_HEADERS,
        data: {
          enableAllowList: true,
          allowList: [],
        },
      });
      expect(emptySettingsRes.ok()).toBe(true);

      const emptyRaw = [
        'From: sender@test.example.com',
        `To: ${address}`,
        'Subject: AI allowlist empty fallback',
        `Message-ID: <ai-allowlist-empty-${Date.now()}@test>`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        '',
        'Your verification code is: 814206',
      ].join('\r\n');

      const emptyReceiveRes = await request.post(`${WORKER_URL}/__test/receive_mail`, {
        data: {
          from: 'sender@test.example.com',
          to: address,
          raw: emptyRaw,
          extract_mode: 'ai',
          ai_extract_result: {
            type: 'auth_link',
            result: 'https://example.com/empty-allowlist-should-not-be-used',
            result_text: '',
          },
        },
      });
      expect(emptyReceiveRes.ok()).toBe(true);
      expect((await emptyReceiveRes.json()).success).toBe(true);

      const onSettingsRes = await request.post(`${WORKER_URL}/admin/ai_extract/settings`, {
        headers: ADMIN_HEADERS,
        data: {
          enableAllowList: true,
          allowList: ['allowed@example.com'],
        },
      });
      expect(onSettingsRes.ok()).toBe(true);

      const raw = [
        'From: sender@test.example.com',
        `To: ${address}`,
        'Subject: AI allowlist fallback',
        `Message-ID: <ai-allowlist-fallback-${Date.now()}@test>`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        '',
        'Your verification code is: 593817',
      ].join('\r\n');

      const receiveRes = await request.post(`${WORKER_URL}/__test/receive_mail`, {
        data: {
          from: 'sender@test.example.com',
          to: address,
          raw,
          extract_mode: 'ai',
          // If Workers AI were called, this would win. An allowlist miss must
          // skip AI and use local extraction instead.
          ai_extract_result: {
            type: 'auth_link',
            result: 'https://example.com/should-not-be-used',
            result_text: '',
          },
        },
      });
      expect(receiveRes.ok()).toBe(true);
      expect((await receiveRes.json()).success).toBe(true);

      const mailsRes = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(mailsRes.ok()).toBe(true);
      const { results } = await mailsRes.json();
      expect(results.length).toBeGreaterThanOrEqual(3);

      const aiExtracts = collectAiExtracts(results);
      expect(aiExtracts).toContainEqual({
        type: 'auth_code',
        result: '593817',
        result_text: '',
      });
      expect(aiExtracts).toContainEqual({
        type: 'auth_code',
        result: '814206',
        result_text: '',
      });
    } finally {
      try {
        const resetSettingsRes = await request.post(`${WORKER_URL}/admin/ai_extract/settings`, {
          headers: ADMIN_HEADERS,
          data: {
            enableAllowList: false,
            allowList: [],
          },
        });
        expect(resetSettingsRes.ok()).toBe(true);
      } finally {
        await deleteAddress(request, jwt);
      }
    }
  });

  test('env-off worker keeps extraction disabled without test overrides', async ({ request }) => {
    test.skip(!WORKER_URL_ENV_OFF, 'WORKER_URL_ENV_OFF is not configured');

    const { jwt, address, address_id } = await createTestAddress(request, 'tg-extract-off', 'test.example.com', WORKER_URL_ENV_OFF);

    try {
      const raw = [
        'From: sender@test.example.com',
        `To: ${address}`,
        'Subject: Extraction disabled',
        `Message-ID: <extract-off-${Date.now()}@test>`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        '',
        'Your verification code is: 374829',
      ].join('\r\n');

      const receiveRes = await request.post(`${WORKER_URL_ENV_OFF}/__test/receive_mail`, {
        data: {
          from: 'sender@test.example.com',
          to: address,
          raw,
        },
      });
      expect(receiveRes.ok()).toBe(true);
      expect((await receiveRes.json()).success).toBe(true);

      const mailsRes = await request.get(`${WORKER_URL_ENV_OFF}/api/mails?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(mailsRes.ok()).toBe(true);
      const { results } = await mailsRes.json();
      expect(results).toHaveLength(1);
      expect(results[0].metadata).toBeFalsy();
    } finally {
      const deleteRes = await request.delete(`${WORKER_URL_ENV_OFF}/admin/delete_address/${address_id}`);
      expect(deleteRes.ok()).toBe(true);
    }
  });
});
