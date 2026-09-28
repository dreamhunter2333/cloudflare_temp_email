import { test, expect } from '@playwright/test';
import { isBlocked } from '../../../worker/src/email/black_list';
import { CONSTANTS } from '../../../worker/src/constants';
import { WORKER_URL, createTestAddress, deleteAddress } from '../../fixtures/test-helpers';

const blockedDomain = 'blocked-sender.e2e.invalid';
const blocked = `sender@${blockedDomain}`;
const allowed = 'sender@allowed.e2e.invalid';

const senderMessage = (from: string, headerFrom?: string) => ({
  from,
  headers: new Headers(headerFrom ? { From: headerFrom } : {}),
});

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
      ['second From address matches', allowed, `${allowed}, ${blocked}`, true],
      ['multiple allowed From addresses', allowed, `${allowed}, other@allowed.e2e.invalid`, false],
      ['quoted display name with comma', allowed, `"Example, Inc." <${blocked}>`, true],
      ['display name is not matched', allowed, `"${blocked}" <${allowed}>`, false],
      ['encoded display name', allowed, `=?UTF-8?B?5rWL6K+V?= <${blocked}>`, true],
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
        expect(await isBlocked(senderMessage(from, headerFrom), env)).toBe(expected);
        expect(reads).toBe(source === 'environment' && expected ? 0 : 1);
      });
    }
  }

  test('environment blacklist works without KV', async () => {
    const env = { BLACK_LIST: blockedDomain } as Bindings;
    expect(await isBlocked(senderMessage(allowed, blocked), env)).toBe(true);
    expect(await isBlocked(senderMessage(allowed), env)).toBe(false);
    expect(await isBlocked(senderMessage(allowed, blocked), {} as Bindings)).toBe(false);
  });

  test('missing KV value does not reject mail', async () => {
    const env = { KV: { get: async () => null } } as unknown as Bindings;
    expect(await isBlocked(senderMessage(allowed, blocked), env)).toBe(false);
  });

  for (const source of ['environment', 'KV']) {
    for (const failure of ['header read', 'address parsing']) {
      for (const from of [blocked, allowed]) {
        test(`${source}: ${failure} failure preserves envelope check for ${from}`, async () => {
          const message = senderMessage(from);
          message.headers.get = () => {
            if (failure === 'header read') throw new Error('Injected header read failure');
            return { toString: () => { throw new Error('Injected address parsing failure'); } } as unknown as string;
          };
          let reads = 0;
          const env = {
            BLACK_LIST: source === 'environment' ? blockedDomain : '',
            KV: { get: async () => {
              reads++;
              return source === 'KV' ? [blockedDomain] : [];
            } },
          } as unknown as Bindings;
          expect(await isBlocked(message, env)).toBe(from === blocked);
          expect(reads).toBe(source === 'environment' && from === blocked ? 0 : 1);
        });
      }
    }

    for (const [name, rule, expected] of [
      ['exact address', blocked, true],
      ['substring', 'blocked-sender', true],
      ['case sensitive', blocked.toUpperCase(), false],
      ['does not trim rules', ` ${blockedDomain}`, false],
      ['empty rule matches', '', true],
    ] as const) {
      test(`${source}: preserves legacy ${name}`, async () => {
        const env = {
          BLACK_LIST: source === 'environment' ? `other.invalid,${rule}` : '',
          KV: { get: async () => source === 'KV' ? ['other.invalid', rule] : [] },
        } as unknown as Bindings;
        expect(await isBlocked(senderMessage(blocked), env)).toBe(expected);
      });
    }
  }

  test('does not swallow existing KV errors', async () => {
    const env = {
      KV: { get: async () => { throw new Error('KV unavailable'); } },
    } as unknown as Bindings;
    await expect(isBlocked(senderMessage(allowed), env)).rejects.toThrow('KV unavailable');
  });
});

test.describe('Sender blacklist receive pipeline', () => {
  for (const [name, from, header, rejected, nestedMime] of [
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
    ['second From address matches', allowed, `From: ${allowed}, ${blocked}\r\nSender: ${allowed}`, true],
    ['multiple allowed From addresses', allowed, `From: ${allowed}, other@allowed.e2e.invalid\r\nSender: ${allowed}`, false],
    ['repeated From headers', allowed, `From: ${allowed}\r\nFrom: ${blocked}`, true],
    ['blocked From with excessive MIME nesting', allowed, `From: ${blocked}`, true, true],
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
          ...(nestedMime ? [
            'Content-Type: multipart/mixed; boundary=b0',
            '',
            ...Array.from({ length: 260 }, (_, i) => [
              `--b${i}`,
              `Content-Type: multipart/mixed; boundary=b${i + 1}`,
              '',
            ]).flat(),
          ] : ['Content-Type: text/plain; charset=utf-8', '']),
          'Sender blacklist test',
          ...(nestedMime ? Array.from({ length: 261 }, (_, i) => `--b${260 - i}--`) : []),
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
