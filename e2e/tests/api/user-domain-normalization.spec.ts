import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import http from 'node:http';
import { WORKER_URL } from '../../fixtures/test-helpers';

async function resetUserSettings(request: APIRequestContext) {
  const res = await request.post(`${WORKER_URL}/admin/user_settings`, {
    data: {
      enable: true,
      enableMailVerify: false,
      enableMailAllowList: false,
      mailAllowList: [],
    },
  });
  expect(res.ok()).toBe(true);
}

async function resetOauth2Settings(request: APIRequestContext) {
  const res = await request.post(`${WORKER_URL}/admin/user_oauth2_settings`, {
    data: [],
  });
  expect(res.ok()).toBe(true);
}

async function startOauthServer(email: string): Promise<{ server: http.Server; baseUrl: string }> {
  const server = http.createServer((req, res) => {
    if (req.url === '/token') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ access_token: 'token', token_type: 'Bearer' }));
      return;
    }
    if (req.url === '/userinfo') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ email }));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });

  await new Promise<void>((resolve) => server.listen(0, '0.0.0.0', resolve));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Failed to resolve OAuth test server port');
  const hostname = process.env.CI ? 'e2e-runner' : 'localhost';
  return { server, baseUrl: `http://${hostname}:${addr.port}` };
}

test.describe('User domain normalization', () => {
  test.afterEach(async ({ request }) => {
    await resetOauth2Settings(request);
    await resetUserSettings(request);
  });

  test('normalizes uppercase verify mail sender domain in admin settings', async ({ request }) => {
    const res = await request.post(`${WORKER_URL}/admin/user_settings`, {
      data: {
        enable: true,
        enableMailVerify: true,
        verifyMailSender: 'verify@TEST.EXAMPLE.COM',
      },
    });
    expect(res.ok()).toBe(true);
  });

  test('normalizes uppercase user registration allow-list domains', async ({ request }) => {
    const saveRes = await request.post(`${WORKER_URL}/admin/user_settings`, {
      data: {
        enable: true,
        enableMailVerify: false,
        enableMailAllowList: true,
        mailAllowList: ['TEST.EXAMPLE.COM'],
      },
    });
    expect(saveRes.ok()).toBe(true);

    const registerRes = await request.post(`${WORKER_URL}/user_api/register`, {
      data: {
        email: `allow-list-${Date.now()}@TEST.EXAMPLE.COM`,
        password: 'allow-list-password',
      },
    });
    expect(registerRes.ok()).toBe(true);
  });

  test('normalizes uppercase OAuth2 allow-list domains', async ({ request }) => {
    const email = `oauth-allow-${Date.now()}@TEST.EXAMPLE.COM`;
    const { server, baseUrl } = await startOauthServer(email);

    try {
      const saveRes = await request.post(`${WORKER_URL}/admin/user_oauth2_settings`, {
        data: [{
          name: 'case-oauth',
          clientID: 'case-client',
          clientSecret: 'case-secret',
          authorizationURL: `${baseUrl}/authorize`,
          accessTokenURL: `${baseUrl}/token`,
          accessTokenFormat: 'json',
          userInfoURL: `${baseUrl}/userinfo`,
          redirectURL: `${baseUrl}/callback`,
          userEmailKey: 'email',
          scope: 'openid email',
          enableMailAllowList: true,
          mailAllowList: ['TEST.EXAMPLE.COM'],
        }],
      });
      expect(saveRes.ok()).toBe(true);

      const callbackRes = await request.post(`${WORKER_URL}/user_api/oauth2/callback`, {
        data: { clientID: 'case-client', code: 'case-code' },
      });
      expect(callbackRes.ok()).toBe(true);
      const body = await callbackRes.json();
      expect(body.jwt).toBeTruthy();
    } finally {
      server.close();
    }
  });
});
