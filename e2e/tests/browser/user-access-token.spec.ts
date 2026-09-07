import { expect, test, type Page } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { FRONTEND_URL, WORKER_URL, createTestAddress, deleteAddress, hashPassword, getAddressSender, onMailpitMessage } from '../../fixtures/test-helpers';

const accessToken = (expiresIn: number) => {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expiresIn })).toString('base64url');
  return `e30.${payload}.signature`;
};

const openApiTestPage = async (page: Page) => {
  // Isolate API calls from the application's automatic settings requests.
  await page.route(`${FRONTEND_URL}/api-test`, (route) => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><html><body></body></html>',
  }));
  await page.goto(`${FRONTEND_URL}/api-test`);
};

const expiredTokenResponse = { status: 401, json: { code: 'AUTH_USER_ACCESS_TOKEN_EXPIRED', message: 'Access token expired' } };

for (const scenario of ['expired', 'expiring', 'valid', 'no account', 'login expired', 'wrong password', 'text zh', 'text en', 'retry expired', 'retry unauthorized', 'unmatched path', 'server error', 'json client error', 'json server error'] as const) {
  test(`Access token response handling: ${scenario}`, async ({ page }) => {
    await openApiTestPage(page);

    const initialToken = accessToken(scenario === 'valid' ? 3600 : scenario === 'expiring' ? 20 : -60);
    const freshToken = accessToken(7200);
    const path = scenario === 'unmatched path' ? '/open_api/settings' : '/admin/db_version';
    let refreshCount = 0;
    const attempts: string[] = [];
    await page.route('**/user_api/settings', async (route) => {
      refreshCount++;
      expect(route.request().headers()['x-user-token']).toBe('account-token');
      await route.fulfill(scenario === 'login expired'
        ? { status: 401, contentType: 'text/plain', body: 'Please login again' }
        : { json: { access_token: freshToken } });
    });
    await page.route(`**${path}`, async (route) => {
      attempts.push(route.request().headers()['x-user-access-token']);
      if (scenario.startsWith('json')) {
        await route.fulfill({
          status: scenario === 'json client error' ? 403 : 503,
          json: { code: 'OPERATION_FAILED', message: 'Operation failed' },
        });
        return;
      }
      if (scenario === 'server error') {
        await route.fulfill({ status: 500, body: 'Server error' });
        return;
      }
      if (!['valid', 'expiring', 'wrong password'].includes(scenario)
        && (attempts.length === 1 || scenario === 'retry expired')) {
        await route.fulfill(scenario.startsWith('text')
          ? { status: 401, body: scenario === 'text zh' ? '您的访问令牌已过期, 请刷新页面' : 'Your access token has expired, please refresh the page' }
          : expiredTokenResponse);
        return;
      }
      await route.fulfill(['wrong password', 'retry unauthorized'].includes(scenario)
        ? { status: 401, contentType: 'text/plain', body: 'Admin password required' }
        : { json: { current_db_version: 'test-version' } });
    });

    const result = await page.evaluate(async ({ initialToken, scenario, path }) => {
      const apiModule = '/src/api/index.js';
      const storeModule = '/src/store/index.js';
      const { api } = await import(apiModule);
      const state = (await import(storeModule)).useGlobalState();
      state.userJwt.value = scenario === 'no account' ? '' : 'account-token';
      state.userSettings.value.access_token = initialToken;
      state.adminAuth.value = scenario === 'wrong password' ? 'wrong-password' : '';
      state.showAdminAuth.value = false;
      try {
        return { data: await api.fetch(path), error: null, showAdminAuth: state.showAdminAuth.value };
      } catch (error) {
        return { data: null, error: String(error), showAdminAuth: state.showAdminAuth.value };
      }
    }, { initialToken, scenario, path });

    const needsRefresh = !['valid', 'expiring', 'no account', 'wrong password', 'text zh', 'text en', 'unmatched path', 'server error', 'json client error', 'json server error'].includes(scenario);
    expect(refreshCount).toBe(needsRefresh ? 1 : 0);
    expect(attempts).toEqual(needsRefresh && scenario !== 'login expired' ? [initialToken, freshToken] : [initialToken]);
    expect(result.showAdminAuth).toBe(['wrong password', 'retry unauthorized'].includes(scenario) || scenario.startsWith('text'));
    if (scenario === 'login expired') expect(result.error).toContain('Please login again');
    else if (['wrong password', 'retry unauthorized'].includes(scenario)) expect(result.error).toContain('Admin password required');
    else if (['retry expired', 'no account', 'unmatched path'].includes(scenario)) expect(result.error).toContain('Access token expired');
    else if (scenario === 'server error') expect(result.error).toContain('Server error');
    else if (scenario.startsWith('text')) {
      expect(result.error).toContain(scenario === 'text zh'
        ? '您的访问令牌已过期, 请刷新页面'
        : 'Your access token has expired, please refresh the page');
    }
    else if (scenario.startsWith('json')) {
      expect(result.error).toContain('Operation failed');
      expect(result.error).not.toContain('[object Object]');
    }
    else expect(result.data).toEqual({ current_db_version: 'test-version' });
  });
}

test('concurrent and late responses share one access token refresh', async ({ page }) => {
  await openApiTestPage(page);
  const initialToken = accessToken(-60);
  const freshToken = accessToken(7200);
  const paths = ['/admin/db_version', '/api/settings', '/api/send_mail',
    '/user_api/bind_address', '/user_api/address/1/settings'];
  let refreshCount = 0;
  const initialPaths: string[] = [];
  const attempts: string[] = [];
  let release!: () => void;
  let releaseLate!: () => void;
  const refreshPending = new Promise<void>((resolve) => { release = resolve; });
  const lateResponse = new Promise<void>((resolve) => { releaseLate = resolve; });
  await page.route('**/user_api/settings', async (route) => {
    refreshCount++;
    await refreshPending;
    await route.fulfill({ json: { access_token: freshToken } });
  });
  await page.route((url) => paths.includes(url.pathname), async (route) => {
    if (route.request().headers()['x-user-access-token'] === initialToken) {
      const requestPath = new URL(route.request().url()).pathname;
      initialPaths.push(requestPath);
      if (requestPath === paths.at(-1)) await lateResponse;
      await route.fulfill(expiredTokenResponse);
      return;
    }
    attempts.push(route.request().headers()['x-user-access-token']);
    await route.fulfill({ json: { success: true } });
  });
  const pending = page.evaluate(async ({ initialToken, paths }) => {
    const apiModule = '/src/api/index.js';
    const storeModule = '/src/store/index.js';
    const { api } = await import(apiModule);
    const state = (await import(storeModule)).useGlobalState();
    state.userJwt.value = 'account-token';
    state.userSettings.value.access_token = initialToken;
    return Promise.all(paths.map((path) => api.fetch(path, {
      method: path === '/api/send_mail' ? 'POST' : 'GET',
    })));
  }, { initialToken, paths });
  try {
    await expect.poll(() => refreshCount).toBe(1);
    await expect.poll(() => initialPaths.length).toBe(paths.length);
    expect(attempts).toEqual([]);
    release();
    await expect.poll(() => attempts.length).toBe(paths.length - 1);
  } finally {
    release();
    releaseLate();
  }
  expect(await pending).toEqual(paths.map(() => ({ success: true })));
  expect(refreshCount).toBe(1);
  expect(attempts).toEqual(paths.map(() => freshToken));
});

for (const failure of [400, 401, 500, 'network'] as const) {
  test(`failed shared refresh preserves independent mailbox requests: ${failure}`, async ({ page }) => {
    await openApiTestPage(page);
    const paths = ['/admin/db_version', '/user_api/bind_address', '/user_api/address/1/settings',
      '/api/settings', '/api/send_mail'];
    const attempts: string[] = [];
    let initialResponses = 0;
    page.on('response', async (response) => {
      if (paths.includes(new URL(response.url()).pathname) && response.status() === 401) {
        await response.finished();
        initialResponses++;
      }
    });
    let refreshCount = 0;
    let release!: () => void;
    const refreshPending = new Promise<void>((resolve) => { release = resolve; });
    const freshToken = accessToken(7200);
    await page.route('**/user_api/settings', async (route) => {
      refreshCount++;
      if (refreshCount > 1) {
        await route.fulfill({ json: { access_token: freshToken } });
        return;
      }
      await refreshPending;
      if (failure === 'network') await route.abort('failed');
      else await route.fulfill({ status: failure, body: 'Refresh failed' });
    });
    await page.route((url) => paths.includes(url.pathname), async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().headers()['x-user-access-token'] && route.request().headers()['x-user-access-token'] !== freshToken) {
        await route.fulfill(expiredTokenResponse);
        return;
      }
      attempts.push(path);
      await route.fulfill(path === '/api/send_mail'
        ? { status: 403, body: 'No send balance' }
        : { json: { success: true } });
    });
    const pending = page.evaluate(async ({ paths, initialToken }) => {
      const apiModule = '/src/api/index.js';
      const storeModule = '/src/store/index.js';
      const { api } = await import(apiModule);
      const state = (await import(storeModule)).useGlobalState();
      state.userJwt.value = 'account-token';
      state.userSettings.value.access_token = initialToken;
      state.adminAuth.value = '';
      state.openSettings.value.needAuth = true;
      state.showAuth.value = false;
      state.showAdminAuth.value = false;
      const results = await Promise.all(paths.map(async (path) => {
        try {
          return { data: await api.fetch(path, { method: path === '/api/send_mail' ? 'POST' : 'GET' }) };
        } catch (error) {
          return { error: String(error) };
        }
      }));
      const flags = { showAuth: state.showAuth.value, showAdminAuth: state.showAdminAuth.value, loading: state.loading.value };
      await api.fetch('/admin/db_version');
      return { results, flags };
    }, { paths, initialToken: accessToken(-60) });
    try {
      await expect.poll(() => initialResponses).toBe(paths.length);
      await expect.poll(() => refreshCount).toBe(1);
      expect(attempts).toEqual([]);
    } finally {
      release();
    }
    const { results, flags } = await pending;
    for (const result of results.slice(0, 3)) {
      expect(result.error).toContain(failure === 'network' ? 'Network Error' : 'Refresh failed');
    }
    expect(results[3].data).toEqual({ success: true });
    expect(results[4].error).toContain('[403]: No send balance');
    expect(flags).toEqual({ showAuth: false, showAdminAuth: false, loading: false });
    expect(refreshCount).toBe(2);
    expect(attempts.slice(0, 2).sort()).toEqual(['/api/send_mail', '/api/settings']);
    expect(attempts.slice(2)).toEqual(['/admin/db_version']);
  });
}

for (const changedCredential of ['account', 'mailbox'] as const) {
  test(`a changed ${changedCredential} stops the waiting request after refresh`, async ({ page }) => {
    await openApiTestPage(page);
    const path = changedCredential === 'mailbox' ? '/api/send_mail' : '/admin/db_version';
    const freshToken = accessToken(7200);
    let attempts = 0;
    await page.route(`**${path}`, async (route) => {
      attempts++;
      await route.fulfill(attempts === 1 ? expiredTokenResponse : { json: { success: true } });
    });
    await page.route('**/user_api/settings', async (route) => {
      await page.evaluate(async (changedCredential) => {
        const storeModule = '/src/store/index.js';
        const state = (await import(storeModule)).useGlobalState();
        if (changedCredential === 'account') {
          state.userJwt.value = 'other-account';
          state.userSettings.value = { access_token: 'other-access-token' };
        } else {
          state.jwt.value = 'other-mailbox';
        }
      }, changedCredential);
      await route.fulfill({ json: { access_token: freshToken } });
    });
    const result = await page.evaluate(async ({ initialToken, path }) => {
      const apiModule = '/src/api/index.js';
      const storeModule = '/src/store/index.js';
      const { api } = await import(apiModule);
      const state = (await import(storeModule)).useGlobalState();
      state.userJwt.value = 'account-token';
      state.jwt.value = 'mailbox-token';
      state.userSettings.value.access_token = initialToken;
      state.adminAuth.value = '';
      try {
        await api.fetch(path, { method: path === '/api/send_mail' ? 'POST' : 'GET' });
        return null;
      } catch (error) {
        return { error: String(error), token: state.userSettings.value.access_token, loading: state.loading.value };
      }
    }, { initialToken: accessToken(-60), path });
    expect(result).toEqual({
      error: 'Error: User session changed, please retry',
      token: changedCredential === 'account' ? 'other-access-token' : freshToken,
      loading: false,
    });
    expect(attempts).toBe(1);
  });
}

for (const [scenario, query] of [
  ['expired account', ''],
  ['deleted account', ''],
  ['valid account', ''],
  ['missing account', ''],
  ['missing expiry', ''],
  ['expired account', '?refresh=1&source=e2e'],
  ['deleted account', '?refresh=1&source=e2e'],
  ['valid account', '?refresh=1&source=e2e'],
  ['missing account', '?refresh=1&source=e2e'],
  ['missing expiry', '?refresh=1&source=e2e'],
] as const) {
  test(`mailbox operations use the real Worker when ${scenario}, query: ${query || 'none'}`, async ({ page, request }) => {
    const address = await createTestAddress(request, 'refresh-mailbox-');
    let userId: number | undefined;
    try {
      const email = `refresh-account-${Date.now()}@test.example.com`;
      const created = await request.post(`${WORKER_URL}/admin/users`, {
        data: { email, password: hashPassword('test-password-123') },
      });
      expect(created.ok()).toBe(true);
      const users = await request.get(`${WORKER_URL}/admin/users`, {
        params: { limit: 10, offset: 0, query: email },
      });
      expect(users.ok()).toBe(true);
      userId = (await users.json()).results.find((user: any) => user.user_email === email).id;

      const sign = (payload: Record<string, unknown>) => {
        const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
        const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const signature = createHmac('sha256', 'e2e-test-secret-key').update(`${header}.${body}`).digest('base64url');
        return `${header}.${body}.${signature}`;
      };
      const now = Math.floor(Date.now() / 1000);
      const claims = { user_id: userId, user_email: email, iat: now - 3600 };
      const userJwt = scenario === 'missing account' ? ''
        : sign({ ...claims, exp: now + (scenario === 'expired account' ? -60 : 3600) });
      const expiredAccessToken = sign({ ...claims, exp: scenario === 'missing expiry' ? undefined : now - 60, user_role: 'case-role' });
      if (scenario === 'deleted account') {
        expect((await request.delete(`${WORKER_URL}/admin/users/${userId}`)).ok()).toBe(true);
      }

      // Exercise the browser API module without the UI's automatic settings requests.
      await page.route(`${FRONTEND_URL}/api-test`, (route) => route.fulfill({
        contentType: 'text/html', body: '<!doctype html><html><body></body></html>',
      }));
      await page.goto(`${FRONTEND_URL}/api-test`);
      const refreshStatuses: number[] = [];
      let sendCount = 0;
      page.on('response', (response) => {
        if (new URL(response.url()).pathname === '/user_api/settings') refreshStatuses.push(response.status());
      });
      page.on('request', (req) => {
        const url = new URL(req.url());
        if (['/api/settings', '/api/send_mail'].includes(url.pathname)) expect(url.search).toBe(query);
        if (url.pathname === '/api/send_mail') sendCount++;
      });
      const settings = await page.evaluate(async ({ userJwt, expiredAccessToken, mailboxJwt, query }) => {
        const apiModule = '/src/api/index.js';
        const storeModule = '/src/store/index.js';
        const { api } = await import(apiModule);
        const state = (await import(storeModule)).useGlobalState();
        state.userJwt.value = userJwt;
        state.userSettings.value.access_token = expiredAccessToken;
        state.jwt.value = mailboxJwt;
        state.adminAuth.value = '';
        return api.fetch(`/api/settings${query}`);
      }, { userJwt, expiredAccessToken, mailboxJwt: address.jwt, query });
      expect(settings.address).toBe(address.address);
      expect(settings.send_balance).toBe(10);

      const subject = `Mailbox refresh regression ${scenario} ${Date.now()}`;
      const listener = onMailpitMessage((mail) => mail.Subject === subject);
      await listener.ready;
      const [mail] = await Promise.all([
        listener.message,
        page.evaluate(async ({ subject, query }) => {
          const apiModule = '/src/api/index.js';
          const { api } = await import(apiModule);
          await api.fetch(`/api/send_mail${query}`, {
            method: 'POST',
            body: { to_mail: 'recipient@test.example.com', subject, content: 'Independent mailbox credential', is_html: false },
          });
        }, { subject, query }),
      ]);
      expect(mail.From.Address).toBe(address.address);
      expect(sendCount).toBe(scenario === 'valid account' || scenario === 'missing expiry' ? 1 : 2);
      expect((await getAddressSender(request, address.address)).balance).toBe(9);
      const sent = await request.get(`${WORKER_URL}/admin/sendbox`, {
        params: { address: address.address, limit: 10, offset: 0 },
      });
      expect(sent.ok()).toBe(true);
      expect((await sent.json()).results).toHaveLength(1);
      expect(refreshStatuses).toEqual(scenario === 'valid account' ? [200]
        : scenario === 'missing account' || scenario === 'missing expiry' ? []
          : scenario === 'expired account' ? [401, 401] : [400, 400]);
    } finally {
      await deleteAddress(request, address.jwt);
      if (userId !== undefined) await request.delete(`${WORKER_URL}/admin/users/${userId}`);
    }
  });
}
