import { test, expect, APIRequestContext } from '@playwright/test';
import {
  WORKER_URL,
  createTestAddress,
  deleteAddress,
  deleteAllMailpitMessages,
  requestSendAccess,
  onMailpitMessage,
} from '../../fixtures/test-helpers';

const ADMIN_PASSWORD = 'e2e-admin-pass';
const ADMIN_HEADERS = { 'x-admin-auth': ADMIN_PASSWORD };

const DEFAULT_ACCOUNT_SETTINGS = {
  blockList: [],
  sendBlockList: [],
  verifiedAddressList: [],
  fromBlockList: [],
  noLimitSendAddressList: [],
  emailRuleSettings: {},
  addressCreationSettings: {},
};

const DISABLED_LIMIT_CONFIG = {
  dailyEnabled: false,
  monthlyEnabled: false,
  dailyLimit: null as number | null,
  monthlyLimit: null as number | null,
};

async function saveLimitConfig(
  request: APIRequestContext,
  sendMailLimitConfig: Record<string, unknown>
) {
  return request.post(`${WORKER_URL}/admin/account_settings`, {
    headers: ADMIN_HEADERS,
    data: { ...DEFAULT_ACCOUNT_SETTINGS, sendMailLimitConfig },
  });
}

async function resetLimitConfig(request: APIRequestContext) {
  const res = await saveLimitConfig(request, DISABLED_LIMIT_CONFIG);
  expect(res.ok()).toBe(true);
}

async function sendOneMail(
  request: APIRequestContext,
  jwt: string,
  tag: string,
  opts: { expectDelivery?: boolean; lang?: string } = {}
) {
  const { expectDelivery = true, lang } = opts;
  const subject = `limit-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${jwt}` };
  if (lang) headers['x-lang'] = lang;

  let listener: ReturnType<typeof onMailpitMessage> | undefined;
  if (expectDelivery) {
    listener = onMailpitMessage((m) => m.Subject === subject);
    await listener.ready;
  }
  const res = await request.post(`${WORKER_URL}/api/send_mail`, {
    headers,
    data: {
      from_name: 'Limit E2E',
      to_name: 'Recipient',
      to_mail: 'recipient@test.example.com',
      subject,
      content: `Limit test body ${tag}`,
      is_html: false,
    },
  });
  return { res, listener, subject };
}

// Probe current daily count by setting dailyLimit=1 and observing the rejection
// message "(<count>/1)". Only usable when current count >= 1 is possible; when
// count == 0 the probe send succeeds instead, so we treat that as baseline 0.
async function probeDailyBaseline(
  request: APIRequestContext,
  jwt: string
): Promise<number> {
  const save = await saveLimitConfig(request, {
    dailyEnabled: true,
    monthlyEnabled: false,
    dailyLimit: 1,
    monthlyLimit: null,
  });
  expect(save.ok()).toBe(true);

  const probe = await request.post(`${WORKER_URL}/api/send_mail`, {
    headers: { Authorization: `Bearer ${jwt}` },
    data: {
      from_name: 'probe',
      to_name: '',
      to_mail: 'recipient@test.example.com',
      subject: `probe-${Date.now()}`,
      content: 'probe',
      is_html: false,
    },
  });
  if (probe.ok()) {
    // current count was 0; probe consumed one slot → baseline is now 1.
    return 1;
  }
  const text = await probe.text();
  const m = text.match(/\((\d+)\/1\)/);
  expect(m, `probe rejection should expose count: ${text}`).not.toBeNull();
  return Number.parseInt(m![1], 10);
}

async function probeMonthlyBaseline(
  request: APIRequestContext,
  jwt: string
): Promise<number> {
  const save = await saveLimitConfig(request, {
    dailyEnabled: false,
    monthlyEnabled: true,
    dailyLimit: null,
    monthlyLimit: 1,
  });
  expect(save.ok()).toBe(true);

  const probe = await request.post(`${WORKER_URL}/api/send_mail`, {
    headers: { Authorization: `Bearer ${jwt}` },
    data: {
      from_name: 'probe',
      to_name: '',
      to_mail: 'recipient@test.example.com',
      subject: `probe-m-${Date.now()}`,
      content: 'probe',
      is_html: false,
    },
  });
  if (probe.ok()) return 1;
  const text = await probe.text();
  const m = text.match(/\((\d+)\/1\)/);
  expect(m, `monthly probe rejection should expose count: ${text}`).not.toBeNull();
  return Number.parseInt(m![1], 10);
}

test.describe('Send Mail Limit', () => {
  test.beforeEach(async ({ request }) => {
    await deleteAllMailpitMessages(request);
    await resetLimitConfig(request);
  });

  test.afterEach(async ({ request }) => {
    await resetLimitConfig(request);
  });

  test('save + read roundtrip preserves all fields', async ({ request }) => {
    const config = {
      dailyEnabled: true,
      monthlyEnabled: true,
      dailyLimit: 7,
      monthlyLimit: 1234,
    };
    const save = await saveLimitConfig(request, config);
    expect(save.ok()).toBe(true);

    const read = await request.get(`${WORKER_URL}/admin/account_settings`, {
      headers: ADMIN_HEADERS,
    });
    expect(read.ok()).toBe(true);
    const body = await read.json();
    expect(body.sendMailLimitConfig).toEqual(config);
  });

  test('disabled flags coerce numeric limits to null', async ({ request }) => {
    const save = await saveLimitConfig(request, {
      dailyEnabled: false,
      monthlyEnabled: false,
      dailyLimit: 10,
      monthlyLimit: 20,
    });
    expect(save.ok()).toBe(true);

    const read = await request.get(`${WORKER_URL}/admin/account_settings`, {
      headers: ADMIN_HEADERS,
    });
    const body = await read.json();
    expect(body.sendMailLimitConfig).toEqual(DISABLED_LIMIT_CONFIG);
  });

  test('minus one is accepted as unlimited', async ({ request }) => {
    const config = {
      dailyEnabled: true,
      monthlyEnabled: true,
      dailyLimit: -1,
      monthlyLimit: -1,
    };
    const save = await saveLimitConfig(request, config);
    expect(save.ok()).toBe(true);

    const read = await request.get(`${WORKER_URL}/admin/account_settings`, {
      headers: ADMIN_HEADERS,
    });
    const body = await read.json();
    expect(body.sendMailLimitConfig).toEqual(config);
  });

  test('invalid payloads rejected with 400', async ({ request }) => {
    const cases: Array<Record<string, unknown>> = [
      { dailyEnabled: 'yes', monthlyEnabled: false, dailyLimit: null, monthlyLimit: null },
      { dailyEnabled: true, monthlyEnabled: false, dailyLimit: -2, monthlyLimit: null },
      { dailyEnabled: true, monthlyEnabled: false, dailyLimit: 1.5, monthlyLimit: null },
      { dailyEnabled: true, monthlyEnabled: false, dailyLimit: null, monthlyLimit: null },
      { dailyEnabled: false, monthlyEnabled: true, dailyLimit: null, monthlyLimit: null },
    ];
    for (const bad of cases) {
      const res = await saveLimitConfig(request, bad);
      expect(res.status(), `payload: ${JSON.stringify(bad)}`).toBe(400);
    }
  });

  test('disabled limit allows unlimited sends', async ({ request }) => {
    const { jwt } = await createTestAddress(request, 'limit-off');
    await requestSendAccess(request, jwt);
    await resetLimitConfig(request);

    for (let i = 0; i < 3; i++) {
      const { res, listener } = await sendOneMail(request, jwt, `off${i}`);
      expect(res.ok()).toBe(true);
      await listener!.message;
    }
    await deleteAddress(request, jwt);
  });

  test('zero limit blocks sending immediately', async ({ request }) => {
    const { jwt } = await createTestAddress(request, 'limit-zero');
    await requestSendAccess(request, jwt);

    const save = await saveLimitConfig(request, {
      dailyEnabled: true,
      monthlyEnabled: false,
      dailyLimit: 0,
      monthlyLimit: null,
    });
    expect(save.ok()).toBe(true);

    const { res } = await sendOneMail(request, jwt, 'zero', {
      expectDelivery: false,
    });
    expect(res.ok()).toBe(false);
    const text = await res.text();
    expect(text).toContain('0/0');

    await deleteAddress(request, jwt);
  });

  test('daily limit blocks once reached and returns English message', async ({ request }) => {
    const { jwt } = await createTestAddress(request, 'limit-daily');
    await requestSendAccess(request, jwt);

    const baseline = await probeDailyBaseline(request, jwt);
    const allowed = 2;
    const limit = baseline + allowed;

    const save = await saveLimitConfig(request, {
      dailyEnabled: true,
      monthlyEnabled: false,
      dailyLimit: limit,
      monthlyLimit: null,
    });
    expect(save.ok()).toBe(true);

    for (let i = 0; i < allowed; i++) {
      const { res, listener } = await sendOneMail(request, jwt, `d${i}`);
      expect(res.ok(), `send #${i} should succeed`).toBe(true);
      await listener!.message;
    }

    const { res: blocked } = await sendOneMail(request, jwt, 'd-over', {
      expectDelivery: false,
    });
    expect(blocked.ok()).toBe(false);
    const text = await blocked.text();
    expect(text).toContain('Daily send quota has been reached');
    expect(text).toContain(`${limit}/${limit}`);

    await deleteAddress(request, jwt);
  });

  test('monthly limit blocks once reached', async ({ request }) => {
    const { jwt } = await createTestAddress(request, 'limit-monthly');
    await requestSendAccess(request, jwt);

    const baseline = await probeMonthlyBaseline(request, jwt);
    const allowed = 2;
    const limit = baseline + allowed;

    const save = await saveLimitConfig(request, {
      dailyEnabled: false,
      monthlyEnabled: true,
      dailyLimit: null,
      monthlyLimit: limit,
    });
    expect(save.ok()).toBe(true);

    for (let i = 0; i < allowed; i++) {
      const { res, listener } = await sendOneMail(request, jwt, `m${i}`);
      expect(res.ok(), `send #${i} should succeed`).toBe(true);
      await listener!.message;
    }

    const { res: blocked } = await sendOneMail(request, jwt, 'm-over', {
      expectDelivery: false,
    });
    expect(blocked.ok()).toBe(false);
    const text = await blocked.text();
    expect(text).toContain('Monthly send quota has been reached');
    expect(text).toContain(`${limit}/${limit}`);

    await deleteAddress(request, jwt);
  });

  test('zh-lang header returns Chinese daily limit message', async ({ request }) => {
    const { jwt } = await createTestAddress(request, 'limit-zh');
    await requestSendAccess(request, jwt);

    const baseline = await probeDailyBaseline(request, jwt);
    const save = await saveLimitConfig(request, {
      dailyEnabled: true,
      monthlyEnabled: false,
      dailyLimit: baseline,
      monthlyLimit: null,
    });
    expect(save.ok()).toBe(true);

    const { res } = await sendOneMail(request, jwt, 'zh-over', {
      expectDelivery: false,
      lang: 'zh',
    });
    expect(res.ok()).toBe(false);
    const text = await res.text();
    expect(text).toContain('今日发信次数已达上限');

    await deleteAddress(request, jwt);
  });

  test('validation failures (missing subject) do not consume quota', async ({ request }) => {
    const { jwt } = await createTestAddress(request, 'limit-noconsume');
    await requestSendAccess(request, jwt);

    const baseline = await probeDailyBaseline(request, jwt);
    const save = await saveLimitConfig(request, {
      dailyEnabled: true,
      monthlyEnabled: false,
      dailyLimit: baseline + 1,
      monthlyLimit: null,
    });
    expect(save.ok()).toBe(true);

    // Empty subject → rejected by validation BEFORE the counter increments.
    const badRes = await request.post(`${WORKER_URL}/api/send_mail`, {
      headers: { Authorization: `Bearer ${jwt}` },
      data: {
        from_name: '',
        to_name: '',
        to_mail: 'recipient@test.example.com',
        subject: '',
        content: 'no subject',
        is_html: false,
      },
    });
    expect(badRes.ok()).toBe(false);

    const { res, listener } = await sendOneMail(request, jwt, 'after-bad');
    expect(res.ok()).toBe(true);
    await listener!.message;

    await deleteAddress(request, jwt);
  });

  test('both daily + monthly enabled: tighter daily limit wins', async ({ request }) => {
    const { jwt } = await createTestAddress(request, 'limit-both');
    await requestSendAccess(request, jwt);

    const baseline = await probeDailyBaseline(request, jwt);
    const save = await saveLimitConfig(request, {
      dailyEnabled: true,
      monthlyEnabled: true,
      dailyLimit: baseline,
      monthlyLimit: baseline + 10_000,
    });
    expect(save.ok()).toBe(true);

    const { res } = await sendOneMail(request, jwt, 'both-over', {
      expectDelivery: false,
    });
    expect(res.ok()).toBe(false);
    const text = await res.text();
    expect(text).toContain('Daily send quota has been reached');

    await deleteAddress(request, jwt);
  });

  test('/admin/send_mail_by_binding returns 400 when SEND_MAIL binding is missing', async ({ request }) => {
    const res = await request.post(`${WORKER_URL}/admin/send_mail_by_binding`, {
      headers: ADMIN_HEADERS,
      data: {
        from: 'admin@test.example.com',
        to: ['recipient@test.example.com'],
        subject: 'no-binding',
        text: 'body',
      },
    });
    expect(res.status()).toBe(400);
  });

  test('daily and monthly counters both increment on successful send', async ({ request }) => {
    const { jwt } = await createTestAddress(request, 'limit-both-inc');
    await requestSendAccess(request, jwt);

    const dailyBaseline = await probeDailyBaseline(request, jwt);
    const monthlyBaseline = await probeMonthlyBaseline(request, jwt);

    // Give plenty of headroom so sends succeed.
    const save = await saveLimitConfig(request, {
      dailyEnabled: true,
      monthlyEnabled: true,
      dailyLimit: dailyBaseline + 10,
      monthlyLimit: monthlyBaseline + 10,
    });
    expect(save.ok()).toBe(true);

    const { res, listener } = await sendOneMail(request, jwt, 'inc');
    expect(res.ok()).toBe(true);
    await listener!.message;

    // Re-probe to confirm both counters moved by exactly the sent amount
    // (probe itself sets dailyLimit=1 which triggers a rejection, so the
    // rejection count reflects the real current value).
    const dailyAfter = await probeDailyBaseline(request, jwt);
    expect(dailyAfter).toBeGreaterThanOrEqual(dailyBaseline + 1);
    const monthlyAfter = await probeMonthlyBaseline(request, jwt);
    expect(monthlyAfter).toBeGreaterThanOrEqual(monthlyBaseline + 1);

    await deleteAddress(request, jwt);
  });

  test('admin /admin/send_mail also respects daily limit', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'limit-admin');
    await requestSendAccess(request, jwt);

    // Probe via a user-facing send to establish baseline.
    const baseline = await probeDailyBaseline(request, jwt);
    const save = await saveLimitConfig(request, {
      dailyEnabled: true,
      monthlyEnabled: false,
      dailyLimit: baseline,
      monthlyLimit: null,
    });
    expect(save.ok()).toBe(true);

    const res = await request.post(`${WORKER_URL}/admin/send_mail`, {
      headers: ADMIN_HEADERS,
      data: {
        from_name: '',
        from_mail: address,
        to_name: '',
        to_mail: 'recipient@test.example.com',
        subject: `admin-over-${Date.now()}`,
        content: 'admin blocked body',
        is_html: false,
      },
    });
    expect(res.ok()).toBe(false);
    const text = await res.text();
    expect(text).toContain('Daily send quota has been reached');

    await deleteAddress(request, jwt);
  });
});
