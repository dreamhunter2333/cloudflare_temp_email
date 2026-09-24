import { test, expect } from '@playwright/test';
import { isBlocked } from '../../../worker/src/email/black_list';
import { CONSTANTS } from '../../../worker/src/constants';
import { WORKER_URL, createTestAddress, deleteAddress } from '../../fixtures/test-helpers';

const blockedDomain = 'blocked-sender.e2e.invalid';
const blocked = `sender@${blockedDomain}`;
const allowed = 'sender@allowed.e2e.invalid';

test.describe('Sender blacklist matching', () => {
  for (const source of ['environment', 'KV']) {
    for (const [name, from, headerFrom, expected] of [
      ['envelope only', blocked, allowed, true],
      ['header only', allowed, blocked, true],
      ['both', blocked, blocked, true],
      ['neither', allowed, allowed, false],
      ['missing header', blocked, undefined, true],
      ['missing header, allowed envelope', allowed, undefined, false],
      ['empty envelope', '', blocked, true],
    ] as const) {
      test(`${source}: ${name}`, async () => {
        let reads = 0;
        const env = {
          BLACK_LIST: source === 'environment' ? `other.invalid,${blockedDomain}` : '',
          KV: {
            get: async (key: string, type: string) => {
              reads++;
              expect(key).toBe(CONSTANTS.EMAIL_KV_BLACK_LIST);
              expect(type).toBe('json');
              return source === 'KV' ? ['other.invalid', blockedDomain] : [];
            },
          },
        } as unknown as Bindings;
        expect(await isBlocked(from, env, headerFrom)).toBe(expected);
        expect(reads).toBe(source === 'environment' && expected ? 0 : 1);
      });
    }
  }

  test('environment blacklist works without KV', async () => {
    const env = { BLACK_LIST: blockedDomain } as Bindings;
    expect(await isBlocked(allowed, env, blocked)).toBe(true);
    expect(await isBlocked(allowed, env)).toBe(false);
    expect(await isBlocked(allowed, {} as Bindings, blocked)).toBe(false);
  });

  test('missing KV value does not reject mail', async () => {
    const env = { KV: { get: async () => null } } as unknown as Bindings;
    expect(await isBlocked(allowed, env, blocked)).toBe(false);
  });
});

test.describe('Sender blacklist receive pipeline', () => {
  for (const [name, from, header, rejected] of [
    ['envelope match', blocked, `From: Trusted <${allowed}>`, true],
    ['parsed From match', allowed, `From: Trusted <${blocked}>`, true],
    ['both match', blocked, `From: ${blocked}`, true],
    ['folded From match', allowed, `From: =?UTF-8?B?5rWL6K+V?=\r\n <${blocked}>`, true],
    ['neither matches', allowed, `From: Other <other@allowed.e2e.invalid>`, false],
    ['display name is not an address', allowed, `From: "${blocked}" <${allowed}>`, false],
    ['Reply-To is not From', allowed, `From: ${allowed}\r\nReply-To: ${blocked}`, false],
    ['missing From still checks envelope', blocked, '', true],
    ['missing From permits allowed envelope', allowed, '', false],
    ['retains case-sensitive matching', allowed, `From: ${blocked.toUpperCase()}`, false],
  ] as const) {
    test(name, async ({ request }) => {
      const { jwt, address } = await createTestAddress(request, 'senderfilter');
      try {
        const raw = [
          ...(header ? [header] : []),
          `To: ${address}`,
          `Subject: Sender blacklist ${name}`,
          `Message-ID: <sender-blacklist-${Date.now()}@test>`,
          'MIME-Version: 1.0',
          'Content-Type: text/plain; charset=utf-8',
          '',
          'Sender blacklist test',
        ].join('\r\n');
        const res = await request.post(`${WORKER_URL}/__test/receive_mail`, {
          data: { from, to: address, raw },
        });
        expect(res.ok()).toBe(true);
        const result = await res.json();
        expect(result.success).toBe(!rejected);
        if (rejected) {
          expect(result.rejected).toBe('Reject from address');
          expect(result.forwardedTo).toEqual([]);
          expect(result.replyCalled).toBe(false);
        }

        const mailsRes = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        expect(mailsRes.ok()).toBe(true);
        const { results } = await mailsRes.json();
        expect(results).toHaveLength(rejected ? 0 : 1);
        if (!rejected) expect(results[0].source).toBe(from);
      } finally {
        await deleteAddress(request, jwt);
      }
    });
  }
});
